#!/usr/bin/env python3
"""Render vault/Now/Kyrylo Leshchenko Resume.pdf from the `resume:` block in
vault/Now/main.md.

Single source of truth: the Now page and the PDF read the same frontmatter, so
editing the note updates both — including the contact line, which is email and
city only. Nothing personal goes in this file; see the note above `contact`.

Run manually after editing the resume frontmatter (NOT part of the build):

    pip install weasyprint pyyaml
    python3 scripts/build-resume-pdf.py

The regenerated PDF sits in the vault, so sync-assets.mjs publishes it at
/vault-assets/Now/... and the download button on the Now page picks it up.
"""
import re
import sys
import html
from pathlib import Path

import yaml
from weasyprint import HTML

VAULT = Path(__file__).resolve().parent.parent / "vault"
SRC = VAULT / "Now" / "main.md"
OUT = VAULT / "Now" / "Kyrylo Leshchenko Resume.pdf"

# No phone number and no street address, here or in the vault. This PDF is
# downloadable from a public page, so it carries exactly what the page carries:
# email and city. Add the rest by hand to a copy you send to an employer.

text = SRC.read_text(encoding="utf-8")
fm = re.match(r"^---\n(.*?)\n---", text, re.S)
if not fm:
    sys.exit("no frontmatter found")
meta = yaml.safe_load(fm.group(1))
r = meta["resume"]

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
