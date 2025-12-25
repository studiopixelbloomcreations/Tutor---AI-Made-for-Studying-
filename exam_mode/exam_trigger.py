from __future__ import annotations
from dataclasses import dataclass
from typing import List

from .exam_messages import get_setup_questions


TRIGGER_PHRASES = [
    "prepare me for my exam",
    "prepare me for my third exam",
    "enable exam mode",
    "turn on exam mode",
    "i want to practice for my exam",
    "practice for my exam",
    "start exam mode",
]


@dataclass
class ExamTriggerResult:
    triggered: bool
    setup_questions: List[str] | None = None


def detect_exam_trigger(user_text: str) -> ExamTriggerResult:
    """Detect if user text should activate Exam Mode.

    Matching is case-insensitive and substring-based for robustness.
    """
    if not user_text:
        return ExamTriggerResult(triggered=False)
    text = user_text.strip().lower()
    for phrase in TRIGGER_PHRASES:
        if phrase in text:
            return ExamTriggerResult(triggered=True, setup_questions=get_setup_questions())
    return ExamTriggerResult(triggered=False)
