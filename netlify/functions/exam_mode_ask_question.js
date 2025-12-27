const axios = require('axios');
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

function ensureSession(sessionId, seed) {
  if (!sessionId) return null;
  const existing = SESSIONS.get(sessionId);
  if (existing) return existing;
  const created = {
    created_at: Date.now(),
    subject: (seed && seed.subject) ? String(seed.subject) : 'General',
    term: (seed && seed.term) ? String(seed.term) : 'Third',
    mode: (seed && seed.mode) ? String(seed.mode) : 'practice',
    papers_loaded: false,
    pdf_links: Array.isArray(seed && seed.pdf_links) ? seed.pdf_links : [],
    questions: []
  };
  SESSIONS.set(sessionId, created);
  return created;
}

function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function extractNumberedQuestions(text) {
  const t = String(text || '').replace(/\r/g, '');
  // Heuristic: split on lines that start with digits + dot/)
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

  // Deduplicate by text
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

async function fetchPdfText(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
  const buf = Buffer.from(res.data);
  const data = await pdfParse(buf);
  return String((data && data.text) || '');
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

  const sess = ensureSession(sessionId, payload);
  if (!sess) return json(500, { error: 'Failed to initialize session' });

  // Allow passing pdf_links directly for stateless operation
  if (Array.isArray(payload && payload.pdf_links) && payload.pdf_links.length > 0) {
    sess.pdf_links = payload.pdf_links;
    sess.papers_loaded = true;
  }

  const pdfLinks = Array.isArray(sess.pdf_links) ? sess.pdf_links : [];
  if (!sess.papers_loaded || pdfLinks.length === 0) {
    return json(200, {
      session_id: sessionId,
      question: {
        id: 'no_papers_found',
        text: `I couldn't find matching past-paper PDFs for your selection (Subject: ${sess.subject}, Term: ${sess.term}).\n\n1) Please try a simpler subject name (e.g. "Maths", "Science", "English").\n2) And a clear term ("First", "Second", "Third").\n\nFor now, here is a practice exam-style question:\n\nWrite 3 key points you remember from the ${sess.subject} textbook chapter you studied most recently, and I will turn them into an exam question.`,
        source_url: null
      },
      paper_count: pdfLinks.length
    });
  }

  // If we already extracted questions in this warm instance, reuse
  if (Array.isArray(sess.questions) && sess.questions.length > 0) {
    const q = pickRandom(sess.questions);
    return json(200, { question: q, session_id: sessionId });
  }

  // Extract from up to N PDFs
  const maxPdfs = 2;
  const maxQuestions = 40;
  const questions = [];

  try {
    for (const url of pdfLinks.slice(0, maxPdfs)) {
      const text = await fetchPdfText(url);
      const qs = extractNumberedQuestions(text);
      for (const q of qs) {
        questions.push({
          id: `${url}#${q.number}`,
          text: q.text,
          source_url: url
        });
        if (questions.length >= maxQuestions) break;
      }
      if (questions.length >= maxQuestions) break;
    }

    // Fallback: if none parsed, return a generic question
    if (questions.length === 0) {
      return json(200, {
        session_id: sessionId,
        question: {
          id: 'fallback',
          text: `I couldn't extract a numbered question from the PDFs.\n\nTell me the subject topic you want (from ${sess.subject}) and I will create an exam-style question for you.`,
          source_url: null
        }
      });
    }

    sess.questions = questions;

    const picked = pickRandom(questions);
    return json(200, { session_id: sessionId, question: picked });
  } catch (e) {
    return json(500, { error: 'Failed to extract question from PDFs' });
  }
};
