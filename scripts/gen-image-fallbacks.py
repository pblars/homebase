#!/usr/bin/env python3
"""
gen-image-fallbacks.py — generate non-WebP twins for every image in /assets.

WHY: WebP needs Safari 14 / iOS 14. The wall iPad runs an older iOS, where every
.webp silently fails to decode — no sky art, no quest backdrop, no jar. Shipping
a fallback alongside each .webp fixes that without giving up WebP on modern
browsers (SkyManager tries .webp first and only falls back on error).

Picks the format per image:
  - has real transparency -> .png  (JPEG has no alpha; a jar overlay would
                                    otherwise render as an opaque box)
  - fully opaque          -> .jpg  (far smaller than PNG for illustrated art)

Idempotent: skips a twin that is already newer than its source.
Run after adding new art:  python scripts/gen-image-fallbacks.py
"""

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow required:  python -m pip install Pillow")

ASSETS = Path(__file__).resolve().parent.parent / "assets"
JPEG_QUALITY = 88


def has_alpha(img):
    """True only if the image actually uses transparency, not merely has a channel."""
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        alpha = img.convert("RGBA").getchannel("A")
        return alpha.getextrema()[0] < 255
    return False


def main():
    sources = sorted(ASSETS.rglob("*.webp"))
    if not sources:
        sys.exit(f"no .webp found under {ASSETS}")

    made = skipped = 0
    for src in sources:
        with Image.open(src) as img:
            img.load()
            transparent = has_alpha(img)
            out = src.with_suffix(".png" if transparent else ".jpg")

            if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
                skipped += 1
                continue

            if transparent:
                img.convert("RGBA").save(out, "PNG", optimize=True)
            else:
                img.convert("RGB").save(out, "JPEG", quality=JPEG_QUALITY,
                                        optimize=True, progressive=True)

        made += 1
        rel = out.relative_to(ASSETS.parent)
        print(f"  {rel}  ({'alpha->PNG' if transparent else 'opaque->JPEG'}, "
              f"{src.stat().st_size // 1024}K -> {out.stat().st_size // 1024}K)")

    print(f"\n{made} generated, {skipped} already current")


if __name__ == "__main__":
    main()
