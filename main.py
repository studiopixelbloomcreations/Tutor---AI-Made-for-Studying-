from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, List
from groq import Groq
import os
import difflib
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize Groq client with error handling
try:
    client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
    if not os.environ.get("GROQ_API_KEY"):
        print("WARNING: GROQ_API_KEY environment variable not set")
except Exception as e:
    print(f"ERROR: Failed to initialize Groq client: {e}")
    client = None

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory user history
user_memory: Dict[str, Dict[str, List[Dict[str, str]]]] = {}


# Request models
class AskRequest(BaseModel):
    subject: str
    language: str
    student_question: str
    title: Optional[str] = "General Help"
    email: Optional[str] = "guest@student.com"


class TitleRequest(BaseModel):
    question: str


# Health check
@app.get("/health")
async def health():
    return {"status": "ok"}


# AI answer endpoint with memory
@app.post("/ask")
async def ask(req: AskRequest):
    # Initialize memory buckets
    user_memory.setdefault(req.email, {})
    user_memory[req.email].setdefault(req.title, [])

    # Build conversation history for this topic
    history = user_memory[req.email][req.title]
    history_block = "\n".join(
        [f"Q: {h['question']} → A: {h['answer']}" for h in history])

    # Cross-topic recall
    related_context = []
    for topic, past in user_memory[req.email].items():
        for entry in past:
            similarity = difflib.SequenceMatcher(
                None, req.student_question.lower(),
                entry["question"].lower()).ratio()
            if similarity > 0.6:
                related_context.append(
                    f"From '{topic}': Q: {entry['question']} → A: {entry['answer']}"
                )

    # Simple off-syllabus detection (subject match against common Grade 9 subjects)
    allowed_subjects = {
        "math", "maths", "mathematics", "science", "english", "sinhala",
        "history", "geography", "health", "civics"
    }
    off_syllabus = False
    subj_key = (req.subject or "general").strip().lower()
    if subj_key and subj_key not in allowed_subjects and subj_key != "general":
        off_syllabus = True

    # System persona: Strictly aligned to 2024 Sri Lankan Grade 9 print textbooks
    # Tone: very warm, calm, natural; allow light emojis/exclamation sparingly and gentle endearments when the student seems distressed.
    system_prompt = (
        "You are 'The Tutor' — a real, warm Grade 9 teacher in Sri Lanka. "
        "Your teaching must be strictly aligned to the official 2024 Sri Lankan Grade 9 print textbooks. "
        "Speak in a natural teacher tone; you may use a gentle exclamation or a simple emoji occasionally (e.g., 🙂) — keep it subtle, no hype. You may use a soft endearment like 'dear' or 'sweetheart' sparingly when the student is upset. "
        "Use a brief, genuine one‑sentence warm opener when the student greets or sounds unsure. Then teach clearly. "
        "When teaching content, avoid rigid section headings. Prefer short, flowing sentences; use short bullets only if needed. Keep it concise. Include a local Sri Lankan example and one small practice prompt. "
        "If the student says only a lesson number (e.g., 'teach lesson 3 in Maths'), do not ask them to check the book. Begin with a short warm line and immediately teach what that lesson typically covers in the 2024 book; if editions differ, mention uncertainty in one short sentence and continue with the core concept. "
        "If the student expresses stress, fear, or personal difficulty, first respond with 1–3 calm, supportive sentences (e.g., 'Oh dear, I'm here with you. Let's breathe together: inhale 4… hold 4… out 6…'), possibly with a soft emoji, then ask if they want to continue gently or take it slowly. After that, proceed with the requested help, briefly. "
        "If a request is outside the Grade 9 syllabus, include a brief 'Scope note' at the top, then provide a short, age‑appropriate explanation. "
        "Use Sinhala or English based on the requested language. Avoid pet names. Never invent page numbers or quote the book verbatim. Do not ask for the table of contents."
    )

    # Build user-facing prompt content
    prompt_parts = [
        f"Subject: {req.subject}",
        f"Language: {req.language}",
    ]
    if history_block:
        prompt_parts.append("Conversation so far in this topic:")
        prompt_parts.append(history_block)
    if related_context:
        prompt_parts.append("Related past questions:")
        prompt_parts.append("\n".join(related_context))
    if off_syllabus:
        prompt_parts.append(
            "[Note: This question appears to be outside the official Grade 9 Sri Lankan syllabus. Please mark it as off-syllabus and provide a short scope note before answering.]"
        )
    prompt_parts.append("Student question:")
    prompt_parts.append(req.student_question)
    user_prompt = "\n\n".join(prompt_parts)

    try:
        if not client:
            return {"error": "AI service not available - missing API key"}
            
        # Send both system and user messages to the chat API
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",  # Updated to working model
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": user_prompt
                },
            ],
            temperature=0.45,
        )
        answer = response.choices[0].message.content.strip()

        # If off_syllabus, ensure there is a small scope note (safety fallback)
        if off_syllabus and "Scope note" not in answer and "off-syllabus" not in answer.lower(
        ):
            answer = "Scope note: This is beyond the Grade 9 syllabus. " + answer

        # Save Q&A (include off_syllabus flag)
        user_memory[req.email][req.title].append({
            "question": req.student_question,
            "answer": answer,
            "off_syllabus": off_syllabus
        })

        return {"answer": answer, "off_syllabus": off_syllabus}
    except Exception as e:
        return {"error": f"AI request failed: {str(e)}"}


# Title generation
@app.post("/generate_title")
async def generate_title(req: TitleRequest):
    prompt = (
        'Generate a short, clear topic title (2–5 words) for this Grade 9 student question: '
        f'"{req.question}". The title should describe the type of help or subject area. '
        'Return ONLY the title, no punctuation or quotes.')
    try:
        if not client:
            return {"title": "General Help", "error": "AI service not available"}
            
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",  # Updated to working model
            messages=[{
                "role": "user",
                "content": prompt
            }],
            temperature=0.5,
        )
        title = response.choices[0].message.content.strip()
        title = title.strip().strip('"').strip("'")
        return {"title": title}
    except Exception as e:
        return {"title": "General Help", "error": f"Title AI failed: {str(e)}"}


# Optional: memory inspection
@app.get("/memory")
async def get_memory(email: str, title: Optional[str] = None):
    if email not in user_memory:
        return {"email": email, "memory": {}}
    if title is None:
        return {"email": email, "memory": user_memory[email]}
    return {
        "email": email,
        "title": title,
        "history": user_memory[email].get(title, [])
    }
