const axios = require('axios');

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

function normalizeSubject(subject) {
  return String(subject || '').trim().toLowerCase();
}

function normalizeTerm(term) {
  const t = String(term || '').trim().toLowerCase();
  if (t.includes('first') || t === '1' || t.includes('1st')) return 'first';
  if (t.includes('second') || t === '2' || t.includes('2nd')) return 'second';
  if (t.includes('third') || t === '3' || t.includes('3rd')) return 'third';
  return t || 'third';
}

// Very lightweight link discovery: find PDF links and page links
function extractLinks(html) {
  const links = [];
  const re = /href\s*=\s*(["'])(.*?)\1/gi;
  let m;
  while ((m = re.exec(html))) {
    links.push(m[2]);
  }
  return links;
}

function absoluteUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

async function fetchHtml(url) {
  const res = await axios.get(url, {
    timeout: 45000,
    headers: {
      'user-agent': 'Mozilla/5.0 (Netlify Functions) ExamMode/1.0'
    }
  });
  return String(res.data || '');
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

  const sess = SESSIONS.get(sessionId);
  if (!sess) return json(404, { error: 'Unknown session_id' });

  const subject = payload && payload.subject ? String(payload.subject) : sess.subject;
  const term = payload && payload.term ? String(payload.term) : sess.term;

  sess.subject = subject;
  sess.term = term;

  // Target seed page
  const seed = 'https://pastpapers.wiki/grade-09-term-test-papers-past-papers-short-notes-2/';

  try {
    const seedHtml = await fetchHtml(seed);
    const links = extractLinks(seedHtml)
      .map(h => absoluteUrl(seed, h))
      .filter(Boolean);

    const subjKey = normalizeSubject(subject);
    const termKey = normalizeTerm(term);

    // Filter likely subject pages
    const likelySubjectPages = links.filter(u => {
      const ul = u.toLowerCase();
      return ul.includes('pastpapers.wiki') && (ul.includes(subjKey) || ul.includes(subjKey.replace(/\s+/g, '-')));
    }).slice(0, 5);

    const candidatePages = likelySubjectPages.length ? likelySubjectPages : [seed];

    const pdfLinks = new Set();

    for (const page of candidatePages) {
      const html = await fetchHtml(page);
      const pageLinks = extractLinks(html)
        .map(h => absoluteUrl(page, h))
        .filter(Boolean);

      for (const u of pageLinks) {
        const ul = u.toLowerCase();
        if (!ul.includes('pastpapers.wiki')) continue;
        if (!ul.endsWith('.pdf')) continue;
        if (termKey && !(ul.includes(termKey) || ul.includes(termKey + '-term') || ul.includes(termKey + 'term'))) continue;
        pdfLinks.add(u);
        if (pdfLinks.size >= 6) break;
      }
      if (pdfLinks.size >= 6) break;
    }

    // Store links in session; question extraction is done in ask-question
    sess.papers_loaded = true;
    sess.pdf_links = Array.from(pdfLinks);

    return json(200, {
      ok: true,
      session_id: sessionId,
      subject: sess.subject,
      term: sess.term,
      paper_count: sess.pdf_links.length
    });
  } catch (e) {
    return json(500, { error: 'Failed to fetch papers' });
  }
};
