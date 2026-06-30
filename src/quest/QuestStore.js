// QuestStore.js
// -----------------------------------------------------------------------------
// Single source of truth for all quest + chore state. Every read/write goes
// through here; persistence is localStorage. Classic-script global `QuestStore`.
//
// localStorage keys:
//   homebase_chores_{kidId}_{isoWeek}  -> { choreId: boolean } per kid per week
//   homebase_acorns_{kidId}            -> lifetime integer acorn count (never resets)
//   homebase_quest_{isoWeek}           -> { completed, celebrationShown }
//   homebase_current_week              -> last-seen ISO week marker (reset detection)
//
// Dispatches window CustomEvents on change: 'choreupdate' and 'questupdate'.
// -----------------------------------------------------------------------------

const QuestStore = (() => {
  const CUR_WEEK_KEY = 'homebase_current_week';

  function kids() { return window.KIDS || []; }
  function kid(id) { return kids().find((k) => k.id === id) || null; }

  function getWeekKey() { return String(getISOWeek(new Date())); }

  const choreKey = (kidId, wk) => `homebase_chores_${kidId}_${wk}`;
  const acornKey = (kidId) => `homebase_acorns_${kidId}`;
  const questKey = (wk) => `homebase_quest_${wk}`;

  function read(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw == null ? fallback : JSON.parse(raw); }
    catch (_) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) { /* ignore quota/private mode */ }
  }

  // { choreId: boolean } for the current week, auto-initialized to all-false.
  function getChoreState(kidId) {
    const wk = getWeekKey();
    const key = choreKey(kidId, wk);
    let state = read(key, null);
    if (!state || typeof state !== 'object') state = {};
    const ids = (kid(kidId) ? kid(kidId).chores : []).map((c) => c.id);
    let changed = false;
    ids.forEach((id) => { if (!(id in state)) { state[id] = false; changed = true; } });
    if (changed) write(key, state);
    return state;
  }

  function getAcorns(kidId) {
    const n = parseInt(read(acornKey(kidId), 0), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  function setAcorns(kidId, n) { write(acornKey(kidId), Math.max(0, n)); }

  function toggleChore(kidId, choreId) {
    const wk = getWeekKey();
    const key = choreKey(kidId, wk);
    const state = getChoreState(kidId);
    const done = !state[choreId];
    state[choreId] = done;
    write(key, state);

    const acorns = done ? getAcorns(kidId) + 1 : Math.max(0, getAcorns(kidId) - 1);
    setAcorns(kidId, acorns);

    window.dispatchEvent(new CustomEvent('choreupdate', { detail: { kidId, choreId, done, acorns } }));
    window.dispatchEvent(new CustomEvent('questupdate', { detail: getFamilyProgress() }));
    return done;
  }

  function getFamilyProgress() {
    let total = 0;
    let completed = 0;
    kids().forEach((k) => {
      const st = getChoreState(k.id);
      k.chores.forEach((c) => { total += 1; if (st[c.id]) completed += 1; });
    });
    const percentage = total ? Math.round((completed / total) * 100) : 0;
    const w = Math.floor(percentage / 20);
    return {
      totalChores: total,
      completedChores: completed,
      percentage,
      currentWaypoint: Math.min(5, w),
      nextWaypointAt: Math.min(100, (w + 1) * 20),
      isComplete: total > 0 && percentage === 100,
    };
  }

  // Per-kid completion helper (used for confetti).
  function isKidComplete(kidId) {
    const st = getChoreState(kidId);
    const k = kid(kidId);
    return !!k && k.chores.length > 0 && k.chores.every((c) => st[c.id]);
  }

  function getQuestMeta() { return read(questKey(getWeekKey()), { completed: false, celebrationShown: false }); }
  function setQuestMeta(m) { write(questKey(getWeekKey()), m); }
  function markCelebrationShown() { const m = getQuestMeta(); m.completed = true; m.celebrationShown = true; setQuestMeta(m); }
  function isCelebrationShown() { return !!getQuestMeta().celebrationShown; }

  function isNewWeek() { return read(CUR_WEEK_KEY, null) !== getWeekKey(); }
  function ensureWeekMarker() { write(CUR_WEEK_KEY, getWeekKey()); }

  // Clears this week's chore completion + quest meta. Acorns are untouched.
  function resetWeek() {
    const wk = getWeekKey();
    kids().forEach((k) => {
      const st = {};
      k.chores.forEach((c) => { st[c.id] = false; });
      write(choreKey(k.id, wk), st);
    });
    setQuestMeta({ completed: false, celebrationShown: false });
    ensureWeekMarker();
  }

  return {
    getWeekKey, getChoreState, toggleChore, getAcorns, getFamilyProgress,
    isKidComplete, getQuestMeta, markCelebrationShown, isCelebrationShown,
    isNewWeek, resetWeek, ensureWeekMarker,
  };
})();

window.QuestStore = QuestStore;
