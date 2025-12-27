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
    pdf_links: [],
    questions: []
  };
  SESSIONS.set(sessionId, created);
  return created;
}

function normalizeSubject(subject) {
  return String(subject || '').trim().toLowerCase();
}

function subjectAliases(subjectKey) {
  const s = String(subjectKey || '').trim().toLowerCase();
  if (s === 'maths' || s === 'math' || s === 'mathematics') return ['maths', 'math', 'mathematics'];
  if (s === 'science') return ['science'];
  if (s === 'english') return ['english'];
  return [s].filter(Boolean);
}

function normalizeTerm(term) {
  const t = String(term || '').trim().toLowerCase();
  if (t.includes('first') || t === '1' || t.includes('1st')) return 'first';
  if (t.includes('second') || t === '2' || t.includes('2nd')) return 'second';
  if (t.includes('third') || t === '3' || t.includes('3rd')) return 'third';
  return t || 'third';
}

function termAliases(termKey) {
  const t = String(termKey || '').trim().toLowerCase();
  if (t === 'first') return ['first', '1st', 'term1', 'term-1', 'term_1', 'term 1', '1'];
  if (t === 'second') return ['second', '2nd', 'term2', 'term-2', 'term_2', 'term 2', '2'];
  if (t === 'third') return ['third', '3rd', 'term3', 'term-3', 'term_3', 'term 3', '3'];
  return [t].filter(Boolean);
}

function urlHasAny(u, parts) {
  const ul = String(u || '').toLowerCase();
  return (parts || []).some(p => p && ul.includes(String(p).toLowerCase()));
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

function isProbablyHtmlPage(u) {
  const ul = String(u || '').toLowerCase();
  if (!ul.includes('pastpapers.wiki')) return false;
  if (ul.endsWith('.pdf')) return false;
  if (ul.includes('#')) return false;
  // avoid obvious assets
  if (ul.match(/\.(jpg|jpeg|png|gif|webp|svg|css|js)(\?|$)/)) return false;
  return true;
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

  const sess = ensureSession(sessionId, payload);
  if (!sess) return json(500, { error: 'Failed to initialize session' });

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
    const subjAliases = subjectAliases(subjKey);
    const tAliases = termAliases(termKey);

    // Filter likely subject pages (use aliases, not just exact subject key)
    const likelySubjectPages = links
      .filter(u => isProbablyHtmlPage(u) && urlHasAny(u, subjAliases))
      .slice(0, 6);

    const candidatePages = likelySubjectPages.length ? likelySubjectPages : [seed];

    const pdfCandidates = [];

    const visitedPages = new Set();

    async function scanPageForPdfs(pageUrl) {
      if (!pageUrl || visitedPages.has(pageUrl)) return [];
      visitedPages.add(pageUrl);

      const html = await fetchHtml(pageUrl);
      const pageLinks = extractLinks(html)
        .map(h => absoluteUrl(pageUrl, h))
        .filter(Boolean);

      const discoveredChildPages = [];
      for (const u of pageLinks) {
        const ul = u.toLowerCase();
        if (!ul.includes('pastpapers.wiki')) continue;

        if (ul.endsWith('.pdf')) {
          let score = 0;
          if (urlHasAny(ul, subjAliases) || urlHasAny(u, subjAliases)) score += 2;
          if (urlHasAny(ul, tAliases) || urlHasAny(u, tAliases)) score += 1;
          pdfCandidates.push({ url: u, score });
          continue;
        }

        // queue one level deep pages that look relevant
        if (isProbablyHtmlPage(u) && (urlHasAny(u, subjAliases) || urlHasAny(u, tAliases))) {
          discoveredChildPages.push(u);
        }
      }

      return discoveredChildPages;
    }

    // First pass: scan candidate pages
    let childQueue = [];
    for (const page of candidatePages) {
      const children = await scanPageForPdfs(page);
      childQueue.push(...children);
    }

    // Second pass: scan a limited number of child pages
    childQueue = Array.from(new Set(childQueue)).slice(0, 6);
    for (const page of childQueue) {
      await scanPageForPdfs(page);
    }

    // Sort by score desc, then take top unique
    pdfCandidates.sort((a, b) => (b.score - a.score));
    const seen = new Set();
    const pdfLinks = [];
    for (const c of pdfCandidates) {
      if (!c || !c.url) continue;
      if (seen.has(c.url)) continue;
      seen.add(c.url);
      pdfLinks.push(c.url);
      if (pdfLinks.length >= 6) break;
    }

    // Store links in session; question extraction is done in ask-question
    sess.papers_loaded = true;
    sess.pdf_links = pdfLinks;

    return json(200, {
      ok: true,
      session_id: sessionId,
      subject: sess.subject,
      term: sess.term,
      paper_count: sess.pdf_links.length,
      pdf_links: sess.pdf_links
    });
  } catch (e) {
    return json(500, { error: 'Failed to fetch papers' });
  }
};
