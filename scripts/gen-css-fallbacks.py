#!/usr/bin/env python3
"""
gen-css-fallbacks.py — emit a fixed-px fallback ahead of every clamp() value.

WHY: clamp() needs Safari 13.1. The wall iPad runs an older iOS, where the whole
declaration is dropped — so `font-size: clamp(20px, 2vw, 24px)` produced no font
size at all and elements rendered at intrinsic size. That is why the dashboard
showed giant nav icons and weather glyphs.

The fix is the oldest trick in CSS: declare twice.

    font-size: 20.5px;                      <- generated; old Safari uses this
    font-size: clamp(20px, 2vw, 24px);      <- old Safari drops it, modern wins

Same specificity, adjacent, so the cascade picks the later one wherever it
parses. Modern rendering is byte-identical; only browsers that cannot read
clamp() fall back.

The fallback resolves the middle (preferred) term at a reference viewport, then
clamps it between the min and max — i.e. exactly what a modern browser computes
at that size, so the legacy device gets the intended proportions rather than a
guess.

Idempotent: re-running refreshes existing fallbacks instead of stacking them.
Run after editing any clamp():  python scripts/gen-css-fallbacks.py
"""

import re
import sys
from pathlib import Path

STYLES = Path(__file__).resolve().parent.parent / "styles"

# Reference viewport: the wall iPad in landscape. Only ever consulted by
# browsers that cannot parse clamp(), so changing it cannot affect modern output.
REF_W, REF_H = 1024, 768
ROOT_FONT_PX = 16

# A declaration whose value contains at least one clamp(). clamp() never
# contains ; { } so the value class is safe.
DECL = re.compile(r"(?P<prop>[-a-zA-Z]+)\s*:\s*(?P<val>[^;{}]*clamp\([^;{}]*\)[^;{}]*);")
CLAMP = re.compile(r"clamp\(\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*([^)]+?)\s*\)")
LENGTH = re.compile(r"(-?[\d.]+)(px|vw|vh|rem|em)?$")

# A previously generated fallback: same property, no clamp, immediately followed
# by the clamp() declaration it shadows. Stripped so re-runs refresh cleanly.
STALE = re.compile(
    r"([-a-zA-Z]+)\s*:\s*(?:(?!clamp\()[^;{}])*;[ \t]*\n?[ \t]*(?=\1\s*:\s*[^;{}]*clamp\()"
)


def to_px(token):
    m = LENGTH.match(token.strip())
    if not m:
        return None
    n, unit = float(m.group(1)), (m.group(2) or "px")
    if unit == "px":
        return n
    if unit == "vw":
        return n / 100 * REF_W
    if unit == "vh":
        return n / 100 * REF_H
    if unit in ("rem", "em"):
        return n * ROOT_FONT_PX
    return None


def resolve(value, where):
    def one(m):
        lo, pref, hi = (to_px(m.group(i)) for i in (1, 2, 3))
        if lo is None or pref is None or hi is None:
            raise ValueError(f"{where}: cannot resolve {m.group(0)!r}")
        px = min(max(pref, lo), hi)
        return f"{round(px, 2):g}px"

    return CLAMP.sub(one, value)


def transform(text, where):
    text = STALE.sub("", text)
    out, pos, count = [], 0, 0
    for m in DECL.finditer(text):
        out.append(text[pos:m.start()])
        fixed = resolve(m.group("val"), where)
        # Match the surrounding layout: own-line declarations get their own line,
        # declarations packed into a one-line rule stay inline.
        line_start = text.rfind("\n", 0, m.start()) + 1
        indent = text[line_start:m.start()]
        if indent.strip() == "":
            out.append(f"{m.group('prop')}: {fixed};\n{indent}{m.group(0)}")
        else:
            out.append(f"{m.group('prop')}: {fixed}; {m.group(0)}")
        pos = m.end()
        count += 1
    out.append(text[pos:])
    return "".join(out), count


def main():
    files = sorted(STYLES.glob("*.css"))
    if not files:
        sys.exit(f"no stylesheets under {STYLES}")

    total = 0
    for path in files:
        original = path.read_text(encoding="utf-8")
        try:
            updated, n = transform(original, path.name)
        except ValueError as e:
            sys.exit(f"ERROR {e}")
        if updated != original:
            path.write_text(updated, encoding="utf-8")
        total += n
        print(f"  {path.name:16} {n:3} fallback(s)")

    print(f"\n{total} clamp() declarations shadowed "
          f"(reference viewport {REF_W}x{REF_H})")


if __name__ == "__main__":
    main()
