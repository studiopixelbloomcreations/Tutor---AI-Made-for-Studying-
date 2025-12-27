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

function jinaProxyUrl(url) {
  const u = String(url || '');
  if (u.startsWith('https://')) return 'https://r.jina.ai/https://' + u.slice('https://'.length);
  if (u.startsWith('http://')) return 'https://r.jina.ai/http://' + u.slice('http://'.length);
  return null;
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
    questions: [],
    last_pdf_url: null
  };
  SESSIONS.set(sessionId, created);
  return created;
}

function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomDifferent(arr, notEqualTo) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  if (arr.length === 1) return arr[0];
  const filtered = arr.filter(x => x && x !== notEqualTo);
  const pool = filtered.length ? filtered : arr;
  return pickRandom(pool);
}

function extractNumberedQuestions(text) {
  const t = String(text || '').replace(/\r/g, '');
  // Heuristic: split on lines that start with digits + dot/)
  const lines = t.split('\n');
  const questions = [];
  let current = null;

  const MAX_CHARS = 900;
  const MAX_LINES = 14;

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
      if ((current.text.length + s.length) <= MAX_CHARS && (current.text.split('\n').length <= MAX_LINES)) {
        current.text += '\n' + s;
      }
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

function cleanPdfText(text) {
  let t = String(text || '');
  try { t = t.normalize('NFKC'); } catch (e) {}

  // Replace common ligatures
  t = t
    .replace(/\ufb00/g, 'ff')
    .replace(/\ufb01/g, 'fi')
    .replace(/\ufb02/g, 'fl')
    .replace(/\ufb03/g, 'ffi')
    .replace(/\ufb04/g, 'ffl');

  // Remove common "replacement" / unknown glyph markers and zero-width chars
  t = t
    .replace(/\uFFFD/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');

  // Drop other control chars (keep newlines/tabs)
  t = t.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Normalize whitespace
  t = t.replace(/\r/g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/[ \t]{2,}/g, ' ');
  return t;
}

function preprocessForQuestionParsing(text) {
  let t = String(text || '');

  // Fix hyphenation across line breaks: "alge-\nbra" -> "algebra"
  t = t.replace(/([A-Za-z])\-\n([A-Za-z])/g, '$1$2');

  // Join wrapped lines inside a paragraph into spaces (keep paragraph breaks)
  // If a line ends without strong punctuation, treat the next line as continuation.
  t = t.replace(/([^\n\.!\?\:;])\n(?=[^\n])/g, '$1 ');

  // Re-normalize newlines and spaces after joining
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/[ \t]{2,}/g, ' ');
  return t;
}

async function fetchPdfText(url) {
  const headers = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'accept': 'application/pdf,*/*',
    'referer': 'https://pastpapers.wiki/'
  };

  const candidates = [url];
  const proxy = jinaProxyUrl(url);
  if (proxy) candidates.push(proxy);

  let lastErr = null;
  for (const u of candidates) {
    try {
      const res = await axios.get(u, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers,
        validateStatus: () => true
      });

      if (!res || typeof res.status !== 'number') throw new Error('BAD_RESPONSE');
      if (res.status === 403 || res.status === 429) {
        const err = new Error('HTTP_' + res.status);
        err.status = res.status;
        err.url = u;
        throw err;
      }
      if (res.status >= 400) {
        const err = new Error('HTTP_' + res.status);
        err.status = res.status;
        err.url = u;
        throw err;
      }

      const buf = Buffer.from(res.data);
      const data = await pdfParse(buf);
      const cleaned = cleanPdfText(String((data && data.text) || ''));
      return preprocessForQuestionParsing(cleaned);
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error('PDF_FETCH_FAILED');
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

  // If we already have extracted questions (e.g. from uploaded PDFs), serve them immediately.
  if (Array.isArray(sess.questions) && sess.questions.length > 0) {
    const q = pickRandom(sess.questions);
    return json(200, { session_id: sessionId, question: q });
  }

  const pdfLinks = Array.isArray(sess.pdf_links) ? sess.pdf_links : [];
  if (!sess.papers_loaded || pdfLinks.length === 0) {
    return json(200, {
      session_id: sessionId,
      question: {
        id: 'no_papers_found',
        text: `I couldn't fetch past-paper PDFs right now for (Subject: ${sess.subject}, Term: ${sess.term}).\n\nThis usually happens because the past-paper website blocks automated server requests (HTTP 403/anti-bot), which can prevent Netlify from downloading the PDFs.\n\n✅ Fix: Upload a past-paper PDF using the Upload button (📄) and I will scan it and ask you a real question from it.\n\nFor now, here is a practice exam-style question:\n\nWrite 3 key points you remember from the ${sess.subject} textbook chapter you studied most recently, and I will turn them into an exam question.`,
        source_url: null
      },
      paper_count: pdfLinks.length
    });
  }

  try {
    // Pick ONE paper each time, but randomize across all papers for the chosen term.
    // Also avoid repeating the same paper consecutively.
    const pickedPdf = pickRandomDifferent(pdfLinks, sess.last_pdf_url);
    sess.last_pdf_url = pickedPdf;

    const text = await fetchPdfText(pickedPdf);
    const qs = extractNumberedQuestions(text)
      .filter(q => q && q.text && q.text.length >= 20 && q.text.length <= 900);

    const questions = qs.slice(0, 80).map(q => ({
      id: `${pickedPdf}#${q.number}`,
      text: q.text,
      source_url: pickedPdf
    }));

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

    const picked = pickRandom(questions);
    return json(200, { session_id: sessionId, question: picked });
  } catch (e) {
    return json(500, { error: 'Failed to extract question from PDFs' });
  }
};
