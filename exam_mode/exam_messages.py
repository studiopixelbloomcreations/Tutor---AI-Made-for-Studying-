from typing import List

# Centralized Exam Mode setup messages and helper text.

SETUP_QUESTIONS: List[str] = [
    "Are you preparing for a real exam or just practicing for one?",
    "Which term test are you getting ready for? (First term, Second term, Third term)",
    "Which subject are you planning to study? (Maths, Science, English, etc.)",
]


def get_setup_questions() -> List[str]:
    """Return the ordered list of setup questions for Exam Mode."""
    return list(SETUP_QUESTIONS)
