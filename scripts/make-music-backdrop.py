"""Cut SpongeBob out for the /music page: one source picture -> one WebP with alpha.

The picture beside the /music heading (`.music-backdrop`,
components/lists/MusicList.tsx) is SpongeBob on nothing. The source has no real
transparency: its "transparent" checkerboard is painted into the pixels, grey
and white squares (~229 and ~254), both neutral (chroma <= 3), plus a few faint
near-white ghosts of the same colour. So the background is found by flooding
inward from the picture's edges over pixels like that. His
white shirt, socks and cord are just as white, but each sits inside a drawn
outline the flood cannot cross, so they stay.

The edge is matted rather than cut: in a band RIM pixels deep, a pixel's
opacity is read from how far it is from the checkerboard square next to it
(grey or white, whichever it touches) toward the darkest outline near it, and
its colour is un-mixed from that square, so the outline carries no pale or grey
fringe onto the page. Checkerboard he fully encloses is listed in POCKETS. Then
the result is cropped to him, with a little room. Judge a new run on a dark
page, magnified: a white rim is invisible on white.

Run by hand when the source changes — not part of the build:

    python3 -m venv /tmp/backdrop-venv
    /tmp/backdrop-venv/bin/pip install numpy pillow scipy
    /tmp/backdrop-venv/bin/python scripts/make-music-backdrop.py

Source: assets/art/music-backdrop.webp. Output: public/art/music-backdrop.webp
(him), public/art/music-backdrop-cord.webp (the cord and iPod below the fork,
which swing on their own) and lib/music-backdrop.json (where they join).
See docs/MUSIC.md and docs/DECISIONS.md #199.
"""

import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets/art/music-backdrop.webp"
OUT = ROOT / "public/art/music-backdrop.webp"
OUT_CORD = ROOT / "public/art/music-backdrop-cord.webp"
GEOMETRY = ROOT / "lib/music-backdrop.json"

# What counts as painted-in background: light and colourless. The grey squares
# sit at ~229; his outlines, the cord's included, are 160 and darker.
BG_MIN = 218  # darkest channel at least this
BG_CHROMA = 10  # max - min channel at most this
INK = 140.0  # an outline pixel: fully opaque from here down (at most)
PAD = 12  # room left round him after the crop, in source pixels
RIM = 5  # how deep into him the edge is matted, in source pixels
WHITE_MIN = 30  # smallest enclosed white that counts as his (a shoe's shine is 42)

# The hanging layer: the cord's fork (source px), the pendulum's pivot, and
# everything below it that is joined to it. Re-pick if the source changes.
FORK = (432, 442)
STUB = 8  # rows of cord the body keeps below the fork, under the hanging layer

# Checkerboard his limbs close off from the edge, so the flood never reaches
# it: one (x, y) source point inside each pocket. Between the cord's two
# branches under his hand; between his legs, shoes and body. Re-pick these if
# the source changes (a pocket shows as a pale patch on a dark page). Never
# pick an enclosed white that is part of him — the shine on each shoe is one.
POCKETS = [
    (445, 411),  # inside the cord's Y
    (741, 355),  # between the far shoe and his body
    (694, 354), (705, 354),  # under his body, behind the near leg
]


def main():
    rgb = np.asarray(Image.open(SOURCE).convert("RGB"), dtype=np.float32)
    lo, hi = rgb.min(axis=2), rgb.max(axis=2)
    bg_like = (lo >= BG_MIN) & (hi - lo <= BG_CHROMA)

    # Only background-like pixels REACHABLE from the edge, or from a listed
    # pocket, are background.
    labels, _ = ndi.label(bg_like)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    seeds = np.array([labels[y, x] for x, y in POCKETS])
    if (seeds == 0).any():
        raise SystemExit(f"a POCKETS point is not on background: {POCKETS[int(np.argmin(seeds))]}")
    subject = ~np.isin(labels, np.concatenate([edge[edge > 0], seeds]))
    # Drop stray specks of checkerboard the flood could not reach.
    parts, count = ndi.label(subject)
    sizes = ndi.sum(subject, parts, range(1, count + 1))
    subject = np.isin(parts, 1 + np.flatnonzero(sizes > 200))

    # Matte the boundary against the checkerboard square it touches: each
    # pixel's backdrop is the nearest background pixel's value.
    _, (iy, ix) = ndi.distance_transform_edt(subject, return_indices=True)
    backdrop = lo[iy, ix]
    # ...and its ink is the darkest outline pixel near it, never lighter than
    # INK: a black shoe's edge read against INK came out as a grey rim.
    ink = np.minimum(ndi.grey_erosion(np.where(subject, lo, 255.0), size=7), INK)
    matte = np.clip((backdrop - 4.0 - lo) / (backdrop - ink), 0.0, 1.0)
    # The band is RIM deep, walked from the outside in, and a pixel is never
    # more see-through than the most opaque neighbour one step further out.
    # So a pale fringe OUTSIDE the outline fades away, while whatever is inside
    # a solid outline stays solid. His own whites the flood never reached (the
    # cord's core, the shine on his shoes) are him outright and stay opaque:
    # the cord's outline is faint in places, and reading the core through it
    # striped the cord.
    depth = ndi.distance_transform_cdt(subject, metric="chessboard")
    outside = ndi.binary_dilation(subject, iterations=1) & ~subject
    alpha = np.where(subject, 1.0, 0.0).astype(np.float32)
    alpha[outside] = matte[outside]
    # Crumbs of checkerboard under WHITE_MIN pixels are not his and still fade.
    own, count = ndi.label(bg_like & subject)
    sizes = ndi.sum(own > 0, own, range(1, count + 1))
    own_white = np.isin(own, 1 + np.flatnonzero(sizes >= WHITE_MIN))
    for k in range(1, RIM + 1):
        step = subject & (depth == k) & ~own_white
        floor = ndi.grey_dilation(np.where(depth == k - 1, alpha, 0.0), size=3)
        alpha[step] = np.maximum(matte[step], floor[step])
    a = alpha[..., None]
    colour = np.clip((rgb - (1.0 - a) * backdrop[..., None]) / np.maximum(a, 1e-3), 0, 255)
    colour[alpha == 0] = 0

    ys, xs = np.nonzero(alpha > 0.02)
    top, bottom = max(ys.min() - PAD, 0), min(ys.max() + PAD + 1, rgb.shape[0])
    left, right = max(xs.min() - PAD, 0), min(xs.max() + PAD + 1, rgb.shape[1])
    rgba = np.dstack([colour, a * 255])

    # Two layers, cut where the cord's branches join: the hanging cord and
    # iPod swing as a pendulum from the fork (components/MusicBackdrop.tsx),
    # so they cannot be painted into him. The body keeps STUB rows of cord
    # below the fork, under the hanging layer's top, so a swing never opens
    # a gap at the joint.
    fx, fy = FORK
    ys_all = np.arange(rgb.shape[0])[:, None]
    # Whatever hangs from the fork: below it and joined to it, which leaves
    # out his near hand (a gap of nothing away, left of the cord).
    parts, _ = ndi.label((alpha > 0.02) & (ys_all >= fy))
    below = parts == parts[fy + 2, fx]
    if not below[fy + 2, fx]:
        raise SystemExit(f"FORK {FORK} is not on the cord")
    cord = np.where(below[..., None], rgba, 0)
    body = np.where((below & (ys_all >= fy + STUB))[..., None], 0, rgba)

    cy, cx = np.nonzero(cord[..., 3] > 0.02 * 255)
    ct, cb, cl, cr = cy.min(), cy.max() + 1, cx.min(), cx.max() + 1
    # The iPod is the weight on the string: its dark pixels' centre.
    heavy = (cord[..., 3] > 128) & (lo < 90)
    by, bx = np.nonzero(heavy)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    save(body[top:bottom, left:right], OUT)
    save(cord[ct:cb, cl:cr], OUT_CORD)
    geometry = {
        "note": "Written by scripts/make-music-backdrop.py; px of the body picture.",
        "width": int(right - left),
        "height": int(bottom - top),
        "cord": {"left": int(cl - left), "top": int(ct - top),
                 "width": int(cr - cl), "height": int(cb - ct)},
        "pivot": {"x": int(fx - left), "y": int(fy - top)},
        "bob": {"x": round(float(bx.mean()) - left, 1), "y": round(float(by.mean()) - top, 1)},
    }
    GEOMETRY.write_text(json.dumps(geometry, indent=2) + "\n")
    print(json.dumps(geometry))


def save(rgba, path):
    Image.fromarray((rgba + 0.5).astype(np.uint8)).save(path, "WEBP", quality=90, method=6)
    h, w = rgba.shape[:2]
    print(f"{path.relative_to(ROOT)}  {w}x{h}  {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
