const crypto = require('crypto');

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

// Best-effort in-memory sessions (Netlify Functions are stateless across cold starts)
global.__EXAM_MODE_SESSIONS__ = global.__EXAM_MODE_SESSIONS__ || new Map();
const SESSIONS = global.__EXAM_MODE_SESSIONS__;

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const sessionId =
    (payload && payload.session_id && String(payload.session_id).trim()) ||
    crypto.randomUUID?.() ||
    crypto.randomBytes(16).toString('hex');

  const subject = (payload && payload.subject) ? String(payload.subject) : "General";
  const term = (payload && payload.term) ? String(payload.term) : "Third";
  const mode = (payload && payload.mode) ? String(payload.mode) : "practice";

  SESSIONS.set(sessionId, {
    created_at: Date.now(),
    subject,
    term,
    mode,
    papers_loaded: false,
    questions: []
  });

  return json(200, {
    session_id: sessionId,
    subject,
    term,
    mode
  });
};
