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
  const EXT = '.webp';
  const DEFAULT_FADE_MS = 2500;
  const PLACEHOLDER_KEY = 'placeholder';

  // Hardcoded availability map — the art that actually ships in /assets/sky/.
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

  function pathForKey(key) {
    return `${ASSET_DIR}${key}${EXT}`;
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
      if (AVAILABLE.has(key)) return key;
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
          if (AVAILABLE.has(key)) return key;
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
    el.onerror = () => _handleLoadError(el, key);
    el.style.transition = 'none';
    el.src = pathForKey(key);
    // force reflow so the transition:none takes effect before restoring it
    void el.offsetWidth;
    el.style.opacity = '1';
    el.style.transition = '';
    currentKey = key;
  }

  function _handleLoadError(el, key) {
    if (key === PLACEHOLDER_KEY) {
      console.error('[SkyManager] placeholder failed to load — check assets/sky/placeholder.webp');
      return;
    }
    console.warn(`[SkyManager] image failed to load: ${key}${EXT} — falling back to placeholder`);
    el.onerror = () => _handleLoadError(el, PLACEHOLDER_KEY);
    el.src = pathForKey(PLACEHOLDER_KEY);
    currentKey = PLACEHOLDER_KEY;
  }

  // Crossfade the hidden layer in and the active layer out.
  function crossfadeTo(key, durationMs = DEFAULT_FADE_MS) {
    if (key === currentKey) return; // no-op: already showing this image

    const incoming = _hiddenEl();
    const outgoing = _activeEl();
    const fade = `${(durationMs / 1000).toFixed(2)}s`;

    const finish = () => {
      activeLayer = activeLayer === 'a' ? 'b' : 'a';
      currentKey = key;
    };

    incoming.onerror = () => {
      // load failed — swap to placeholder instead (unless that's what failed)
      if (key !== PLACEHOLDER_KEY) {
        console.warn(`[SkyManager] crossfade target failed: ${key}${EXT} — using placeholder`);
        crossfadeTo(PLACEHOLDER_KEY, durationMs);
      } else {
        console.error('[SkyManager] placeholder failed to load.');
      }
    };

    incoming.onload = () => {
      incoming.style.transition = `opacity ${fade} ease-in-out`;
      outgoing.style.transition = `opacity ${fade} ease-in-out`;
      // next frame so the browser registers the starting opacities
      requestAnimationFrame(() => {
        incoming.style.opacity = '1';
        outgoing.style.opacity = '0';
      });
      // settle bookkeeping after the fade completes
      setTimeout(finish, durationMs + 50);
    };

    incoming.src = pathForKey(key);
    // if the image is already cached, onload may not fire reliably across
    // browsers — guard by checking complete synchronously
    if (incoming.complete && incoming.naturalWidth > 0) {
      incoming.onload();
    }
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
    const path = pathForKey(key);
    if (preloadImg.src.endsWith(path)) return; // already warming this one
    console.log(`[SkyManager] preloading next slot art: ${key} (slot change in ${mins} min)`);
    preloadImg.src = path;
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
