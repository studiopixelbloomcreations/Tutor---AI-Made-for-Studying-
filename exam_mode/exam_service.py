from __future__ import annotations
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
import uuid

from .exam_utils import scrape_papers, random_question_from_papers, is_correct, mastery_teaching_steps, badge_for_type


@dataclass
class SessionState:
    session_id: str
    mode: str
    term: str
    subject: str
    papers: Dict[int, List[dict]] = field(default_factory=dict)
    used_question_ids: set = field(default_factory=set)
    points: int = 0
    streak: int = 0
    badges: set = field(default_factory=set)
    readiness_percent: int = 0
    last_question: Optional[dict] = None
    last_updated: datetime = field(default_factory=datetime.utcnow)


class ExamService:
    def __init__(self):
        # Simple in-memory session store
        self.sessions: Dict[str, SessionState] = {}

    # Session Management
    def start_session(self, mode: str, term: str, subject: str, session_id: Optional[str] = None) -> SessionState:
        sid = session_id or str(uuid.uuid4())
        state = SessionState(session_id=sid, mode=mode, term=term, subject=subject)
        self.sessions[sid] = state
        return state

    def get_session(self, session_id: str) -> SessionState:
        if session_id not in self.sessions:
            raise KeyError("Invalid session_id")
        return self.sessions[session_id]

    # Data loading
    def fetch_papers(self, session_id: str) -> Dict[int, List[dict]]:
        state = self.get_session(session_id)
        papers = scrape_papers(state.subject, state.term)
        state.papers = papers
        # reset tracking when (re)loading papers
        state.used_question_ids.clear()
        state.last_question = None
        state.last_updated = datetime.utcnow()
        return papers

    # Question flow
    def next_question(self, session_id: str) -> dict:
        state = self.get_session(session_id)
        if not state.papers:
            raise RuntimeError("Papers not loaded for session")

        # Try to find a question not used yet; fallback if all used
        all_questions = [q for year in state.papers for q in state.papers[year]]
        remaining = [q for q in all_questions if q["id"] not in state.used_question_ids]
        if not remaining:
            remaining = all_questions
            state.used_question_ids.clear()
        q = random_question_from_papers({q["year"]: [q] for q in remaining}) if remaining else random_question_from_papers(state.papers)
        state.last_question = q
        state.used_question_ids.add(q["id"])
        state.last_updated = datetime.utcnow()
        return q

    # Evaluation
    def evaluate(self, session_id: str, question_id: str, user_answer: str) -> dict:
        state = self.get_session(session_id)
        if not state.last_question or state.last_question.get("id") != question_id:
            # Try to locate question by id in papers
            for year, qs in state.papers.items():
                for q in qs:
                    if q["id"] == question_id:
                        state.last_question = q
                        break
        q = state.last_question
        if not q:
            raise RuntimeError("Question not found in session")

        correct = is_correct(user_answer, q.get("answer"))
        points_awarded = 0
        badge_earned = None
        explanation = None
        mastery_steps = None

        if correct:
            state.streak += 1
            points_awarded = 10 + min(state.streak * 2, 10)
            state.points += points_awarded
            # Progress update
            state.readiness_percent = min(100, state.readiness_percent + 2)
        else:
            explanation = f"Incorrect. The correct answer is {q.get('answer')}."
            steps = mastery_teaching_steps(q.get("type", "general"))
            mastery_steps = [{"title": t, "content": c} for t, c in steps]
            state.streak = 0
            # Provide focused practice by asking another of same type next
            same_type = []
            for year, qs in state.papers.items():
                for cand in qs:
                    if cand.get("type") == q.get("type") and cand["id"] not in state.used_question_ids:
                        same_type.append(cand)
            if same_type:
                nxt = random_question_from_papers({cand["year"]: [cand] for cand in same_type})
                state.last_question = nxt
                state.used_question_ids.add(nxt["id"])

        # Badges
        if correct:
            qtype = q.get("type", "general")
            badge_name = badge_for_type(qtype)
            # Award if answered correctly at least 3 times for that type (simple heuristic)
            # Count correct answers per type by scanning used questions intersecting that type
            # For simplicity, we track via points/streak; here, grant for streak >=3 on same type
            if state.streak >= 3 and badge_name not in state.badges:
                state.badges.add(badge_name)
                badge_earned = badge_name

        state.last_updated = datetime.utcnow()
        return {
            "correct": correct,
            "points_awarded": points_awarded,
            "streak": state.streak,
            "badge_earned": badge_earned,
            "explanation": explanation,
            "mastery_steps": mastery_steps,
            "progress": {
                "points": state.points,
                "streak": state.streak,
                "badges": list(state.badges),
                "readiness_percent": state.readiness_percent,
            },
        }

    def progress_snapshot(self, session_id: str) -> dict:
        s = self.get_session(session_id)
        return {
            "session_id": s.session_id,
            "points": s.points,
            "streak": s.streak,
            "badges": list(s.badges),
            "readiness_percent": s.readiness_percent,
            "last_updated": s.last_updated.isoformat(),
        }


# Singleton service instance for import by routes
exam_service = ExamService()
