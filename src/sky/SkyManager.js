// SkyManager.js
// -----------------------------------------------------------------------------
// The heart of Phase 1. Resolves a (slot, condition) pair to an available sky
// image and crossfades between two stacked <img> layers (#sky-a / #sky-b).
// Exposed as the global `SkyManager`.
//
// Image naming convention:  {slot}_{condition}.webp  in /assets/sky/
//   slots:      night predawn dawn morning midday afternoon golden dusk evening
//   conditions: sunny clear cloudy rainy stormy foggy snowy partly_cloudy
//
// Only the 27 art files below (+ placeholder) actually exist; resolveKey() walks
// a fallback chain so any (slot, condition) combo lands on a real file.
// -----------------------------------------------------------------------------

const SkyManager = (() => {
  const ASSET_DIR = 'assets/sky/';
  // Extensions tried in order when loading a key. .webp is preferred (smaller,
  // smoother crossfades) but .jpg/.png work too — drop any into /assets/sky/.
  // .jpg matters for the wall iPad: WebP needs Safari 14 / iOS 14, and on older
  // iOS every .webp fails to decode, so the sky stayed black. Each .webp has a
  // generated .jpg twin (scripts/gen-image-fallbacks.py) and the onerror chain
  // below falls through to it automatically.
  const EXTENSIONS = ['.webp', '.jpg', '.png'];
  const DEFAULT_FADE_MS = 2500;
  const PLACEHOLDER_KEY = 'placeholder';

  // Hardcoded availability map — the art that actually ships in /assets/sky/.
  // The full intended art matrix. A key here may not have a file yet (e.g.
  // predawn_*/evening_* are still to be designed). That's safe: when an image
  // fails to load it's recorded in MISSING below and the resolver re-resolves to
  // the next-best art — so a missing file degrades to an adjacent slot, never the
  // dark placeholder, and the moment the real .webp is dropped into /assets/sky/
  // it simply shows on the next slot/weather change. Drop-in, no code change.
  const AVAILABLE = new Set([
    'night_clear', 'night_cloudy', 'night_rainy', 'night_snowy',
    'predawn_clear', 'predawn_cloudy',
    'dawn_clear', 'dawn_cloudy', 'dawn_rainy',
    'morning_sunny', 'morning_cloudy', 'morning_rainy',
    'midday_sunny', 'midday_cloudy', 'midday_stormy', 'midday_rainy',
    'afternoon_sunny', 'afternoon_cloudy', 'afternoon_stormy', 'afternoon_foggy',
    'golden_sunny', 'golden_cloudy', 'golden_rainy',
    'dusk_clear', 'dusk_cloudy',
    'evening_clear', 'evening_cloudy',
    'placeholder',
  ]);

  // Keys whose image failed to load this session — skipped on re-resolve so a
  // not-yet-designed art file degrades to the next-best art instead of the
  // placeholder. Cleared on reload.
  const MISSING = new Set();
  function _avail(key) { return AVAILABLE.has(key) && !MISSING.has(key); }

  // Slot adjacency order (wraps: night <-> evening).
  const SLOT_ORDER = [
    'night', 'predawn', 'dawn', 'morning',
    'midday', 'afternoon', 'golden', 'dusk', 'evening',
  ];

  // For a given weather condition, the ordered list of image-condition tokens to
  // try. Captures synonyms (sunny<->clear, partly_cloudy->cloudy) and graceful
  // degradation (rain/storm/snow/fog all imply clouds).
  const CONDITION_FALLBACKS = {
    sunny:         ['sunny', 'clear'],
    clear:         ['clear', 'sunny'],
    partly_cloudy: ['partly_cloudy', 'cloudy', 'clear', 'sunny'],
    cloudy:        ['cloudy', 'partly_cloudy'],
    rainy:         ['rainy', 'cloudy'],
    stormy:        ['stormy', 'rainy', 'cloudy'],
    snowy:         ['snowy', 'cloudy'],
    foggy:         ['foggy', 'cloudy'],
  };

  // Generic same-slot fallbacks appended after condition-specific ones.
  // (Spec order: cloudy, then sunny/clear.)
  const GENERIC_FALLBACKS = ['cloudy', 'sunny', 'clear'];

  // --- DOM handles (resolved in init) ---------------------------------------
  let layerA = null;
  let layerB = null;
  let preloadImg = null;
  let activeLayer = 'a';        // which layer is currently visible
  let currentKey = null;        // resolved image key currently shown
  let lastSlot = null;
  let lastCondition = null;
  let preloadTimer = null;
  let preloadKey = null;        // key currently being warmed (dedupe)

  function pathForKey(key, ext = EXTENSIONS[0]) {
    return `${ASSET_DIR}${key}${ext}`;
  }

  // Load `key` into an <img>, trying each extension in EXTENSIONS order. Calls
  // onLoaded(path) on the first success, or onFailed() if none load.
  function _attemptLoad(el, key, onLoaded, onFailed) {
    let i = 0;
    const tryNext = () => {
      if (i >= EXTENSIONS.length) { el.onload = null; el.onerror = null; onFailed(); return; }
      const ext = EXTENSIONS[i++];
      el.onload = () => { el.onload = null; el.onerror = null; onLoaded(pathForKey(key, ext)); };
      el.onerror = () => { tryNext(); };
      el.src = pathForKey(key, ext);
      // cached images may not re-fire onload — resolve synchronously if ready
      if (el.complete && el.naturalWidth > 0) el.onload();
    };
    tryNext();
  }

  // Build the ordered list of candidate conditions for a slot.
  function _candidateConditions(condition) {
    const seen = new Set();
    const out = [];
    const push = (c) => { if (c && !seen.has(c)) { seen.add(c); out.push(c); } };
    (CONDITION_FALLBACKS[condition] || [condition]).forEach(push);
    GENERIC_FALLBACKS.forEach(push);
    return out;
  }

  // Resolve (slot, condition) -> an available image key, walking the fallback
  // chain: exact -> condition synonyms in same slot -> generic same-slot ->
  // adjacent slots (same condition chain) -> placeholder.
  function resolveKey(slot, condition) {
    const conds = _candidateConditions(condition);

    // 1-3) same slot, condition chain (exact first, then synonyms/generic)
    for (const c of conds) {
      const key = `${slot}_${c}`;
      if (_avail(key)) return key;
    }

    // 4) adjacent slots, same condition chain
    const idx = SLOT_ORDER.indexOf(slot);
    if (idx !== -1) {
      const neighbors = [
        SLOT_ORDER[(idx - 1 + SLOT_ORDER.length) % SLOT_ORDER.length],
        SLOT_ORDER[(idx + 1) % SLOT_ORDER.length],
      ];
      for (const nb of neighbors) {
        for (const c of conds) {
          const key = `${nb}_${c}`;
          if (_avail(key)) return key;
        }
      }
    }

    // 5) give up
    return PLACEHOLDER_KEY;
  }

  function _activeEl() { return activeLayer === 'a' ? layerA : layerB; }
  function _hiddenEl() { return activeLayer === 'a' ? layerB : layerA; }

  // Set an image immediately on the active layer, no fade (used at startup).
  function _setImmediate(key) {
    const el = _activeEl();
    el.style.transition = 'none';
    _attemptLoad(
      el,
      key,
      () => {
        // force reflow so transition:none takes effect before restoring it
        void el.offsetWidth;
        el.style.opacity = '1';
        el.style.transition = '';
        currentKey = key;
      },
      () => {
        if (key !== PLACEHOLDER_KEY) {
          MISSING.add(key);
          const next = resolveKey(lastSlot, lastCondition);
          console.warn(`[SkyManager] image not found: ${key} — re-resolving to ${next}`);
          _setImmediate(next !== key ? next : PLACEHOLDER_KEY);
        } else {
          console.error('[SkyManager] placeholder failed to load — check assets/sky/placeholder.webp');
        }
      }
    );
  }

  // Crossfade the hidden layer in and the active layer out.
  function crossfadeTo(key, durationMs = DEFAULT_FADE_MS) {
    if (key === currentKey) return; // no-op: already showing this image

    const incoming = _hiddenEl();
    const outgoing = _activeEl();
    const fade = `${(durationMs / 1000).toFixed(2)}s`;

    _attemptLoad(
      incoming,
      key,
      () => {
        incoming.style.transition = `opacity ${fade} ease-in-out`;
        outgoing.style.transition = `opacity ${fade} ease-in-out`;
        // next frame so the browser registers the starting opacities
        requestAnimationFrame(() => {
          incoming.style.opacity = '1';
          outgoing.style.opacity = '0';
        });
        // settle bookkeeping after the fade completes
        activeLayer = activeLayer === 'a' ? 'b' : 'a';
        currentKey = key;
      },
      () => {
        if (key !== PLACEHOLDER_KEY) {
          MISSING.add(key);
          const next = resolveKey(lastSlot, lastCondition);
          console.warn(`[SkyManager] crossfade target not found: ${key} — re-resolving to ${next}`);
          crossfadeTo(next !== key ? next : PLACEHOLDER_KEY, durationMs);
        } else {
          console.error('[SkyManager] placeholder failed to load.');
        }
      }
    );
  }

  // Compute the slot we will transition INTO next (for preloading).
  function _nextSlot() {
    const mins = TimeSystem.getNextSlotChangeMinutes();
    const future = new Date(Date.now() + mins * 60 * 1000);
    return TimeSystem.getSlot(future.getHours());
  }

  // If a slot change is imminent (<= 5 min), warm the next image into cache.
  function _checkPreload() {
    const mins = TimeSystem.getNextSlotChangeMinutes();
    if (mins > 5) return;
    const nextSlot = _nextSlot();
    const cond = lastCondition || WeatherSystem.condition || 'sunny';
    const key = resolveKey(nextSlot, cond);
    if (preloadKey === key) return; // already warming this one
    preloadKey = key;
    console.log(`[SkyManager] preloading next slot art: ${key} (slot change in ${mins} min)`);
    // warm whichever extension actually exists
    _attemptLoad(preloadImg, key, () => {}, () => {});
  }

  // Public: called on slot change OR weather change. Crossfades only if the
  // resolved image key actually changed.
  function update(slot, condition) {
    lastSlot = slot;
    lastCondition = condition;
    const key = resolveKey(slot, condition);
    console.log(`[SkyManager] update — slot: ${slot}, condition: ${condition}, resolved key: ${key}`);
    if (key !== currentKey) {
      crossfadeTo(key);
    }
  }

  function init() {
    layerA = document.getElementById('sky-a');
    layerB = document.getElementById('sky-b');
    preloadImg = document.getElementById('sky-preload');

    if (!layerA || !layerB) {
      console.error('[SkyManager] missing #sky-a / #sky-b elements — cannot init.');
      return;
    }

    const now = TimeSystem.getNow();
    const condition = (window.WeatherSystem && WeatherSystem.condition) || 'sunny';
    lastSlot = now.slot;
    lastCondition = condition;

    const key = resolveKey(now.slot, condition);
    console.log(`[SkyManager] init — slot: ${now.slot}, condition: ${condition}, resolved key: ${key}`);
    _setImmediate(key);

    // periodic preload check (once a minute)
    if (preloadTimer) clearInterval(preloadTimer);
    preloadTimer = setInterval(_checkPreload, 60 * 1000);
    _checkPreload();
  }

  return {
    init,
    update,
    resolveKey,
    crossfadeTo,
    pathForKey,
    get currentKey() { return currentKey; },
    get available() { return new Set(AVAILABLE); },
  };
})();

window.SkyManager = SkyManager;
