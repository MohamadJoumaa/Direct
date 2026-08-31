"""One-shot: extract transparent logo PNGs + favicon from the provided brand JPG."""

import sys
from pathlib import Path

from PIL import Image

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

img = Image.open(SRC).convert("RGB")
w, h = img.size
print(f"source: {w}x{h}")


def unmatte_black(rgb_img: Image.Image, floor: int = 24) -> Image.Image:
    """Knock out a near-black studio backdrop. Alpha follows the brightest
    channel so the logo glow stays, then un-premultiply so blue stays blue."""
    rgba = rgb_img.convert("RGBA")
    px = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, _ = px[x, y]
            a = max(r, g, b)
            if a <= floor:
                px[x, y] = (0, 0, 0, 0)
            else:
                alpha = min(255, (a - floor) * 255 // (255 - floor))
                px[x, y] = (
                    min(255, r * 255 // a),
                    min(255, g * 255 // a),
                    min(255, b * 255 // a),
                    alpha,
                )
    return rgba


def autocrop(rgba: Image.Image, pad: int = 16, min_alpha: int = 48) -> Image.Image:
    """Crop to the opaque mark, ignoring faint studio glow at the edges."""
    mask = rgba.getchannel("A").point(lambda v: 255 if v >= min_alpha else 0)
    bbox = mask.getbbox()
    if not bbox:
        return rgba
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(rgba.width, bbox[2] + pad)
    bottom = min(rgba.height, bbox[3] + pad)
    return rgba.crop((left, top, right, bottom))


# Left half = icon-only mark, right half = icon + wordmark lockup.
icon_region = img.crop((0, 0, w // 2, h))
lockup_region = img.crop((w // 2, 0, w, h))

icon = autocrop(unmatte_black(icon_region))
lockup = autocrop(unmatte_black(lockup_region))

icon.save(OUT / "logo-icon.png")
lockup.save(OUT / "logo-lockup.png")
print(f"logo-icon.png: {icon.size}")
print(f"logo-lockup.png: {lockup.size}")

# Favicon + app icons from the icon mark, centered on a square canvas.
side = max(icon.size)
square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
square.paste(icon, ((side - icon.width) // 2, (side - icon.height) // 2), icon)

square.resize((180, 180), Image.LANCZOS).save(OUT / "apple-touch-icon.png")
square.resize((512, 512), Image.LANCZOS).save(OUT / "icon.png")
square.save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("favicon.ico, icon.png, apple-touch-icon.png written")
