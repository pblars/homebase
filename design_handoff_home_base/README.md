# Handoff: Home Base — card layout & styling refresh (option 2a)

## ⚠️ Scope — read this first

This is a **presentation-only** change. Restyle and re-arrange the dashboard **cards** to match the design reference. Do **not** change how anything works or what assets are loaded.

**DO change (visual only):**
- Card containers: background fill/opacity, `backdrop-filter`, border, `border-radius`, box-shadow, padding.
- Card arrangement: the grid/flex layout, column widths, gaps, and ordering.
- Typography inside cards: font family, size, weight, letter-spacing, color.
- Treatment of chips / pills / progress bars / badges.

**DO NOT change:**
- **Image asset references and background-loading logic.** The **screen background image** and the **quest background image** must keep their existing `src`/import paths, variable names, host elements, and the logic that swaps them by time of day / weather. The gradients in the HTML reference are only stand-ins because the prototype had no access to your real image files — **do not replace your images with CSS gradients.** Restyle the cards that sit *on top of* those images.
- **Widget functionality / data wiring.** The live clock, weather data, chore toggling + progress, quest-percentage calculation, meal plan, agenda/calendar data, and nav behavior all stay exactly as they are. Do not rename props, alter state, or touch event handlers.
- If unsure whether something is layout or behavior → leave the behavior untouched.

## Important design note — the background changes; the UI must not be evening-locked

The background imagery changes throughout the day and by weather condition (dawn, bright morning, midday, cloudy afternoon, golden hour, dusk, rainy, night, etc.). **Do not hard-code the interface to an evening-only look.** The mockup happens to show a dusk scene, but build the visual system so the glass cards, text colors, borders, and shadows maintain readability across bright, dark, warm, and cool backgrounds. The UI sits over the existing full-bleed background image, whatever time/weather state is currently active.

> The app should feel like a **premium frosted-glass family dashboard layered over painterly time-of-day and weather-based backgrounds, with the UI adapting gracefully across light and dark scenes.**

Target vibe: calm · painterly · warm · cozy · premium · organic · glanceable from across the room · less techy, less childish.

## About the design files

`Home Base.dc.html` in this bundle is a **design reference created in HTML** — a prototype showing the intended look, not production code to copy verbatim. Recreate the *styling and layout* of option **2a** using your codebase's existing components, styling system, and patterns. Keep your current component structure, data flow, and assets.

The file contains four options stacked on a canvas. **The target is `2a`** (top of the file, dusk-glass style on a three-column layout). The others (`1a`, `1b`, `1c`) are earlier explorations — ignore unless referenced. Note that `2a` is rendered over an evening background; treat its glass recipe as the **dark-background** end of an adaptive system (see below), not the only state.

## Fidelity

**High-fidelity.** Colors, type, spacing, and radii below are final — match them, then extend them into the adaptive light/dark variants.

## Layout (option 2a)

Countertop landscape display (reference canvas 1280×800; treat as a fluid full-viewport layout). Vertical flex stack over the background image, outer padding `22px 22px 14px`, `gap: 15px` between rows:

1. **Header row** (auto height): greeting + big clock on the left (flex:1); weather pill on the right (flex:none).
2. **Body row** (fills remaining height, `gap: 15px`):
   - Left: **Agenda** card — fixed width `284px`.
   - Center: **Quest** hero — flex:1 (this is where the quest background image lives).
   - Right: **Chores** card — fixed width `322px`.
3. **Meals strip** (auto height): full width, horizontal.
4. **Nav bar** (auto height): full width, horizontal, evenly spaced.

## Background-aware glass system

Because the background changes throughout the day, cards use a **flexible frosted-glass system** that stays readable over both light and dark images. All major widgets share the same material — translucent glass, backdrop blur, a subtle 1px highlight border, generous rounded corners, and a soft shadow — but the **tint and text color adapt to background brightness**.

Implement this as a theme switch (a `data-scene="dark|light"` attribute, a CSS class, or CSS custom properties) driven by whatever brightness/time signal you already have for background selection. Prefer CSS variables so a single toggle re-themes every card:

```css
/* DARK backgrounds (dusk, night, rainy, moody) — this is what 2a shows */
--glass-bg:      rgba(30, 28, 44, 0.30);
--glass-border:  rgba(255, 255, 255, 0.16);
--glass-shadow:  0 12px 34px rgba(20, 16, 30, 0.28);
--text-primary:  #fdf8ee;                 /* warm off-white */
--text-secondary: rgba(255, 255, 255, 0.60);
--text-accent:   rgba(255, 236, 214, 0.85); /* soft amber */

/* LIGHT backgrounds (dawn, bright morning, midday, golden hour) */
--glass-bg:      rgba(253, 247, 236, 0.42); /* warm ivory / cream */
--glass-border:  rgba(255, 255, 255, 0.55);
--glass-shadow:  0 12px 34px rgba(90, 70, 45, 0.18);
--text-primary:  #2f2a22;                 /* deep charcoal / forest */
--text-secondary: rgba(60, 52, 40, 0.62);
--text-accent:   #8a6a2e;                 /* muted amber/olive */
```

Shared, non-adaptive properties on every major card:

```
backdrop-filter: blur(22px);
border: 1px solid var(--glass-border);
box-shadow: var(--glass-shadow);
background: var(--glass-bg);
border-radius: 24px;   /* large cards */
                       /* 22px on the weather pill & meals strip, 20px on nav */
padding: 18px;         /* cards */  /* 12px 20px on pills/strips, 8px 10px on nav */
```

Readability guidance: keep enough blur + a slight opacity floor so text never washes out over busy imagery; on very bright scenes lean on the ivory glass + deep text, on dark scenes the charcoal glass + off-white text. Aim for AA contrast of card text against the *glass*, not the raw photo.

## Design tokens

**Type**
- Display / numbers / titles: **Newsreader** (serif), weight 500–600. Clock ~58px; card titles/temps 34–42px; meal/agenda titles 15–17px.
- Labels / body: **Mulish** (sans). Section eyebrows: 12px, weight 700, `letter-spacing: .16em`, uppercase, `var(--text-secondary)`. Body 12–15px.
- Colors come from the adaptive `--text-*` variables above, not hard-coded per card.

**Family accent colors** (avatars + progress bars — constant across scenes)
- Greta `#6f9a5c` · Nora `#5c85a8` · Annika `#9a72ab` · Elijah `#cf9445`

**Chore pills** (tint the neutral bg/border from the glass vars; the green stays constant)
- Done: bg `rgba(111,158,95,.24)`, border `1px rgba(140,190,120,.4)`, check dot `#6f9e5f` (white ✓), label = `--text-secondary` with `line-through`.
- To-do: bg = a faint fill of `--glass-bg`, border = `--glass-border`, empty dot uses `--text-secondary` at ~50%, label = `--text-primary`.
- Pill shape: `border-radius: 999px`, `padding: 5px 10px 5px 6px`, `gap: 6px`.

**Progress bar**: track = `--glass-border` tone, height 5px, `border-radius: 999px`; fill = family accent, `transition: width .45s cubic-bezier(.2,.8,.2,1)`.

**Quest % badge** (glass chip over the quest image — bump opacity for legibility over illustration): bg `rgba(255,255,255,.72)`, `backdrop-filter: blur(6px)`, border `1px rgba(255,255,255,.7)`, `border-radius: 16px`, `padding: 12px 16px`, number in Newsreader (use a dark forest tone like `#33451f` since it sits over the lit meadow art in every scene).

**Meal tonight tile**: `#d98a4e`, `border-radius: 14px`, 50×50.

**Radii**: cards 24 · pills/strips 22 · nav 20 · chips 999 · avatars 50%.
**Nav active item**: `background:` a raised step of `--glass-bg` (e.g. white/charcoal at ~16%), `border-radius: 14px`, `padding: 9px 18px`.

## Interactions (already implemented — keep as-is)
- Clock updates every second.
- Tapping a chore pill toggles it → updates that child's progress bar **and** the quest percentage/trail (all derived from one shared completion state).
- Quest percentage = completed chores ÷ total chores.

## Assets
- **Screen background image** and **quest background image**: supplied by your existing codebase and swapped by time/weather — **preserve their references and loading logic.** The HTML reference uses CSS gradients only because the real files weren't available in the prototype.
- Weather + nav glyphs in the reference are inline SVG; use your existing icon set.
- Fonts: Newsreader + Mulish (Google Fonts) — or your codebase's nearest serif-display / humanist-sans pairing.

## Files
- `Home Base.dc.html` — the design reference (open in a browser; target option is `2a`).

---

### One-line implementation goal
Refactor the UI so it looks like a premium frosted-glass family dashboard over painterly nature backgrounds, while preserving the project's existing background and quest image sourcing. The glass, text, borders, and shadows must adapt so it feels consistent across **all** time-of-day and weather backgrounds — not just evening.
