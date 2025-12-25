from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class StartExamRequest(BaseModel):
    mode: str = Field(..., description="real or practice")
    term: str = Field(..., description="First term, Second term, Third term")
    subject: str = Field(..., description="Maths, Science, English, etc.")
    session_id: Optional[str] = Field(None, description="Client-provided session identifier")


class StartExamResponse(BaseModel):
    session_id: str
    message: str
    next_endpoint: str = "/exam-mode/fetch-papers"


class FetchPapersRequest(BaseModel):
    session_id: str
    subject: str
    term: str


class PaperQuestion(BaseModel):
    id: str
    year: int
    subject: str
    term: str
    text: str
    type: str = Field(..., description="Question type e.g., algebra, mcq, essay")
    choices: Optional[List[str]] = None
    answer: Optional[str] = Field(None, description="Gold answer for evaluation (if known)")


class FetchPapersResponse(BaseModel):
    session_id: str
    papers: Dict[int, int] = Field(..., description="year -> question_count")
    total_questions: int
    message: str


class AskQuestionRequest(BaseModel):
    session_id: str


class AskQuestionResponse(BaseModel):
    session_id: str
    question: PaperQuestion
    progress: Dict[str, Any]


class EvaluateRequest(BaseModel):
    session_id: str
    question_id: str
    user_answer: str


class TeachingStep(BaseModel):
    title: str
    content: str


class EvaluateResponse(BaseModel):
    session_id: str
    correct: bool
    points_awarded: int
    streak: int
    badge_earned: Optional[str] = None
    explanation: Optional[str] = None
    mastery_steps: Optional[List[TeachingStep]] = None
    next_question_ready: bool = False
    progress: Dict[str, Any] = {}


class ProgressSnapshot(BaseModel):
    session_id: str
    points: int
    streak: int
    badges: List[str]
    readiness_percent: int
    last_updated: datetime
