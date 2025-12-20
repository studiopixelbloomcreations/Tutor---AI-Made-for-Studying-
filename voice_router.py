from fastapi import APIRouter, File, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

from voice_service import save_upload_bytes, speech_to_text, text_to_speech

router = APIRouter(prefix="/voice", tags=["voice"])


class SpeakPayload(BaseModel):
    text: str
    voice: Optional[str] = None
    rate: Optional[int] = None


@router.post("/recognize")
async def recognize(audio: UploadFile = File(...), language: str = "en-US"):
    raw = await audio.read()
    ext = (audio.filename or "audio").split(
        ".")[-1] if audio.filename and "." in audio.filename else "webm"
    path = save_upload_bytes(raw, ext)
    out = speech_to_text(path, language=language)
    return {"ok": True, "text": out.text, "engine": out.engine}


@router.post("/speak")
async def speak(req: SpeakPayload):
    out = text_to_speech(text=req.text, voice=req.voice, rate=req.rate)
    return FileResponse(out.path,
                        media_type=out.mime_type,
                        filename="speech.wav")
