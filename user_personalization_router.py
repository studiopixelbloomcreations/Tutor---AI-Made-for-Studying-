import os
from typing import Any, Dict, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from personalization import PersonalizationStore


DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "personalization_data.json")
store = PersonalizationStore(DATA_PATH)

router = APIRouter(prefix="/user", tags=["personalization"])


class ProfilePayload(BaseModel):
    email: Optional[str] = "guest@student.com"
    name: Optional[str] = None
    grade: Optional[str] = None
    preferred_language: Optional[str] = None


class SaveProgressPayload(BaseModel):
    email: Optional[str] = "guest@student.com"
    topic: str
    correct: bool
    score: int = 0
    question: Optional[str] = None
    profile: Optional[Dict[str, Any]] = None


class GetProgressQuery(BaseModel):
    email: Optional[str] = "guest@student.com"


class ResetProgressPayload(BaseModel):
    email: Optional[str] = "guest@student.com"


@router.post("/save_progress")
async def save_progress(req: SaveProgressPayload):
    email = (req.email or "guest@student.com").strip().lower()

    if req.profile:
        store.upsert_profile(
            email=email,
            name=req.profile.get("name"),
            grade=req.profile.get("grade"),
            preferred_language=req.profile.get("preferred_language"),
        )

    topic_progress = store.record_attempt(
        email=email,
        topic=req.topic,
        correct=bool(req.correct),
        score=int(req.score or 0),
        question=req.question,
    )

    snapshot = store.get_user_snapshot(email)
    return {"ok": True, "topic_progress": topic_progress.__dict__, "snapshot": snapshot}


@router.get("/get_progress")
async def get_progress(email: str = "guest@student.com"):
    email_key = (email or "guest@student.com").strip().lower()
    return {"ok": True, "email": email_key, "data": store.get_user_snapshot(email_key)}


@router.post("/reset_progress")
async def reset_progress(req: ResetProgressPayload):
    email = (req.email or "guest@student.com").strip().lower()
    store.reset_user(email)
    return {"ok": True}


@router.post("/set_profile")
async def set_profile(req: ProfilePayload):
    email = (req.email or "guest@student.com").strip().lower()
    prof = store.upsert_profile(email=email, name=req.name, grade=req.grade, preferred_language=req.preferred_language)
    return {"ok": True, "profile": prof.__dict__}
