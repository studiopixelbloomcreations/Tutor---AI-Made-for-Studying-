from __future__ import annotations
import io
import re
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://pastpapers.wiki"
GRADE9_START_URL = "https://pastpapers.wiki/grade-09-term-test-papers-past-papers-short-notes-2/"


class ScrapeError(Exception):
    pass


def _get(url: str) -> BeautifulSoup:
    headers = {
        "User-Agent": "TutorAI-ExamMode/1.0 (+https://example.com)"
    }
    r = requests.get(url, headers=headers, timeout=20)
    if r.status_code != 200:
        raise ScrapeError(f"HTTP {r.status_code} for {url}")
    return BeautifulSoup(r.text, "lxml")


def _normalize_term(term: str) -> str:
    t = (term or '').strip().lower()
    if t.startswith('first'): return 'First Term'
    if t.startswith('second'): return 'Second Term'
    if t.startswith('third'): return 'Third Term'
    return term


def _find_grade9_subject_page(subject: str) -> Optional[str]:
    # Strategy: start from the known Grade 9 term-test page and find a subject link.
    # This is heuristic and may need selector tweaks if the site structure changes.
    g9 = _get(GRADE9_START_URL)
    subject_key = (subject or '').strip().lower()
    subj_link = None
    for a in g9.select('a[href]'):
        text = (a.get_text() or '').strip().lower()
        href = a['href']
        if subject_key and subject_key in text:
            subj_link = href
            break
    if not subj_link:
        return None
    if subj_link.startswith('/'):
        subj_link = BASE_URL + subj_link
    return subj_link


def _filter_term_links(soup: BeautifulSoup, term: str) -> List[str]:
    term_norm = _normalize_term(term)
    links = []
    for a in soup.select('a[href]'):
        text = (a.get_text() or '').strip()
        href = a['href']
        if term_norm.lower() in text.lower():
            links.append(href)
    # Fallback: include all links if no explicit term segmentation
    if not links:
        links = [a['href'] for a in soup.select('a[href]')]
    # Normalize
    clean = []
    for href in links:
        if href.startswith('/'):
            href = BASE_URL + href
        if href.startswith(BASE_URL):
            clean.append(href)
    return list(dict.fromkeys(clean))  # dedupe, preserve order


def _extract_year_from_title(text: str) -> Optional[int]:
    m = re.search(r'(20\d{2}|19\d{2})', text or '')
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            return None
    return None


def _parse_question_blocks(soup: BeautifulSoup) -> List[str]:
    # Heuristic parsing: look for elements that commonly contain questions.
    # Adjust based on real site structure.
    blocks: List[str] = []
    selectors = [
        'ol li',
        '.question',
        '.q',
        'p',
    ]
    for sel in selectors:
        for el in soup.select(sel):
            txt = ' '.join((el.get_text(separator=' ') or '').split())
            if len(txt) >= 12 and any(ch.isalpha() for ch in txt):
                blocks.append(txt)
        if blocks:
            break
    # Deduplicate while preserving order
    seen = set()
    result = []
    for b in blocks:
        if b not in seen:
            seen.add(b)
            result.append(b)
    return result


def _extract_pdf_links(soup: BeautifulSoup) -> List[str]:
    links: List[str] = []
    for a in soup.select('a[href]'):
        href = (a.get('href') or '').strip()
        if not href:
            continue
        hlow = href.lower()
        if '.pdf' in hlow:
            if href.startswith('/'):
                href = BASE_URL + href
            links.append(href)
    # De-duplicate while preserving order
    clean: List[str] = []
    seen = set()
    for u in links:
        if u not in seen:
            seen.add(u)
            clean.append(u)
    return clean


def _download_pdf_bytes(url: str) -> bytes:
    headers = {
        "User-Agent": "TutorAI-ExamMode/1.0 (+https://example.com)"
    }
    r = requests.get(url, headers=headers, timeout=35)
    if r.status_code != 200:
        raise ScrapeError(f"HTTP {r.status_code} for {url}")
    ctype = (r.headers.get('Content-Type') or '').lower()
    if 'pdf' not in ctype and not url.lower().endswith('.pdf'):
        # Some servers don't set content-type correctly, so we only hard-fail
        # when it doesn't look like a PDF URL.
        raise ScrapeError(f"Not a PDF response for {url} (Content-Type={ctype})")
    return r.content


def _extract_text_from_pdf(pdf_bytes: bytes) -> str:
    try:
        from pypdf import PdfReader  # type: ignore
    except Exception as e:
        raise ScrapeError("pypdf is not available; install requirements") from e

    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))  # type: ignore[name-defined]
    except Exception as e:
        raise ScrapeError("Failed to open PDF") from e

    chunks: List[str] = []
    for p in reader.pages[:25]:
        try:
            t = p.extract_text() or ''
        except Exception:
            t = ''
        if t:
            chunks.append(t)
    return "\n".join(chunks)


def _parse_questions_from_text(text: str) -> List[str]:
    # Normalize whitespace but keep line breaks for better parsing.
    raw_lines = [ln.strip() for ln in (text or '').splitlines()]
    raw_lines = [ln for ln in raw_lines if ln]
    joined = "\n".join(raw_lines)

    # Split at common question markers.
    # Examples: "1.", "1)", "Q1", "Question 1"
    pattern = re.compile(
        r"(?:^|\n)\s*(?:Q\s*\d+|Question\s*\d+|\d{1,2}\s*[\).]|\d{1,2}\s*\.)\s+",
        flags=re.IGNORECASE,
    )

    parts = pattern.split(joined)
    # The split removes markers; the first chunk is usually preamble.
    candidates = [p.strip() for p in parts[1:] if p and p.strip()]

    questions: List[str] = []
    for c in candidates:
        # Stop at very long chunks; keep it question-like.
        c = re.sub(r"\s+", " ", c).strip()
        if len(c) < 20:
            continue
        if len(c) > 900:
            c = c[:900].rsplit(' ', 1)[0] + '…'
        questions.append(c)

    # De-dup preserve order
    seen = set()
    out: List[str] = []
    for q in questions:
        if q not in seen:
            seen.add(q)
            out.append(q)
    return out


def scrape_papers_dynamic(subject: str, term: str) -> Dict[int, List[dict]]:
    """
    Scrape pastpapers.wiki for Grade 9 -> subject -> term.
    Returns: { year: [ {id, year, subject, term, text, type, choices, answer}, ...] }
    """
    subj_page = _find_grade9_subject_page(subject)
    if not subj_page:
        raise ScrapeError("Could not locate Grade 9 subject page")

    soup = _get(subj_page)
    term_links = _filter_term_links(soup, term)

    year_to_questions: Dict[int, List[dict]] = {}
    qid = 1
    subject_norm = subject
    term_norm = _normalize_term(term)

    for link in term_links[:12]:  # limit traversal depth
        try:
            page = _get(link)
        except ScrapeError:
            continue
        title_text = page.title.get_text() if page.title else ''
        year = _extract_year_from_title(title_text) or _extract_year_from_title(link) or 0

        # Prefer PDFs (real scanning). If no PDFs exist, fallback to HTML parsing.
        questions_text: List[str] = []
        pdf_links = _extract_pdf_links(page)
        if pdf_links:
            # Download and parse a few PDFs to avoid long delays.
            for pdf_url in pdf_links[:3]:
                try:
                    pdf_bytes = _download_pdf_bytes(pdf_url)
                    pdf_text = _extract_text_from_pdf(pdf_bytes)
                    parsed = _parse_questions_from_text(pdf_text)
                    if parsed:
                        questions_text.extend(parsed)
                except Exception:
                    continue

        if not questions_text:
            questions_text = _parse_question_blocks(page)
        if not questions_text:
            continue

        qlist: List[dict] = []
        for idx, qt in enumerate(questions_text, start=1):
            qlist.append({
                "id": f"{year or 'u'}-{qid}",
                "year": int(year) if year else 0,
                "subject": subject_norm,
                "term": term_norm,
                "text": qt,
                "type": "general",
                "choices": None,
                "answer": None,
            })
            qid += 1
        if qlist:
            year_key = int(year) if year else 0
            year_to_questions.setdefault(year_key, []).extend(qlist)

    # Drop year 0 bucket if we found at least one valid year elsewhere
    if 0 in year_to_questions and any(y for y in year_to_questions.keys() if y != 0):
        if not year_to_questions[0]:
            year_to_questions.pop(0, None)

    if not year_to_questions:
        raise ScrapeError("No questions found for the selected subject/term")

    return year_to_questions
