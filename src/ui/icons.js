// icons.js
// -----------------------------------------------------------------------------
// Inline SVG icon library for the Dashboard. Everything is hand-drawn SVG (no
// emoji, no icon font, no image files) so it scales crisply on the wall tablet
// and inherits color via `currentColor` where useful.
//
// Exposed as the global `ICONS`:
//   ICONS.nav[id]            -> Tabler-style outline nav icon (24x24, stroke)
//   ICONS.weather(condition) -> illustrated weather icon (sun/cloud/rain/...)
//   ICONS.event[type]        -> agenda glyph (car/soccer/tooth/heart/trash)
//   ICONS.deco.*             -> botanical + bird decorations
//   ICONS.check              -> small checkmark path
// -----------------------------------------------------------------------------

const ICONS = (() => {
  // --- Bottom-nav icons (Tabler outline style: stroke, no fill, rounded) -----
  const nav = {
    home:
      '<svg viewBox="0 0 24 24" class="nav-ic"><path d="M3 11.4 12 4l9 7.4"/>' +
      '<path d="M5 10v9a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1v-9"/></svg>',
    weather:
      '<svg viewBox="0 0 24 24" class="nav-ic"><circle cx="12" cy="12" r="4"/>' +
      '<path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/></svg>',
    calendar:
      '<svg viewBox="0 0 24 24" class="nav-ic"><rect x="4" y="5" width="16" height="15" rx="2.5"/>' +
      '<path d="M4 9.5h16M8 3v4M16 3v4"/></svg>',
    chores:
      '<svg viewBox="0 0 24 24" class="nav-ic"><path d="M11 6h9M11 12h9M11 18h9"/>' +
      '<path d="M4 5l1.3 1.3L7.6 4M4 11l1.3 1.3L7.6 10M4 17l1.3 1.3L7.6 16"/></svg>',
    meals:
      '<svg viewBox="0 0 24 24" class="nav-ic"><path d="M7 3v18M5 3v5a2 2 0 0 0 4 0V3"/>' +
      '<path d="M17 3c-1.6 1-2.4 3-2.4 6 0 2 1.1 2.6 2.4 2.6V21"/></svg>',
    photos:
      '<svg viewBox="0 0 24 24" class="nav-ic"><rect x="3" y="5" width="18" height="14" rx="2.5"/>' +
      '<circle cx="8.5" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg>',
    settings:
      '<svg viewBox="0 0 24 24" class="nav-ic"><circle cx="12" cy="12" r="3"/>' +
      '<path d="M12 2.6l1.4 2.5 2.8-.6.3 2.8 2.5 1.4-1.4 2.4 1.4 2.4-2.5 1.4-.3 2.8-2.8-.6L12 21.4l-1.4-2.5-2.8.6-.3-2.8-2.5-1.4 1.4-2.4-1.4-2.4 2.5-1.4.3-2.8 2.8.6z"/></svg>',
  };

  // --- Illustrated weather icons --------------------------------------------
  // Each returns a 24x24 SVG. Filled, soft colors — reads as an illustration.
  const RAYS =
    '<g stroke="#f4a93c" stroke-width="1.7" stroke-linecap="round">' +
    '<path d="M12 1.5V4M12 20v2.5M1.5 12H4M20 12h2.5M4.2 4.2 6 6M18 18l1.8 1.8M19.8 4.2 18 6M6 18l-1.8 1.8"/></g>';
  const sun =
    '<svg viewBox="0 0 24 24" class="wx">' + RAYS + '<circle cx="12" cy="12" r="5" fill="#f6b93b"/></svg>';

  function cloudPath(dy, fill, stroke) {
    return '<path transform="translate(0 ' + dy + ')" d="M19.35 10A7.5 7.5 0 0 0 12 4 7.5 7.5 0 0 0 5.06 8.6 6 6 0 0 0 6 20.5h13A5 5 0 0 0 19.35 10z" ' +
      'fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="0.5"' : '') + '/>';
  }

  const cloudy =
    '<svg viewBox="0 0 24 24" class="wx">' + cloudPath(0, '#cdd7e0', '#b7c3cd') + '</svg>';
  const partly_cloudy =
    '<svg viewBox="0 0 24 24" class="wx">' +
    '<g stroke="#f4a93c" stroke-width="1.5" stroke-linecap="round">' +
    '<path d="M8 1.5V3.5M1.5 8H3.5M3.6 3.6 5 5M12.4 3.6 11 5"/></g>' +
    '<circle cx="8" cy="8" r="3.4" fill="#f6b93b"/>' + cloudPath(2, '#eef2f6', '#cdd7e0') + '</svg>';
  const rainy =
    '<svg viewBox="0 0 24 24" class="wx">' + cloudPath(-2, '#b9c4cf', '#a6b3bf') +
    '<g stroke="#5b9bd5" stroke-width="1.8" stroke-linecap="round"><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/></g></svg>';
  const stormy =
    '<svg viewBox="0 0 24 24" class="wx">' + cloudPath(-2, '#aab6c2', '#97a5b2') +
    '<path d="M12 17l-3 4h2.4l-1 3 4-5h-2.4z" fill="#f4c430"/></svg>';
  const snowy =
    '<svg viewBox="0 0 24 24" class="wx">' + cloudPath(-2, '#cdd7e0', '#b7c3cd') +
    '<g fill="#fff"><circle cx="8" cy="19.5" r="1.1"/><circle cx="12" cy="21" r="1.1"/><circle cx="16" cy="19.5" r="1.1"/></g></svg>';
  const foggy =
    '<svg viewBox="0 0 24 24" class="wx">' + cloudPath(-3, '#cdd7e0', '#b7c3cd') +
    '<g stroke="#b3bfca" stroke-width="1.7" stroke-linecap="round"><path d="M6 19h12M7 22h10"/></g></svg>';

  const WEATHER = { sunny: sun, clear: sun, partly_cloudy, cloudy, rainy, stormy, snowy, foggy };
  function weather(condition) { return WEATHER[condition] || cloudy; }

  // --- Agenda event glyphs (stroke, inherit currentColor) --------------------
  const event = {
    car:
      '<svg viewBox="0 0 24 24" class="ev-ic"><path d="M4 13l1.6-4.6A2 2 0 0 1 7.5 7h9a2 2 0 0 1 1.9 1.4L20 13v4.5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V17H8v.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M4 13h16"/><circle cx="7.5" cy="16" r="1"/><circle cx="16.5" cy="16" r="1"/></svg>',
    soccer:
      '<svg viewBox="0 0 24 24" class="ev-ic"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l3 2.2-1.1 3.5h-3.8L9 9.7z"/><path d="M12 7.5V4.5M14.9 9.7l2.8-1M13.9 13.2l1.8 2.4M10.1 13.2l-1.8 2.4M9.1 9.7l-2.8-1"/></svg>',
    tooth:
      '<svg viewBox="0 0 24 24" class="ev-ic"><path d="M7 4.5c-2 0-3 1.6-3 4 0 2.6.9 3.8 1.4 6.5.3 1.8.5 4 1.6 4s1.1-1.8 1.5-3 .5-1.4 1.5-1.4 1.1.2 1.5 1.4.4 3 1.5 3 1.3-2.2 1.6-4c.5-2.7 1.4-3.9 1.4-6.5 0-2.4-1-4-3-4-1.6 0-2 1-3.5 1S8.6 4.5 7 4.5z"/></svg>',
    heart:
      '<svg viewBox="0 0 24 24" class="ev-ic"><path d="M12 20s-7-4.4-7-9.4A3.6 3.6 0 0 1 12 7a3.6 3.6 0 0 1 7 3.6C19 15.6 12 20 12 20z"/></svg>',
    trash:
      '<svg viewBox="0 0 24 24" class="ev-ic"><path d="M5 7h14M10 7V5h4v2M6.5 7l.9 12.5a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9L17.5 7M10 11v6M14 11v6"/></svg>',
  };

  // --- Botanical + bird decorations (soft sage, decorative only) -------------
  const deco = {
    leaf:
      '<svg viewBox="0 0 48 48" class="deco-svg"><path d="M6 42C6 22 22 6 42 6c0 20-16 36-36 36z" fill="#9bb38a" opacity="0.55"/>' +
      '<path d="M10 38C18 30 28 20 36 12" stroke="#7d9b6c" stroke-width="1.4" fill="none" opacity="0.7"/></svg>',
    sprig:
      '<svg viewBox="0 0 48 48" class="deco-svg"><path d="M24 44V12" stroke="#7d9b6c" stroke-width="1.4" fill="none"/>' +
      '<path d="M24 28c-7 0-11-4-11-11 7 0 11 4 11 11zM24 22c7 0 11-4 11-11-7 0-11 4-11 11zM24 36c-6 0-9-3-9-9 6 0 9 3 9 9z" fill="#9bb38a" opacity="0.55"/></svg>',
    flower:
      '<svg viewBox="0 0 48 48" class="deco-svg"><g fill="#cda8d6" opacity="0.6">' +
      '<ellipse cx="24" cy="13" rx="5" ry="8"/><ellipse cx="24" cy="35" rx="5" ry="8"/>' +
      '<ellipse cx="13" cy="24" rx="8" ry="5"/><ellipse cx="35" cy="24" rx="8" ry="5"/></g>' +
      '<circle cx="24" cy="24" r="5" fill="#f0c64a"/></svg>',
    bird:
      '<svg viewBox="0 0 32 16" class="bird-svg"><path d="M2 10C7 3 11 3 16 9c5-6 9-6 14 1" stroke="#3a3a33" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  };

  const check = '<svg viewBox="0 0 16 16" class="check-svg"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // Hand-drawn acorn: stem, hatched cap, body.
  const acorn =
    '<svg viewBox="0 0 24 24" class="acorn-svg">' +
    '<path d="M12 2.4v2.4" stroke="#6f4a1c" stroke-width="1.6" stroke-linecap="round"/>' +
    '<path d="M4.6 9C4.6 5.6 8 4 12 4s7.4 1.6 7.4 5z" fill="#a9742f" stroke="#6f4a1c" stroke-width="0.8" stroke-linejoin="round"/>' +
    '<path d="M8.8 5.6l2.1 1.8M12.9 5.2l2.2 1.9" stroke="#7a531f" stroke-width="0.7" opacity="0.5"/>' +
    '<path d="M6.4 9h11.2C17.6 14.6 15 17.6 12 17.6S6.4 14.6 6.4 9z" fill="#c98a3f" stroke="#6f4a1c" stroke-width="0.8" stroke-linejoin="round"/>' +
    '</svg>';

  return { nav, weather, event, deco, check, acorn };
})();

window.ICONS = ICONS;
