const pdfParse = require('pdf-parse');

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

global.__EXAM_MODE_SESSIONS__ = global.__EXAM_MODE_SESSIONS__ || new Map();
const SESSIONS = global.__EXAM_MODE_SESSIONS__;

function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function extractNumberedQuestions(text) {
  const t = String(text || '').replace(/\r/g, '');
  const lines = t.split('\n');
  const questions = [];
  let current = null;
  const startRe = /^\s*(\d{1,3})\s*[\).\-]\s*(.+)\s*$/;

  for (const line of lines) {
    const m = line.match(startRe);
    if (m) {
      if (current && current.text.trim().length >= 15) questions.push(current);
      current = { number: parseInt(m[1], 10), text: m[2] };
      continue;
    }
    if (current) {
      const s = line.trim();
      if (!s) continue;
      current.text += '\n' + s;
    }
  }
  if (current && current.text.trim().length >= 15) questions.push(current);

  const seen = new Set();
  return questions
    .map(q => ({ number: q.number, text: String(q.text).trim() }))
    .filter(q => {
      const key = q.text.slice(0, 200).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const sessionId = payload && payload.session_id ? String(payload.session_id) : '';
  if (!sessionId) return json(400, { error: 'Missing session_id' });

  const pdfBase64 = payload && payload.pdf_base64 ? String(payload.pdf_base64) : '';
  if (!pdfBase64) return json(400, { error: 'Missing pdf_base64' });

  const subject = payload && payload.subject ? String(payload.subject) : 'General';
  const term = payload && payload.term ? String(payload.term) : 'Third';

  try {
    const buf = Buffer.from(pdfBase64, 'base64');
    const parsed = await pdfParse(buf);
    const text = String((parsed && parsed.text) || '');

    const qs = extractNumberedQuestions(text)
      .slice(0, 60)
      .map(q => ({
        id: `uploaded#${q.number}`,
        text: q.text,
        source_url: null
      }));

    const sess = SESSIONS.get(sessionId) || { created_at: Date.now(), subject, term, mode: 'practice', papers_loaded: false, pdf_links: [], questions: [] };
    sess.subject = subject;
    sess.term = term;
    sess.questions = qs;
    sess.papers_loaded = true;
    SESSIONS.set(sessionId, sess);

    return json(200, {
      ok: true,
      session_id: sessionId,
      extracted_questions: qs.length,
      sample_question: pickRandom(qs)
    });
  } catch (e) {
    return json(500, { error: 'Failed to parse PDF' });
  }
};
