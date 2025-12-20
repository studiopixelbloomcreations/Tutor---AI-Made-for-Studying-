import json
import os
import threading
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple


def _safe_topic_key(topic: str) -> str:
    t = (topic or "general").strip().lower()
    return t or "general"


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


@dataclass
class UserProfile:
    email: str
    name: str = ""
    grade: str = "Grade 9"
    preferred_language: str = "English"  # English | Sinhala


@dataclass
class TopicProgress:
    topic: str
    questions_answered: int = 0
    correct: int = 0
    score_total: int = 0
    difficulty: int = 2  # 1(easy) .. 5(hard)

    @property
    def accuracy(self) -> float:
        if self.questions_answered <= 0:
            return 0.0
        return self.correct / self.questions_answered


class PersonalizationStore:
    """Simple JSON-file backed store.

    Data shape:
      {
        "users": {
          "email": {
            "profile": {...},
            "topics": {
              "algebra": {...},
              ...
            },
            "events": [ ... ]
          }
        }
      }
    """

    def __init__(self, file_path: str):
        self._file_path = file_path
        self._lock = threading.Lock()
        self._data: Dict[str, Any] = {"users": {}}
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self._file_path):
            return
        try:
            with open(self._file_path, "r", encoding="utf-8") as f:
                self._data = json.load(f) or {"users": {}}
        except Exception:
            # If the JSON is corrupted, we keep a fresh in-memory data structure.
            self._data = {"users": {}}

    def _save(self) -> None:
        os.makedirs(os.path.dirname(self._file_path) or ".", exist_ok=True)
        tmp = self._file_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, self._file_path)

    def _ensure_user(self, email: str) -> Dict[str, Any]:
        email_key = (email or "guest@student.com").strip().lower()
        users = self._data.setdefault("users", {})
        u = users.get(email_key)
        if not u:
            u = {
                "profile": asdict(UserProfile(email=email_key)),
                "topics": {},
                "events": [],
            }
            users[email_key] = u
        if "profile" not in u:
            u["profile"] = asdict(UserProfile(email=email_key))
        if "topics" not in u:
            u["topics"] = {}
        if "events" not in u:
            u["events"] = []
        return u

    def upsert_profile(self, email: str, name: Optional[str] = None, grade: Optional[str] = None, preferred_language: Optional[str] = None) -> UserProfile:
        with self._lock:
            u = self._ensure_user(email)
            prof = u.get("profile") or {}
            if name is not None:
                prof["name"] = name
            if grade is not None:
                prof["grade"] = grade
            if preferred_language is not None:
                prof["preferred_language"] = preferred_language
            prof.setdefault("email", (email or "guest@student.com").strip().lower())
            u["profile"] = prof
            self._save()
            return UserProfile(**u["profile"])

    def record_attempt(
        self,
        email: str,
        topic: str,
        correct: bool,
        score: int,
        question: Optional[str] = None,
    ) -> TopicProgress:
        """Record a single attempt and update adaptive difficulty."""
        topic_key = _safe_topic_key(topic)

        with self._lock:
            u = self._ensure_user(email)
            topics = u.setdefault("topics", {})
            t = topics.get(topic_key) or {
                "topic": topic_key,
                "questions_answered": 0,
                "correct": 0,
                "score_total": 0,
                "difficulty": 2,
            }

            t["questions_answered"] = int(t.get("questions_answered") or 0) + 1
            if correct:
                t["correct"] = int(t.get("correct") or 0) + 1
            t["score_total"] = int(t.get("score_total") or 0) + int(score or 0)

            # Adaptive difficulty: bump up if accuracy is high, down if low.
            # We use a short window approximation: last N attempts is stored as events.
            u.setdefault("events", []).append(
                {
                    "topic": topic_key,
                    "correct": bool(correct),
                    "score": int(score or 0),
                    "question": (question or "")[:500],
                }
            )
            # Keep events bounded.
            if len(u["events"]) > 200:
                u["events"] = u["events"][-200:]

            recent = [e for e in u["events"][-25:] if e.get("topic") == topic_key]
            if recent:
                acc = sum(1 for e in recent if e.get("correct")) / len(recent)
                diff = int(t.get("difficulty") or 2)
                if len(recent) >= 5:
                    if acc >= 0.8:
                        diff += 1
                    elif acc <= 0.45:
                        diff -= 1
                t["difficulty"] = int(_clamp(diff, 1, 5))

            topics[topic_key] = t
            u["topics"] = topics
            self._save()
            return TopicProgress(**t)

    def get_user_snapshot(self, email: str) -> Dict[str, Any]:
        with self._lock:
            u = self._ensure_user(email)
            profile = u.get("profile") or {}
            topics = u.get("topics") or {}
            events = u.get("events") or []

            # Aggregate overall stats
            total_q = sum(int(t.get("questions_answered") or 0) for t in topics.values())
            total_correct = sum(int(t.get("correct") or 0) for t in topics.values())
            total_score = sum(int(t.get("score_total") or 0) for t in topics.values())

            feedback = generate_feedback(
                profile=UserProfile(**profile),
                topics=topics,
                total_q=total_q,
                total_correct=total_correct,
            )

            return {
                "profile": profile,
                "progress": {
                    "topics": topics,
                    "total_questions": total_q,
                    "total_correct": total_correct,
                    "total_score": total_score,
                },
                "feedback": feedback,
                "recommended_difficulty": recommend_difficulty(topics),
                "events_count": len(events),
            }

    def reset_user(self, email: str) -> None:
        with self._lock:
            email_key = (email or "guest@student.com").strip().lower()
            users = self._data.setdefault("users", {})
            # Keep profile but clear learning data.
            if email_key not in users:
                users[email_key] = {
                    "profile": asdict(UserProfile(email=email_key)),
                    "topics": {},
                    "events": [],
                }
            else:
                users[email_key].setdefault("profile", asdict(UserProfile(email=email_key)))
                users[email_key]["topics"] = {}
                users[email_key]["events"] = []
            self._save()


def recommend_difficulty(topics: Dict[str, Any]) -> int:
    if not topics:
        return 2
    diffs = [int(t.get("difficulty") or 2) for t in topics.values()]
    diffs.sort()
    return diffs[len(diffs) // 2]


def _topic_strengths(topics: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    scored: List[Tuple[str, float]] = []
    for k, t in (topics or {}).items():
        q = int(t.get("questions_answered") or 0)
        if q <= 0:
            continue
        acc = (int(t.get("correct") or 0) / q) if q else 0.0
        # Weight by experience a bit
        weight = min(1.0, q / 10)
        scored.append((k, acc * weight))

    scored.sort(key=lambda x: x[1], reverse=True)
    strong = [k for k, _ in scored[:2]]
    weak = [k for k, _ in scored[-2:]] if len(scored) >= 2 else [k for k, _ in scored]
    return strong, weak


def generate_feedback(profile: UserProfile, topics: Dict[str, Any], total_q: int, total_correct: int) -> Dict[str, str]:
    lang = (profile.preferred_language or "English").strip()
    strong, weak = _topic_strengths(topics)

    if total_q <= 0:
        if lang == "Sinhala":
            return {
                "headline": "අදම පටන් ගමු!",
                "message": "ඔයා තවම කිසිම ප්‍රශ්නයකට ලකුණු ගන්න අරගෙන නැහැ. එක විෂයක් තෝරලා ප්‍රශ්න 3ක් කරලා බලමු.",
            }
        return {
            "headline": "Let’s get started!",
            "message": "You haven’t answered any tracked questions yet. Pick one topic and try 3 practice questions.",
        }

    acc = (total_correct / total_q) if total_q else 0.0
    acc_pct = int(round(acc * 100))

    if lang == "Sinhala":
        s_part = ("ඔයා " + " සහ ".join(strong) + " වල ශක්තිමත්!") if strong else "ඔයා හොඳින් ඉගෙනගන්නවා!"
        w_part = ("ඊළඟට " + " සහ ".join(weak) + " ටිකක් පුහුණු කරමු.") if weak else "තව ටිකක් පුහුණු කරමු."
        return {
            "headline": f"ඔයාගේ සාර්ථකත්වය {acc_pct}%",
            "message": f"{s_part} {w_part}",
        }

    s_part = ("You’re strong in " + ", ".join(strong) + ".") if strong else "You’re making steady progress."
    w_part = ("Next, let’s practice " + ", ".join(weak) + ".") if weak else "Let’s keep practicing."
    return {
        "headline": f"Your accuracy is {acc_pct}%",
        "message": f"{s_part} {w_part}",
    }
