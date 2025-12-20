import json
import os
import threading
from dataclasses import dataclass, asdict
from datetime import date
from typing import Any, Dict, List, Optional, Tuple


def _today_key() -> str:
    return date.today().isoformat()


def _clamp_int(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v))


@dataclass
class Badge:
    key: str
    name: str
    description: str
    earned_at: str


class GamificationStore:
    """JSON-file backed gamification store.

    Data shape:
      {
        "users": {
          "email": {
            "points": 0,
            "streak_days": 1,
            "last_active_day": "YYYY-MM-DD",
            "quiz_wins": 0,
            "lessons_completed": 0,
            "badges": [ {Badge}, ... ]
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
                "points": 0,
                "streak_days": 1,
                "last_active_day": None,
                "quiz_wins": 0,
                "lessons_completed": 0,
                "badges": [],
            }
            users[email_key] = u
        u.setdefault("points", 0)
        u.setdefault("streak_days", 1)
        u.setdefault("last_active_day", None)
        u.setdefault("quiz_wins", 0)
        u.setdefault("lessons_completed", 0)
        u.setdefault("badges", [])
        return u

    def _has_badge(self, u: Dict[str, Any], key: str) -> bool:
        return any((b or {}).get("key") == key for b in (u.get("badges") or []))

    def _grant_badge(self, u: Dict[str, Any], key: str, name: str, description: str) -> Optional[Dict[str, Any]]:
        if self._has_badge(u, key):
            return None
        b = asdict(
            Badge(
                key=key,
                name=name,
                description=description,
                earned_at=_today_key(),
            )
        )
        u.setdefault("badges", []).append(b)
        return b

    def _update_streak(self, u: Dict[str, Any]) -> None:
        today = _today_key()
        last = u.get("last_active_day")
        if not last:
            u["last_active_day"] = today
            u["streak_days"] = max(1, int(u.get("streak_days") or 1))
            return
        if last == today:
            return

        # Determine if last was yesterday
        try:
            last_d = date.fromisoformat(str(last))
            today_d = date.fromisoformat(today)
            diff = (today_d - last_d).days
        except Exception:
            diff = 999

        if diff == 1:
            u["streak_days"] = int(u.get("streak_days") or 0) + 1
        else:
            u["streak_days"] = 1
        u["last_active_day"] = today

    def _apply_badges(self, u: Dict[str, Any]) -> List[Dict[str, Any]]:
        newly: List[Dict[str, Any]] = []

        pts = int(u.get("points") or 0)
        streak = int(u.get("streak_days") or 1)
        quiz_wins = int(u.get("quiz_wins") or 0)
        lessons = int(u.get("lessons_completed") or 0)

        # Points milestones
        if pts >= 100:
            b = self._grant_badge(u, "points_100", "Getting Started", "Earn 100 points")
            if b:
                newly.append(b)
        if pts >= 500:
            b = self._grant_badge(u, "points_500", "Rising Star", "Earn 500 points")
            if b:
                newly.append(b)
        if pts >= 1500:
            b = self._grant_badge(u, "points_1500", "Top Performer", "Earn 1500 points")
            if b:
                newly.append(b)

        # Streak badges
        if streak >= 3:
            b = self._grant_badge(u, "streak_3", "Daily Streak", "Study 3 days in a row")
            if b:
                newly.append(b)
        if streak >= 7:
            b = self._grant_badge(u, "streak_7", "Streak Pro", "Study 7 days in a row")
            if b:
                newly.append(b)

        # Quiz
        if quiz_wins >= 5:
            b = self._grant_badge(u, "quiz_5", "Quiz Champion", "Get 5 quiz answers correct")
            if b:
                newly.append(b)

        # Lessons
        if lessons >= 5:
            b = self._grant_badge(u, "lessons_5", "Consistent Learner", "Complete 5 lessons")
            if b:
                newly.append(b)

        return newly

    def add_points(
        self,
        email: str,
        points: int,
        reason: Optional[str] = None,
        subject: Optional[str] = None,
    ) -> Dict[str, Any]:
        p = int(points or 0)
        if p < 0:
            p = 0

        with self._lock:
            u = self._ensure_user(email)
            self._update_streak(u)

            u["points"] = int(u.get("points") or 0) + p

            r = (reason or "").strip().lower()
            if r == "quiz_correct":
                u["quiz_wins"] = int(u.get("quiz_wins") or 0) + 1
            if r == "lesson_complete":
                u["lessons_completed"] = int(u.get("lessons_completed") or 0) + 1

            u["points"] = _clamp_int(int(u.get("points") or 0), 0, 10_000_000)

            newly = self._apply_badges(u)

            self._save()

            return {
                "email": (email or "guest@student.com").strip().lower(),
                "points": int(u.get("points") or 0),
                "streak_days": int(u.get("streak_days") or 1),
                "badges": u.get("badges") or [],
                "new_badges": newly,
            }

    def get_points(self, email: str) -> Dict[str, Any]:
        with self._lock:
            u = self._ensure_user(email)
            # Touch streak on reads too (so opening the app counts as activity)
            self._update_streak(u)
            newly = self._apply_badges(u)
            if newly:
                self._save()
            return {
                "email": (email or "guest@student.com").strip().lower(),
                "points": int(u.get("points") or 0),
                "streak_days": int(u.get("streak_days") or 1),
            }

    def get_badges(self, email: str) -> Dict[str, Any]:
        with self._lock:
            u = self._ensure_user(email)
            self._update_streak(u)
            newly = self._apply_badges(u)
            if newly:
                self._save()
            return {
                "email": (email or "guest@student.com").strip().lower(),
                "badges": u.get("badges") or [],
            }

    def get_leaderboard(self, limit: int = 10) -> List[Dict[str, Any]]:
        with self._lock:
            users = self._data.get("users") or {}
            rows: List[Tuple[str, int, int]] = []
            for email, u in users.items():
                pts = int((u or {}).get("points") or 0)
                streak = int((u or {}).get("streak_days") or 1)
                rows.append((email, pts, streak))
            rows.sort(key=lambda x: x[1], reverse=True)
            limit = _clamp_int(int(limit or 10), 1, 50)
            top = rows[:limit]
            return [
                {"rank": i + 1, "email": e, "points": p, "streak_days": s}
                for i, (e, p, s) in enumerate(top)
            ]
