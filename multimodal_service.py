import os
import uuid

TEMP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "tmp_media")
os.makedirs(TEMP_DIR, exist_ok=True)


def _unique_path(ext: str) -> str:
    ext_clean = (ext or "").lstrip(".")
    if not ext_clean:
        ext_clean = "bin"
    return os.path.join(TEMP_DIR, f"{uuid.uuid4().hex}.{ext_clean}")


def save_upload_bytes(data: bytes, ext: str) -> str:
    path = _unique_path(ext)
    with open(path, "wb") as f:
        f.write(data)
    return path


def ocr_image(image_path: str) -> str:
    try:
        import pytesseract
        from PIL import Image
    except Exception as e:
        raise RuntimeError(
            "OCR dependencies not installed. Install with: pip install pytesseract pillow"
        ) from e

    try:
        img = Image.open(image_path)
    except Exception as e:
        raise RuntimeError("Invalid image file") from e

    text = pytesseract.image_to_string(img)
    return (text or "").strip()
