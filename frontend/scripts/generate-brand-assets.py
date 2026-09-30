"""Build the AstroNow icon and splash assets.

The app icon comes from the supplied artwork (assets/images/brand/source-star.png).
The splash mark is the same eight-point star drawn from geometry, so it lines up
exactly with the vector mark in src/components/BrandMark.tsx.

Run with a Python that has Pillow and numpy: python scripts/generate-brand-assets.py
"""

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "assets" / "images"
OUT = IMAGES / "brand"

# ---------- App icon, from the artwork ----------
# The artwork is a rounded tile on a dark backdrop. Crop to the tile, then fill
# the four corners from a blurred copy so the icon is full-bleed (iOS and
# Android apply their own corner masks).
TILE = (95, 82, 1159, 1146)
art = Image.open(OUT / "source-star.png").convert("RGB").crop(TILE).resize((1024, 1024), Image.Resampling.LANCZOS)
fill = art.resize((1180, 1180), Image.Resampling.BICUBIC).crop((78, 78, 1102, 1102)).filter(ImageFilter.GaussianBlur(60))
mask = Image.new("L", (1024, 1024), 0)
ImageDraw.Draw(mask).rounded_rectangle((14, 14, 1010, 1010), radius=205, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(10))
icon = Image.composite(art, fill, mask)
icon.save(OUT / "icon.png")
# app.json uses this second path so Expo Go cannot reuse an old icon URL.
icon.save(IMAGES / "icon.png")
icon.resize((128, 128), Image.Resampling.LANCZOS).save(OUT / "favicon.png")
icon.resize((128, 128), Image.Resampling.LANCZOS).save(IMAGES / "favicon.png")

# Android adaptive icon: only the middle two thirds is always visible, so the
# tile sits at 84% on a blurred extension of itself.
backdrop = icon.resize((1400, 1400), Image.Resampling.BICUBIC).crop((188, 188, 1212, 1212)).filter(ImageFilter.GaussianBlur(40))
inner = icon.resize((860, 860), Image.Resampling.LANCZOS)
edge = Image.new("L", (860, 860), 0)
ImageDraw.Draw(edge).rectangle((40, 40, 820, 820), fill=255)
edge = edge.filter(ImageFilter.GaussianBlur(24))
adaptive = backdrop.copy()
adaptive.paste(inner, (82, 82), edge)
adaptive.save(OUT / "adaptive-foreground.png")
adaptive.save(IMAGES / "adaptive-icon.png")


# ---------- Star mark, from geometry (keep in sync with BrandMark.tsx) ----------
def star_points(cx, cy, long_v, long_h, waist):
    return [(cx, cy - long_v), (cx + waist, cy - waist), (cx + long_h, cy), (cx + waist, cy + waist),
            (cx, cy + long_v), (cx - waist, cy + waist), (cx - long_h, cy), (cx - waist, cy - waist)]


def diagonal_points(cx, cy, reach, waist):
    d = reach / math.sqrt(2)
    return [(cx + d, cy - d), (cx + waist, cy), (cx + d, cy + d), (cx, cy + waist),
            (cx - d, cy + d), (cx - waist, cy), (cx - d, cy - d), (cx, cy - waist)]


def radial(size, stops):
    """RGBA radial gradient; stops are (offset 0..1, (r, g, b, a))."""
    y, x = np.mgrid[0:size, 0:size]
    r = np.hypot(x - size / 2, y - size / 2) / (size / 2)
    out = np.zeros((size, size, 4), dtype=np.float32)
    offsets = [s[0] for s in stops]
    for c in range(4):
        out[..., c] = np.interp(r, offsets, [s[1][c] for s in stops])
    return Image.fromarray(out.astype(np.uint8))


def star(size: int, halo: bool = True) -> Image.Image:
    s = 3
    w = size * s
    u = w / 100
    img = Image.new("RGBA", (w, w), (0, 0, 0, 0))
    if halo:
        img.alpha_composite(radial(w, [(0, (255, 214, 140, 110)), (0.22, (240, 170, 110, 46)), (0.5, (142, 120, 230, 18)), (0.78, (142, 120, 230, 0)), (1, (0, 0, 0, 0))]))
    ring = Image.new("RGBA", (w, w), (0, 0, 0, 0))
    r = 35 * u
    ImageDraw.Draw(ring).ellipse((w / 2 - r, w / 2 - r, w / 2 + r, w / 2 + r), outline=(131, 116, 240, 190), width=max(2, round(0.55 * u)))
    img.alpha_composite(ring)

    def filled(points, stops):
        m = Image.new("L", (w, w), 0)
        ImageDraw.Draw(m).polygon([(x * u, y * u) for x, y in points], fill=255)
        layer = radial(w, stops)
        layer.putalpha(Image.composite(layer.getchannel("A"), Image.new("L", (w, w), 0), m))
        return layer

    glow = filled(star_points(50, 50, 47, 45, 4.2), [(0, (255, 210, 130, 255)), (1, (255, 190, 100, 255))]).filter(ImageFilter.GaussianBlur(1.6 * u))
    img.alpha_composite(glow)
    img.alpha_composite(filled(diagonal_points(50, 50, 25, 3.4), [(0, (255, 250, 235, 255)), (0.3, (250, 214, 150, 235)), (1, (240, 180, 100, 235))]))
    img.alpha_composite(filled(star_points(50, 50, 47, 45, 3.2), [(0, (255, 255, 255, 255)), (0.18, (255, 244, 214, 255)), (0.6, (248, 212, 140, 255)), (1, (242, 190, 105, 255))]))
    core = radial(round(30 * u), [(0, (255, 255, 255, 255)), (0.3, (255, 246, 220, 200)), (1, (255, 220, 150, 0))])
    img.alpha_composite(core, (round(w / 2 - core.width / 2), round(w / 2 - core.height / 2)))
    return img.resize((size, size), Image.Resampling.LANCZOS)


# Native splash: the star sits above centre so the animated splash can put the
# wordmark beneath it. 640px of 1200 at imageWidth 280 is about 150pt.
splash = Image.new("RGBA", (1200, 1200), (0, 0, 0, 0))
splash.alpha_composite(star(640), (280, 112))
splash.save(OUT / "splash-mark.png")
print("brand assets written")
