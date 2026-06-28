// TimeSystem.js
// -----------------------------------------------------------------------------
// Singleton that maps the wall clock to one of 8 named "time slots" and notifies
// listeners when the slot changes. Ticks once a minute. Exposed as the global
// `TimeSystem`.
//
// Slot boundaries (hour 0-23):
//   night:     22, 23, 0, 1, 2, 3, 4
//   predawn:   5
//   dawn:      6, 7
//   morning:   8, 9          (10 belongs to midday — see note)
//   midday:    10, 11, 12, 13
//   afternoon: 14, 15, 16
//   golden:    17, 18
//   dusk:      19, 20
//   evening:   21
//
// NOTE: The spec lists morning as 8-10 and midday as 10-14, so hour 10 is
// ambiguous. We resolve the overlap in favor of midday (the later slot wins) so
// every hour maps to exactly one slot. Likewise golden 17-19 / dusk 19-21 /
// evening 21-22 overlaps are resolved to the later slot at each boundary.
// -----------------------------------------------------------------------------

const TimeSystem = (() => {
  const SLOT_ORDER = [
    'night', 'predawn', 'dawn', 'morning',
    'midday', 'afternoon', 'golden', 'dusk', 'evening',
  ];

  // Per-hour lookup table, single source of truth for slot resolution.
  // index = hour (0-23)
  const HOUR_TO_SLOT = [
    'night',     //  0
    'night',     //  1
    'night',     //  2
    'night',     //  3
    'night',     //  4
    'predawn',   //  5
    'dawn',      //  6
    'dawn',      //  7
    'morning',   //  8
    'morning',   //  9
    'midday',    // 10
    'midday',    // 11
    'midday',    // 12
    'midday',    // 13
    'afternoon', // 14
    'afternoon', // 15
    'afternoon', // 16
    'golden',    // 17
    'golden',    // 18
    'dusk',      // 19
    'dusk',      // 20
    'evening',   // 21
    'night',     // 22
    'night',     // 23
  ];

  let currentSlot = null;
  let tickHandle = null;
  const slotChangeListeners = [];

  function getSlot(hour) {
    const h = ((Math.floor(hour) % 24) + 24) % 24; // normalize to 0-23
    return HOUR_TO_SLOT[h];
  }

  function getNow() {
    const d = new Date();
    const hour = d.getHours();
    const minute = d.getMinutes();
    const slot = getSlot(hour);
    // dayProgress: 0.0 at 00:00 -> 1.0 at 24:00
    const dayProgress = (hour * 60 + minute) / (24 * 60);
    return { hour, minute, slot, dayProgress };
  }

  // Minutes until the slot value actually changes (scans forward up to 24h).
  function getNextSlotChangeMinutes() {
    const d = new Date();
    const startMinutes = d.getHours() * 60 + d.getMinutes();
    const startSlot = getSlot(d.getHours());

    for (let delta = 1; delta <= 24 * 60; delta++) {
      const m = (startMinutes + delta) % (24 * 60);
      const hour = Math.floor(m / 60);
      if (getSlot(hour) !== startSlot) {
        return delta;
      }
    }
    return 24 * 60; // should never happen
  }

  function onSlotChange(callback) {
    if (typeof callback === 'function') slotChangeListeners.push(callback);
  }

  function _emitSlotChange(slot) {
    slotChangeListeners.forEach((cb) => {
      try {
        cb(slot);
      } catch (err) {
        console.error('[TimeSystem] slotChange listener error:', err);
      }
    });
  }

  function _tick() {
    const slot = getNow().slot;
    if (slot !== currentSlot) {
      const prev = currentSlot;
      currentSlot = slot;
      if (prev !== null) {
        console.log(`[TimeSystem] slot change: ${prev} -> ${slot}`);
        _emitSlotChange(slot);
      }
    }
  }

  function init() {
    currentSlot = getNow().slot;
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = setInterval(_tick, 60 * 1000); // every 60s
    console.log(`[TimeSystem] init — slot: ${currentSlot}`);
    return currentSlot;
  }

  return {
    init,
    getSlot,
    getNow,
    getNextSlotChangeMinutes,
    onSlotChange,
    get slots() { return SLOT_ORDER.slice(); },
    get currentSlot() { return currentSlot; },
  };
})();

window.TimeSystem = TimeSystem;
