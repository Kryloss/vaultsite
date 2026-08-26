#!/usr/bin/env python3
"""Render vault/Now/Kyrylo Leshchenko Resume.pdf from the `## Résumé` section of
vault/Now/main.md.

Single source of truth: the Now page and the PDF read the same note, so editing
it updates both — including the contact line, which is email and city only.
Nothing personal goes in this file; see the note above `contact`.

The markdown format is documented in the note itself and parsed for the website
by lib/now-content.ts; parse_resume() below is that parser's English-only twin,
kept small on purpose (the PDF needs no Ukrainian, links, or goals).

Run manually after editing the résumé (NOT part of the build):

    DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib \
        ~/.venvs/vaultsite-resume/bin/python scripts/build-resume-pdf.py

`pip install weasyprint` on its own is NOT enough, for three reasons that each
fail differently:

  * WeasyPrint needs native Pango/cairo (`brew install pango`), and macOS' loader
    will not find Homebrew's copies without DYLD_FALLBACK_LIBRARY_PATH — without
    it the import dies on libgobject-2.0-0.
  * Install into a venv, not system python (there is no `pip` on PATH, only a
    `pip3` pointing into Xcode's Python 3.9). Keep the venv OUTSIDE the repo:
    Obsidian Git auto-commits everything it finds here.
  * **Lato must be installed as a system font** (`brew install --cask
    font-lato`). This is the quiet one: the CSS below asks for Lato and falls
    back to DejaVu Sans, which is wider — the résumé silently spills onto a
    SECOND PAGE and nothing warns you. If the output grows a page, check the
    font before touching the layout.

Verify a rebuild by diffing the extracted text against the committed PDF
(`git show HEAD:"vault/Now/Kyrylo Leshchenko Resume.pdf"`) — the only difference
should be the edit you just made.

The regenerated PDF sits in the vault, so sync-assets.mjs publishes it at
/vault-assets/Now/... and the download button on the Now page picks it up.
"""
import re
import sys
import html
import unicodedata
from pathlib import Path

from weasyprint import HTML

VAULT = Path(__file__).resolve().parent.parent / "vault"
SRC = VAULT / "Now" / "main.md"
OUT = VAULT / "Now" / "Kyrylo Leshchenko Resume.pdf"

# No phone number and no street address, here or in the vault. This PDF is
# downloadable from a public page, so it carries exactly what the page carries:
# email and city. Add the rest by hand to a copy you send to an employer.

HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
BULLET = re.compile(r"^(\s*)[-*+]\s+(?!\[[ xX]\])(.*)$")
# `### <heading>` → key in the résumé dict. Mirrors RESUME_HEADINGS in
# lib/now-content.ts; Ukrainian spellings are accepted for symmetry.
BLOCKS = {
    "experience": "experience",
    "work": "experience",
    "досвід": "experience",
    "досвід роботи": "experience",
    "education": "education",
    "освіта": "education",
    "certifications": "certifications",
    "сертифікації": "certifications",
    "strengths": "skills",
    "skills": "skills",
    "сильні сторони": "skills",
    "навички": "skills",
    "languages": "languages",
    "мови": "languages",
    "contact": "contact",
    "contacts": "contact",
    "контакти": "contact",
}
ROW_BLOCKS = ("experience", "education", "certifications")


def key(text):
    """Fold a heading for matching: case, accents and punctuation don't count."""
    stripped = "".join(
        c for c in unicodedata.normalize("NFD", text) if not unicodedata.combining(c)
    )
    return re.sub(r"[^\w]+", " ", stripped, flags=re.U).strip().lower()


def plain(text):
    """Markdown inline syntax → the plain text the résumé prints."""
    text = re.sub(r"\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]", lambda m: m[2] or m[1], text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"(\*\*|__)(.+?)\1", r"\2", text)
    text = re.sub(r"(?<!\w)([*_])(?!\s)(.+?)(?<!\s)\1(?!\w)", r"\2", text)
    return re.sub(r"\s+", " ", text).strip()


def strip_link(text):
    """Drops a trailing "→ [[Note]]" — the PDF has nowhere to click."""
    return re.sub(r"\s*(?:→|➔|->)\s*(?:!?\[\[[^\]]*\]\]|\[[^\]]*\]\([^)]*\)|\S+)$", "", text)


def sections(lines, level):
    """Groups lines under their `#`×level heading; deeper headings stay inside."""
    out, body = [], None
    for line in lines:
        m = HEADING.match(line)
        if m:
            depth = len(m[1])
            if depth == level:
                body = []
                out.append((m[2], body))
                continue
            if depth < level:
                body = None
                continue
        if body is not None:
            body.append(line)
    return out


def parse_rows(lines):
    rows = []
    for heading, body in sections(lines, 4):
        parts = [p for p in re.split(r"\s+·\s+", strip_link(heading).strip()) if p]
        row = {"role": plain(parts[0])} if parts else {}
        if len(parts) > 1:
            row["org"] = plain(" · ".join(parts[1:]))
        points, sub_seen = [], False
        for line in body:
            if not line.strip():
                continue
            bullet = BULLET.match(line)
            if bullet:
                points.append(plain(bullet[2]))
            elif not sub_seen and not points:
                sub_seen = True
                rest = re.sub(r"(?:^|\s)#current\b", " ", line.strip(), flags=re.I).strip()
                period = re.match(r"^(?:\*([^*]+)\*|_([^_]+)_)", rest)
                if period:
                    row["period"] = plain(period[1] or period[2])
                    rest = re.sub(r"^\s*[·|—–-]\s*", "", rest[period.end() :])
                if plain(rest):
                    row["meta"] = plain(rest)
        if points:
            row["points"] = points
        rows.append(row)
    return rows


def parse_resume(markdown):
    """`## Résumé` → the same dict shape the frontmatter used to hold."""
    lines = re.sub(r"%%.*?%%", "", markdown, flags=re.S).splitlines()
    body = next(
        (b for h, b in sections(lines, 2) if key(h) in ("resume", "cv", "резюме")), None
    )
    if body is None:
        sys.exit("no '## Résumé' section found in vault/Now/main.md")

    resume = {}
    summary = []
    for line in body:
        if HEADING.match(line):
            break
        summary.append(line)
    if plain(" ".join(summary)):
        resume["summary"] = plain(" ".join(summary))

    for heading, block in sections(body, 3):
        field = BLOCKS.get(key(heading))
        if not field:
            print(f"[resume] skipping unknown heading '### {heading}'")
            continue
        if field in ROW_BLOCKS:
            resume[field] = parse_rows(block)
            continue
        items = [plain(m[2]) for m in map(BULLET.match, block) if m and not m[1]]
        if field == "contact":
            email = next((i for i in items if re.search(r"\S+@\S+\.\S+", i)), None)
            resume["contact"] = {}
            if email:
                resume["contact"]["email"] = re.search(r"\S+@\S+\.\S+", email)[0]
            location = next((i for i in items if i != email), None)
            if location:
                resume["contact"]["location"] = location
        else:
            resume[field] = items

    return resume


r = parse_resume(SRC.read_text(encoding="utf-8"))

E = lambda s: html.escape(str(s))


def point(p):
    """'Label — detail' → bold lead-in, same convention as the web component."""
    if " — " in p:
        label, rest = p.split(" — ", 1)
        return f"<strong>{E(label)}</strong> — {E(rest)}"
    return E(p)


def rows(items):
    out = []
    for it in items:
        head = E(it.get("role", ""))
        if it.get("org"):
            head += f' <span class="org">· {E(it["org"])}</span>'
        period = f'<span class="period">{E(it["period"])}</span>' if it.get("period") else ""
        sub = it.get("meta") or it.get("note")
        sub_html = f'<div class="sub">{E(sub)}</div>' if sub else ""
        bullets = ""
        if it.get("points"):
            lis = "".join(f"<li>{point(p)}</li>" for p in it["points"])
            bullets = f"<ul>{lis}</ul>"
        out.append(
            f'<div class="row"><div class="row-head"><h4>{head}</h4>{period}</div>'
            f"{sub_html}{bullets}</div>"
        )
    return "".join(out)


def section(label, body):
    return f'<section class="blk"><h3>{E(label)}</h3><div class="body">{body}</div></section>'


contact = r.get("contact", {})
contact_line = " · ".join(
    E(v) for v in (contact.get("email"), contact.get("location")) if v
)

blocks = [
    section("Experience", rows(r.get("experience", []))),
    section("Education", rows(r.get("education", []))),
]
if r.get("certifications"):
    blocks.append(section("Certifications", rows(r["certifications"])))
blocks.append(
    section("Strengths", "<ul class='flat'>" + "".join(f"<li>{point(s)}</li>" for s in r.get("skills", [])) + "</ul>")
)
blocks.append(
    section("Languages", '<p class="langs">' + " · ".join(E(l) for l in r.get("languages", [])) + "</p>")
)

doc = f"""<!doctype html>
<html><head><meta charset="utf-8"><style>
@page {{ size: Letter; margin: 14mm 16mm; }}
* {{ box-sizing: border-box; }}
body {{
  font-family: Lato, "DejaVu Sans", sans-serif;
  font-size: 9.3pt; line-height: 1.45; color: #1b1b1f; margin: 0;
}}
h1 {{ font-size: 21pt; font-weight: 700; letter-spacing: -.4pt; margin: 0; color: #101014; }}
.summary {{ margin: 5pt 0 0; color: #4b4b55; max-width: 150mm; }}
.contact {{ margin: 6pt 0 0; font-size: 8.4pt; color: #6a6a75; }}
hr {{ border: 0; border-top: .6pt solid #d9d9de; margin: 11pt 0 0; }}
.blk {{ display: flex; gap: 10mm; padding: 9pt 0 0; break-inside: avoid-page; }}
.blk h3 {{
  flex: 0 0 24mm; min-width: 0; margin: 1pt 0 0; font-size: 7.6pt; font-weight: 700;
  letter-spacing: .9pt; text-transform: uppercase; color: #8c8c96;
}}
.body {{ flex: 1; min-width: 0; }}
.row {{ padding-bottom: 8pt; break-inside: avoid-page; }}
.row:last-child {{ padding-bottom: 0; }}
.row-head {{ display: flex; justify-content: space-between; align-items: baseline; gap: 6mm; }}
h4 {{ margin: 0; font-size: 10pt; font-weight: 700; color: #101014; }}
.org {{ font-weight: 400; color: #4b4b55; }}
.period {{ font-size: 8.2pt; color: #8c8c96; white-space: nowrap; }}
.sub {{ font-size: 8.4pt; color: #8c8c96; margin-top: .5pt; }}
ul {{ margin: 3.5pt 0 0; padding-left: 11pt; }}
ul.flat {{ margin-top: 0; }}
li {{ margin-bottom: 2.5pt; color: #4b4b55; }}
li::marker {{ color: #b4b4bc; }}
strong {{ color: #101014; font-weight: 700; }}
.langs {{ margin: 0; color: #4b4b55; }}
</style></head><body>
<h1>Kyrylo Leshchenko</h1>
<p class="summary">{E(r.get("summary", ""))}</p>
<p class="contact">{contact_line}</p>
<hr>
{"".join(blocks)}
</body></html>"""

OUT.parent.mkdir(parents=True, exist_ok=True)
HTML(string=doc).write_pdf(OUT)
print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.1f} KB)")
