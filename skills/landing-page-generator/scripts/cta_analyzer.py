#!/usr/bin/env python3
"""
Landing Page CTA Analyzer

Analyzes CTA placement, copy strength, friction level,
and conversion optimization on landing pages.

Usage:
    python cta_analyzer.py page.html
    python cta_analyzer.py page.html --json
"""

import argparse
import json
import re
import sys
from pathlib import Path

# Matches <button> elements, and <a>/<div>/<span> elements with btn/button/cta classes or role="button"
CTA_ELEMENT_PATTERN = re.compile(
    r'<(button|a|div|span)\b[^>]*'
    r'(?:class\s*=\s*"[^"]*\b(?:btn|button|cta)\b[^"]*"|role\s*=\s*"button")'
    r'[^>]*>(.*?)</\1>',
    re.IGNORECASE | re.DOTALL,
)
PLAIN_BUTTON_PATTERN = re.compile(r"<button\b[^>]*>(.*?)</button>", re.IGNORECASE | re.DOTALL)
LINK_CTA_PATTERN = re.compile(r"<a\b[^>]+href[^>]*>(.*?)</a>", re.IGNORECASE | re.DOTALL)
HTML_TAG = re.compile(r"<[^>]+>")

STRONG_VERBS = {"start", "get", "create", "build", "try", "claim", "unlock", "discover", "join", "book", "download", "access"}
WEAK_VERBS = {"submit", "click", "send", "go", "enter", "continue"}
FRICTION_REDUCERS = ["no credit card", "free", "cancel anytime", "no commitment", "money-back", "risk-free", "2 minutes", "instant"]
LINK_CTA_KEYWORDS = ["trial", "demo", "signup", "sign up", "get started", "start free", "book a", "download"]


def extract_ctas(html: str) -> list:
    """Extract CTA elements, deduplicating overlapping matches by position."""
    seen_spans = []
    ctas = []

    def overlaps(start, end):
        return any(s < end and start < e for s, e in seen_spans)

    def add(match, text_group, cta_type):
        text = HTML_TAG.sub("", match.group(text_group)).strip()
        text = re.sub(r"\s+", " ", text)
        start, end = match.start(), match.end()
        if text and len(text) < 60 and not overlaps(start, end):
            seen_spans.append((start, end))
            ctas.append({"text": text, "position_char": start, "type": cta_type})

    # Priority order: styled CTA elements, plain buttons, then CTA-looking links
    for match in CTA_ELEMENT_PATTERN.finditer(html):
        add(match, 2, "button")
    for match in PLAIN_BUTTON_PATTERN.finditer(html):
        add(match, 1, "button")
    for match in LINK_CTA_PATTERN.finditer(html):
        text = HTML_TAG.sub("", match.group(1)).strip().lower()
        tag = match.group(0).lower()
        if any(kw in tag or kw in text for kw in LINK_CTA_KEYWORDS):
            add(match, 1, "link")

    ctas.sort(key=lambda c: c["position_char"])
    return ctas


def analyze_cta(cta_text: str) -> dict:
    lower = cta_text.lower()
    words = lower.split()
    first_word = words[0] if words else ""

    strength = "moderate"
    if first_word in STRONG_VERBS:
        strength = "strong"
    elif first_word in WEAK_VERBS:
        strength = "weak"

    has_ownership = any(w in words for w in ["my", "your"])
    has_benefit = len(words) > 2

    score = 50
    if strength == "strong":
        score += 25
    elif strength == "weak":
        score -= 15
    if has_ownership:
        score += 10
    if has_benefit:
        score += 15

    return {
        "text": cta_text,
        "strength": strength,
        "has_ownership_language": has_ownership,
        "describes_what_you_get": has_benefit,
        "word_count": len(words),
        "score": min(100, max(0, score)),
    }


def body_bounds(html: str):
    """Return (start, length) of the body content so positions ignore <head> bulk.

    Anchor on </head> first: a literal "<body>" can appear earlier in
    comments or scripts and would give a false start position.
    """
    head_end = re.search(r"</head>", html, re.IGNORECASE)
    search_from = head_end.end() if head_end else 0
    match = re.compile(r"<body\b[^>]*>", re.IGNORECASE).search(html, search_from)
    start = match.end() if match else search_from
    end_match = re.search(r"</body>", html, re.IGNORECASE)
    end = end_match.start() if end_match and end_match.start() > start else len(html)
    return start, max(end - start, 1)


def analyze_page(html: str) -> dict:
    ctas = extract_ctas(html)
    body_start, body_len = body_bounds(html)

    # Check for friction reducers
    lower_html = html.lower()
    friction_found = [f for f in FRICTION_REDUCERS if f in lower_html]

    # Position zones relative to BODY content, not raw file offset
    # (head content, inline CSS/JS would otherwise skew positions badly)
    # Above fold = within the first 25% of the body OR the first ~2500 chars
    # of body markup (hero region), whichever is larger. The absolute floor
    # keeps short pages from misclassifying their hero CTA.
    fold_chars = max(body_len * 0.25, 2500)
    cta_analyses = []
    for cta in ctas:
        rel_pos = max(cta["position_char"] - body_start, 0)
        position_pct = rel_pos / body_len * 100
        if rel_pos < fold_chars:
            zone = "above_fold"
        elif position_pct < 70:
            zone = "mid_page"
        else:
            zone = "bottom"
        analysis = analyze_cta(cta["text"])
        analysis["zone"] = zone
        analysis["position_pct"] = round(position_pct, 1)
        cta_analyses.append(analysis)

    # Scoring
    issues = []
    recommendations = []
    score = 50

    # CTA count
    if len(ctas) == 0:
        issues.append("No CTAs found on the page.")
        score -= 30
    elif len(ctas) == 1:
        issues.append("Only 1 CTA. Best practice: 2-3 CTAs throughout the page.")
        score -= 10
    elif 2 <= len(ctas) <= 4:
        score += 15
    else:
        recommendations.append(f"{len(ctas)} CTAs found -- ensure they don't compete. All should drive the same action.")

    # Above fold CTA
    above_fold = [c for c in cta_analyses if c["zone"] == "above_fold"]
    if above_fold:
        score += 15
    else:
        issues.append("No CTA above the fold. Primary CTA must be visible without scrolling.")
        score -= 15

    # CTA consistency
    cta_texts = [c["text"].lower() for c in cta_analyses]
    unique_texts = set(cta_texts)
    if len(unique_texts) > 2 and len(ctas) > 1:
        issues.append(f"{len(unique_texts)} different CTA texts. Use consistent CTAs driving one action.")
        score -= 10

    # Friction reducers
    if friction_found:
        score += 10
        recommendations.append(f"Good: Friction reducers detected: {', '.join(friction_found)}")
    else:
        recommendations.append("Add friction reducers near CTAs: 'No credit card required', 'Free for 14 days', etc.")
        score -= 5

    # CTA strength
    weak_ctas = [c for c in cta_analyses if c["strength"] == "weak"]
    if weak_ctas:
        recommendations.append(f"Strengthen weak CTAs: {', '.join([c['text'] for c in weak_ctas][:3])}")

    score = max(0, min(100, score))

    return {
        "total_ctas": len(ctas),
        "score": score,
        "grade": "A" if score >= 85 else "B" if score >= 70 else "C" if score >= 55 else "D" if score >= 40 else "F",
        "ctas": cta_analyses,
        "friction_reducers_found": friction_found,
        "placement": {
            "above_fold": len(above_fold),
            "mid_page": len([c for c in cta_analyses if c["zone"] == "mid_page"]),
            "bottom": len([c for c in cta_analyses if c["zone"] == "bottom"]),
        },
        "issues": issues,
        "recommendations": recommendations,
    }


def format_human(result: dict) -> str:
    lines = ["\n" + "=" * 55, "  LANDING PAGE CTA ANALYZER", "=" * 55]
    lines.append(f"\n  Score: {result['score']}/100 ({result['grade']}) | CTAs Found: {result['total_ctas']}")
    p = result["placement"]
    lines.append(f"  Placement: Above-fold: {p['above_fold']} | Mid-page: {p['mid_page']} | Bottom: {p['bottom']}")

    if result["ctas"]:
        lines.append("\n  CTA Analysis:")
        for c in result["ctas"]:
            lines.append(f"    \"{c['text']}\" | {c['strength']} | {c['zone']} ({c['position_pct']}%) | Score: {c['score']}")

    if result["issues"]:
        lines.append("\n  Issues:")
        for i in result["issues"]:
            lines.append(f"    ! {i}")

    lines.append("\n  Recommendations:")
    for r in result["recommendations"]:
        lines.append(f"    > {r}")

    lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Analyze CTA placement and quality on landing pages.")
    parser.add_argument("file", help="HTML file")
    parser.add_argument("--json", action="store_true", dest="json_output")
    args = parser.parse_args()

    try:
        html = Path(args.file).read_text(encoding="utf-8", errors="replace")
    except FileNotFoundError:
        print(f"Error: {args.file} not found", file=sys.stderr)
        sys.exit(1)

    result = analyze_page(html)
    if args.json_output:
        print(json.dumps(result, indent=2))
    else:
        print(format_human(result))


if __name__ == "__main__":
    main()
