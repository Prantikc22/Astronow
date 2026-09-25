"""Render the AstroNow aperture mark into native icon and splash assets."""

import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "images" / "brand"
OUT.mkdir(parents=True, exist_ok=True)

MIDNIGHT = (11, 11, 26, 255)
GOLD = (247, 221, 166, 255)
SOFT = (248, 242, 232, 255)
CORAL = (240, 160, 189, 255)


def mark(size: int, background: bool) -> Image.Image:
    scale = 4
    w = size * scale
    img = Image.new("RGBA", (w, w), MIDNIGHT if background else (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    unit = w / 100
    def xy(x, y): return (round(x * unit), round(y * unit))
    stroke = round(5 * unit)
    # Keep this native asset in sync with src/components/BrandMark.tsx.
    orbit = []
    angle = -math.pi / 10
    for i in range(260):
        t = 2 * math.pi * i / 259
        x, y = 39 * math.cos(t), 27 * math.sin(t)
        orbit.append(xy(50 + x * math.cos(angle) - y * math.sin(angle),
                        50 + x * math.sin(angle) + y * math.cos(angle)))
    for i in range(0, len(orbit) - 3, 8):
        draw.line(orbit[i:i + 5], fill=(247, 221, 166, 145), width=round(3.2 * unit))

    def bezier(p0, p1, p2, p3):
        return [xy((1-t)**3*p0[0] + 3*(1-t)**2*t*p1[0] + 3*(1-t)*t*t*p2[0] + t**3*p3[0],
                   (1-t)**3*p0[1] + 3*(1-t)**2*t*p1[1] + 3*(1-t)*t*t*p2[1] + t**3*p3[1])
                for t in (i/80 for i in range(81))]

    eye = bezier((13, 52), (24, 35), (36, 27), (50, 27))
    eye += bezier((50, 27), (64, 27), (76, 35), (87, 52))
    eye += bezier((87, 52), (76, 68), (64, 76), (50, 76))
    eye += bezier((50, 76), (36, 76), (24, 68), (13, 52))
    draw.line(eye, fill=GOLD, width=round(4.4 * unit), joint="curve")
    for radius, fill in ((14, None), (5.5, CORAL)):
        cx, cy = xy(50, 52)
        rr = radius * unit
        draw.ellipse((cx-rr, cy-rr, cx+rr, cy+rr), outline=GOLD if fill is None else None,
                     fill=fill, width=round(4 * unit))
    for a, b in (((77, 15), (77, 29)), ((70, 22), (84, 22)),
                 ((73, 18), (81, 26)), ((81, 18), (73, 26))):
        draw.line((xy(*a), xy(*b)), fill=GOLD, width=round(2.8 * unit))
    return img.resize((size, size), Image.Resampling.LANCZOS)


icon = mark(1024, True)
icon.save(OUT / "icon.png")
# app.json deliberately uses this second path so Expo Go cannot reuse the old
# project-icon URL after a brand update. Keep both outputs identical.
icon.save(ROOT / "assets" / "images" / "icon.png")
mark(128, True).save(OUT / "favicon.png")

# Android adaptive-icon foreground gets generous safe-zone padding.
foreground = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
foreground.alpha_composite(mark(620, False), (202, 202))
foreground.save(OUT / "adaptive-foreground.png")
foreground.save(ROOT / "assets" / "images" / "adaptive-icon.png")

splash = Image.new("RGBA", (1200, 1200), (0, 0, 0, 0))
splash.alpha_composite(mark(480, False), (360, 192))
font_path = ROOT / "node_modules" / "@expo-google-fonts" / "fraunces" / "500Medium" / "Fraunces_500Medium.ttf"
font = ImageFont.truetype(str(font_path), 92)
draw = ImageDraw.Draw(splash)
draw.text((600, 790), "astronow", font=font, anchor="mm", fill=SOFT)
splash.save(OUT / "splash-aperture.png")
