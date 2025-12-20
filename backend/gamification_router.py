import os
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from .gamification import GamificationStore


DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gamification_data.json")
store = GamificationStore(DATA_PATH)

router = APIRouter(prefix="/gamification", tags=["gamification"])


class AddPointsPayload(BaseModel):
    email: Optional[str] = "guest@student.com"
    points: int = 0
    reason: Optional[str] = None
    subject: Optional[str] = None


@router.post("/add_points")
async def add_points(req: AddPointsPayload):
    email = (req.email or "guest@student.com").strip().lower()
    out = store.add_points(email=email, points=int(req.points or 0), reason=req.reason, subject=req.subject)
    return {"ok": True, "data": out}


@router.get("/get_points")
async def get_points(email: str = "guest@student.com"):
    email_key = (email or "guest@student.com").strip().lower()
    return {"ok": True, "data": store.get_points(email_key)}


@router.get("/get_badges")
async def get_badges(email: str = "guest@student.com"):
    email_key = (email or "guest@student.com").strip().lower()
    return {"ok": True, "data": store.get_badges(email_key)}


@router.get("/get_leaderboard")
async def get_leaderboard(limit: int = 10):
    return {"ok": True, "data": store.get_leaderboard(limit=limit)}
