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

function isProbablyPdf(u) {
  const ul = String(u || '').toLowerCase();
  if (!ul.startsWith('http')) return false;
  return ul.includes('.pdf');
}

function jinaProxyUrl(url) {
  const u = String(url || '');
  if (u.startsWith('https://')) return 'https://r.jina.ai/https://' + u.slice('https://'.length);
  if (u.startsWith('http://')) return 'https://r.jina.ai/http://' + u.slice('http://'.length);
  return null;
}

async function fetchHtml(url) {
  const timeoutMs = 20000;
  const headers = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
    'referer': 'https://pastpapers.wiki/'
  };

  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const direct = (attempt === 0);
      const proxy = jinaProxyUrl(url);
      const targetUrl = direct ? url : (proxy || url);

      const res = await axios.get(targetUrl, {
        timeout: timeoutMs,
        headers,
        maxContentLength: 2 * 1024 * 1024,
        maxBodyLength: 2 * 1024 * 1024,
        validateStatus: () => true
      });

      if (!res || typeof res.status !== 'number') throw new Error('BAD_RESPONSE');
      if (res.status === 403 || res.status === 429) {
        const err = new Error('HTTP_' + res.status);
        err.status = res.status;
        err.url = targetUrl;
        err.bodySnippet = typeof res.data === 'string' ? res.data.slice(0, 300) : null;
        throw err;
      }

      if (res.status >= 400) {
        const err = new Error('HTTP_' + res.status);
        err.status = res.status;
        err.url = targetUrl;
        err.bodySnippet = typeof res.data === 'string' ? res.data.slice(0, 300) : null;
        throw err;
      }

      return String(res.data || '');
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('FETCH_FAILED');
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
    let seedHtml = '';
    try {
      seedHtml = await fetchHtml(seed);
    } catch (e) {
      const status = (e && (e.status || (e.response && e.response.status))) ? (e.status || e.response.status) : null;
      const code = (e && e.code) ? String(e.code) : null;
      const msg = (e && e.message) ? String(e.message) : 'Failed to fetch seed page';
      const url = (e && e.url) ? String(e.url) : seed;
      const bodySnippet = (e && e.bodySnippet) ? String(e.bodySnippet) : null;

      // Graceful fallback: don't crash Exam Mode; allow frontend to proceed to ask-question fallback.
      sess.papers_loaded = true;
      sess.pdf_links = [];
      return json(200, {
        ok: false,
        session_id: sessionId,
        subject: sess.subject,
        term: sess.term,
        paper_count: 0,
        pdf_links: [],
        error: 'Failed to fetch papers',
        detail: msg,
        status,
        code,
        url,
        bodySnippet
      });
    }

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

    const fallbackTopPages = links
      .filter(u => isProbablyHtmlPage(u))
      .slice(0, 8);

    const candidatePages = likelySubjectPages.length ? likelySubjectPages : fallbackTopPages.length ? fallbackTopPages : [seed];

    const pdfCandidates = [];

    const visitedPages = new Set();

    async function scanPageForPdfs(pageUrl) {
      if (!pageUrl || visitedPages.has(pageUrl)) return [];
      visitedPages.add(pageUrl);

      let html = '';
      try {
        html = await fetchHtml(pageUrl);
      } catch (e) {
        // Skip pages that fail (403/429/timeout/etc). We'll try other pages.
        return [];
      }
      const pageLinks = extractLinks(html)
        .map(h => absoluteUrl(pageUrl, h))
        .filter(Boolean);

      const discoveredChildPages = [];
      for (const u of pageLinks) {
        const ul = u.toLowerCase();

        if (isProbablyPdf(ul)) {
          let score = 0;
          if (urlHasAny(ul, subjAliases) || urlHasAny(u, subjAliases)) score += 2;
          if (urlHasAny(ul, tAliases) || urlHasAny(u, tAliases)) score += 1;
          pdfCandidates.push({ url: u, score });
          continue;
        }

        // queue one level deep pages that look relevant
        if (isProbablyHtmlPage(u)) {
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

    // Fallback: if still empty, scan the seed page's links directly for any PDFs
    if (pdfCandidates.length === 0) {
      for (const u of links) {
        const ul = String(u || '').toLowerCase();
        if (!isProbablyPdf(ul)) continue;
        let score = 0;
        if (urlHasAny(ul, subjAliases)) score += 2;
        if (urlHasAny(ul, tAliases)) score += 1;
        pdfCandidates.push({ url: u, score });
      }
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
      pdf_links: sess.pdf_links,
      visited_pages: payload && payload.debug ? visitedPages.size : undefined,
      candidate_pages: payload && payload.debug ? candidatePages.length : undefined
    });
  } catch (e) {
    const status = (e && (e.status || (e.response && e.response.status))) ? (e.status || e.response.status) : null;
    const code = (e && e.code) ? String(e.code) : null;
    const msg = (e && e.message) ? String(e.message) : 'Failed to fetch papers';
    const url = (e && e.url) ? String(e.url) : null;
    const bodySnippet = (e && e.bodySnippet) ? String(e.bodySnippet) : null;

    // Graceful fallback: don't hard-fail Exam Mode.
    sess.papers_loaded = true;
    sess.pdf_links = [];
    return json(200, {
      ok: false,
      session_id: sessionId,
      subject: sess.subject,
      term: sess.term,
      paper_count: 0,
      pdf_links: [],
      error: 'Failed to fetch papers',
      detail: msg,
      status,
      code,
      url,
      bodySnippet
    });
  }
};
