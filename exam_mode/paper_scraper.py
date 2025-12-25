from __future__ import annotations
import re
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://paperswiki.com"


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
    # Strategy: navigate from homepage to Grade 9, then find subject link.
    # This is heuristic; adjust selectors/paths to match actual site structure.
    home = _get(BASE_URL)

    # Find Grade 9 link
    grade9_link = None
    for a in home.select('a[href]'):
        text = (a.get_text() or '').strip().lower()
        href = a['href']
        if 'grade 9' in text or 'grade9' in href.lower():
            grade9_link = href
            break
    if not grade9_link:
        return None
    if grade9_link.startswith('/'):
        grade9_link = BASE_URL + grade9_link

    # Find subject link on Grade 9 page
    g9 = _get(grade9_link)
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


def scrape_papers_dynamic(subject: str, term: str) -> Dict[int, List[dict]]:
    """
    Scrape paperswiki.com for Grade 9 -> subject -> term.
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
