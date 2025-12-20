import os
import shutil
import subprocess
import uuid
from dataclasses import dataclass
from typing import Optional


TEMP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tmp_media")
os.makedirs(TEMP_DIR, exist_ok=True)


@dataclass
class STTResult:
    text: str
    engine: str


@dataclass
class TTSResult:
    path: str
    mime_type: str
    engine: str


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


def _convert_to_wav_if_needed(audio_path: str) -> str:
    """Convert common browser-recorded formats (webm/ogg/mp4) to wav using ffmpeg.

    SpeechRecognition's AudioFile supports WAV/AIFF/FLAC. For anything else we try ffmpeg.
    """
    ext = os.path.splitext(audio_path)[1].lower().lstrip(".")
    if ext in {"wav", "aiff", "aif", "flac"}:
        return audio_path

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError(
            "Unsupported audio format. Install ffmpeg or upload WAV/AIFF/FLAC instead."
        )

    out_path = _unique_path("wav")
    try:
        subprocess.run(
            [ffmpeg, "-y", "-i", audio_path, out_path],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception as e:
        raise RuntimeError("Audio conversion failed (ffmpeg)") from e

    return out_path


def speech_to_text(audio_path: str, language: str = "en-US") -> STTResult:
    """Best-effort STT. Uses SpeechRecognition if installed.

    Notes:
    - This is intended for local testing.
    - Default engine uses Google Web Speech via SpeechRecognition (requires internet).
    """
    try:
        import speech_recognition as sr
    except Exception as e:  # pragma: no cover
        raise RuntimeError(
            "SpeechRecognition is not installed. Install with: pip install SpeechRecognition"
        ) from e

    r = sr.Recognizer()

    audio_path = _convert_to_wav_if_needed(audio_path)

    try:
        with sr.AudioFile(audio_path) as source:
            audio = r.record(source)
    except Exception as e:
        raise RuntimeError(
            "Unsupported audio format for SpeechRecognition. Please upload WAV/AIFF/FLAC."
        ) from e

    try:
        text = r.recognize_google(audio, language=language or "en-US")
    except sr.UnknownValueError:
        text = ""
    except sr.RequestError as e:
        raise RuntimeError(f"STT request failed: {e}") from e

    return STTResult(text=text, engine="speech_recognition:google")


def text_to_speech(text: str, voice: Optional[str] = None, rate: Optional[int] = None) -> TTSResult:
    """Best-effort offline TTS using pyttsx3.

    Returns a WAV file path.
    """
    try:
        import pyttsx3
    except Exception as e:  # pragma: no cover
        raise RuntimeError("pyttsx3 is not installed. Install with: pip install pyttsx3") from e

    out_path = _unique_path("wav")

    engine = pyttsx3.init()
    if rate is not None:
        try:
            engine.setProperty("rate", int(rate))
        except Exception:
            pass

    if voice:
        try:
            voices = engine.getProperty("voices")
            for v in voices:
                # Match by id or name substring
                if voice.lower() in str(getattr(v, "id", "")).lower() or voice.lower() in str(
                    getattr(v, "name", "")
                ).lower():
                    engine.setProperty("voice", v.id)
                    break
        except Exception:
            pass

    # pyttsx3 saves to file asynchronously; runAndWait flushes
    engine.save_to_file(text or "", out_path)
    engine.runAndWait()

    return TTSResult(path=out_path, mime_type="audio/wav", engine="pyttsx3")
