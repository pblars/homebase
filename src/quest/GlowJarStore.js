// GlowJarStore.js
// -----------------------------------------------------------------------------
// State for the Family Glow Jars reward: each child collects glowing lightning
// bugs in their jar over the week. Mirrors the QuestStore pattern — synchronous
// localStorage reads, a PERIOD-keyed bucket so it resets automatically, and the
// SAME weekly cadence as chores (keyed by ISO week; a new week starts empty, and
// the 'weekreset' event repaints). Deliberately local-only + tiny: no new state
// library, no D1 migration — the counts are a lightweight family delight.
//
// localStorage cache key:
//   homebase_glowjars_{isoWeek}  -> { childId: count }   (one bucket per week)
//
// Dispatches window CustomEvent 'glowjarupdate' on change so the card repaints.
// -----------------------------------------------------------------------------

const GlowJarStore = (() => {
  function weekKey() { return String(getISOWeek(new Date())); }
  const bucketKey = (wk) => `homebase_glowjars_${wk}`;

  function read(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw == null ? fallback : JSON.parse(raw); }
    catch (_) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) { /* ignore quota/private mode */ }
  }

  function bucket() { return read(bucketKey(weekKey()), {}) || {}; }

  function getCount(childId) {
    const n = parseInt(bucket()[childId], 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function set(childId, n) {
    const b = bucket();
    b[childId] = Math.max(0, n);          // never below 0
    write(bucketKey(weekKey()), b);
    window.dispatchEvent(new CustomEvent('glowjarupdate', { detail: { childId, count: b[childId] } }));
    return b[childId];
  }

  function addGlowBug(childId) { return set(childId, getCount(childId) + 1); }
  function removeGlowBug(childId) { return set(childId, getCount(childId) - 1); }

  // Clear this week's jars. Weekly buckets are ISO-week-keyed, so a new week
  // already starts empty; this makes the reset explicit (called on 'weekreset').
  function resetGlowJarsForWeek() {
    write(bucketKey(weekKey()), {});
    window.dispatchEvent(new CustomEvent('glowjarupdate', { detail: {} }));
  }

  return { getCount, addGlowBug, removeGlowBug, resetGlowJarsForWeek };
})();

window.GlowJarStore = GlowJarStore;
