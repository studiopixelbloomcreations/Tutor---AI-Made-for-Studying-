from fastapi import APIRouter, File, UploadFile

from .multimodal_service import save_upload_bytes, ocr_image

router = APIRouter(prefix="/multimodal", tags=["multimodal"])


@router.post("/upload_image")
async def upload_image(image: UploadFile = File(...)):
    raw = await image.read()
    ext = (image.filename or "image").split(
        ".")[-1] if image.filename and "." in image.filename else "png"
    path = save_upload_bytes(raw, ext)
    text = ocr_image(path)
    return {"ok": True, "text": text}
