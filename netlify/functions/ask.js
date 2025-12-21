const axios = require("axios");

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization"
    },
    body: JSON.stringify(obj)
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return json(500, { error: "Missing GROQ_API_KEY in Netlify environment variables" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const subject = payload.subject || "General";
  const language = payload.language || "English";
  let student_question = payload.student_question || "";
  const history = Array.isArray(payload.history) ? payload.history : [];

  const rawQuestionLower = String(student_question || "").toLowerCase();
  const overrideOutOfSyllabus =
    rawQuestionLower.includes("go out of syllabus") ||
    rawQuestionLower.includes("out of syllabus") ||
    rawQuestionLower.includes("out-of-syllabus") ||
    rawQuestionLower.includes("off syllabus") ||
    rawQuestionLower.includes("off-syllabus");

  if (overrideOutOfSyllabus) {
    student_question = String(student_question)
      .replace(/\bgo\s*out\s*of\s*syllabus\b\s*[:,\-]?\s*/ig, "")
      .replace(/\bout\s*of\s*syllabus\b\s*[:,\-]?\s*/ig, "")
      .replace(/\boff\s*-?\s*syllabus\b\s*[:,\-]?\s*/ig, "")
      .trim();
  }

  const allowedSubjects = new Set([
    "general",
    "math",
    "maths",
    "mathematics",
    "science",
    "english",
    "sinhala",
    "history",
    "geography",
    "health",
    "civics"
  ]);
  const subjKey = String(subject || "general").trim().toLowerCase();
  const offSyllabusHeuristic = overrideOutOfSyllabus || (subjKey && !allowedSubjects.has(subjKey));

  const cleanedHistory = history
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-20)
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 1200) }));

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `You are 'The Tutor' — a very sweet, friendly, charming Grade 9 teacher in Sri Lanka. Your teaching must be strictly aligned to the official 2024 Sri Lankan Grade 9 print textbooks. Speak in ${language}.

Scope rules (VERY IMPORTANT):
- The student may ask questions beyond the Grade 9 Sri Lankan syllabus.
- You MUST NOT refuse. You MUST still answer helpfully.
- If the question is outside the Grade 9 syllabus OR the student explicitly asked to go out of syllabus, start your reply with a short line: "Scope note: This goes beyond the Grade 9 syllabus, but here is a helpful answer." Then continue normally.
- If it is within the Grade 9 syllabus, do NOT include a scope note.

Style rules:
- Be kind, encouraging, and clear.
- Use a few appropriate emojis (1–3 per message) to make it delightful, not noisy.
- Keep sentences natural and pleasant to hear (TTS-friendly). Avoid long walls of text.
- If you use emojis, put them at the end of sentences, not in the middle of words.
- If the student answers a question you asked, briefly say whether it is correct.

Points rule (VERY IMPORTANT):
- You MUST ALWAYS include EXACTLY ONE final line at the very end of your message in this exact format: AWARD_POINTS: N
- N must be an integer.
- If the student is answering a question/problem and their answer is clearly correct, set N = 10 to 20.
- If the student attempted an answer but it's partially correct or unclear, set N = 5.
- If the student did not attempt an answer, or the answer is clearly wrong with no correct reasoning, set N = 0.
- This must be the LAST line. Do not add anything after it.`
          },
          ...cleanedHistory,
          {
            role: "user",
            content: `Subject: ${subject}\nOut-of-syllabus override: ${overrideOutOfSyllabus ? "YES" : "NO"}\nStudent question: ${student_question}`
          }
        ],
        temperature: 0.45
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 60000
      }
    );

    const answer =
      response &&
      response.data &&
      response.data.choices &&
      response.data.choices[0] &&
      response.data.choices[0].message &&
      response.data.choices[0].message.content
        ? response.data.choices[0].message.content
        : null;

    if (!answer) return json(500, { error: "AI request failed" });

    let finalAnswer = String(answer).trim();
    if(!/\bAWARD_POINTS\s*:\s*\d+\b/i.test(finalAnswer)){
      finalAnswer = finalAnswer + "\n\nAWARD_POINTS: 0";
    }

    return json(200, { answer: finalAnswer, off_syllabus: !!offSyllabusHeuristic });
  } catch (e) {
    return json(500, { error: "AI request failed" });
  }
};
