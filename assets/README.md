# Home Base — art asset drop-in guide

All art here is loaded by **exact filename**. Drop a correctly-named file in the
right folder and it appears on the next refresh — **no code change needed**. A
missing file always degrades gracefully (adjacent sky art, CSS gradient, or the
initial/placeholder), so partial sets are safe.

Prefer **WebP**. Keep file sizes lean for the wall tablet.

---

## `sky/` — full-screen background art
- **Name:** `{slot}_{condition}.webp`
- **Size:** 3:2 landscape, ~2048×1365, `object-fit: cover` (design a safe center).
- **Slots:** `night predawn dawn morning midday afternoon golden dusk evening`
- **Conditions:** `clear sunny cloudy rainy stormy snowy foggy` (`sunny`↔`clear` interchangeable)
- **Have (23):** night clear/cloudy/rainy/snowy · dawn clear/cloudy/rainy · morning
  sunny/cloudy/rainy · midday sunny/cloudy/stormy/rainy · afternoon
  sunny/cloudy/stormy/foggy · golden sunny/cloudy/rainy · dusk clear/cloudy
- **Still needed:** `predawn_clear` `predawn_cloudy` `evening_clear` `evening_cloudy`
  (these slots currently borrow night/dawn/dusk art until added)
- Budget: < ~450 KB each.

## `quest/` — quest banner backdrops
- **Names:** `meadow-banner.webp` `forest-banner.webp` `river-banner.webp` `mountain-banner.webp`
- **Size:** wide, ~1920×480 (4:1), `object-fit: cover`.
- **Important — backdrop only.** The app draws the dotted **trail + waypoint dots +
  treasure-chest node** and overlays the **signposts (left)**, **quest title (center)**
  and **progress % (right)** on top. Keep those zones calm:
  centre band open for the title, bottom ~25% simple for the trail, far-left and
  far-right uncluttered. Don't bake the path/markers into the painting.
- Missing file → the CSS meadow gradient shows instead. Budget: < ~300 KB.

## `meals/` — tonight's-dinner thumbnails
- **Name:** your choice, referenced from `src/data/meals.js` `tonight.photo`
  (e.g. `lemon-garlic-chicken-pasta.webp`).
- **Size:** square ~240×240 (shown at 80px, rounded). Missing → warm gradient. Budget: < ~60 KB.

## `avatars/` — kid avatars
- **Names:** `emma.webp` `jack.webp` `lucy.webp` (set the `avatar` field in `src/data/chores.js`).
- **Size:** square ~192×192, circle-cropped or transparent. Missing → colored initial circle.
- **Kid colors:** Emma `#4a7c59`, Jack `#3a6ea5`, Lucy `#7b5ea7`.

---

## Visual language (match this)
Warm, natural, storybook/watercolor, botanical. Cream glass cards
`rgba(252,248,240,0.88)`; ink `#3a352d`; sage `#9bb38a`/`#7d9b6c`; teal `#3a9d96`;
coral `#e2745f`; quest gold `#c8902a`. Serif display + clean sans for data.
