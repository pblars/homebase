// QuestStore.js
// -----------------------------------------------------------------------------
// Single source of truth for all quest + chore state. Every read/write goes
// through here. State is SHARED across devices via Cloudflare D1 (/api/progress);
// localStorage is kept as an offline cache on top, so the wall tablet renders
// instantly and keeps working when the API is briefly unreachable.
//
// Reads are synchronous (served from the localStorage cache) so callers don't
// change. Writes are optimistic: update the local cache + fire events for an
// instant UI, then write through to D1 in the background and reconcile.
//
// Sync model (no background polling — by design): load() pulls the shared state
// on app start and on wake (see main.js / SleepScreen). A change on one device
// shows on another on its next load/wake.
//
// localStorage cache keys (mirror of the D1 rows for the current week):
//   homebase_chores_{kidId}_{isoWeek}  -> { choreId: boolean }
//   homebase_acorns_{kidId}            -> lifetime integer acorn count
//   homebase_quest_{isoWeek}           -> { completed, celebrationShown }
//   homebase_current_week              -> last-seen ISO week marker (per device)
//
// Dispatches window CustomEvents on change: 'choreupdate' and 'questupdate'.
// -----------------------------------------------------------------------------

const QuestStore = (() => {
  const CUR_WEEK_KEY = 'homebase_current_week';
  const API = 'api/progress';               // relative -> /api/progress on the deployed site

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

  // Background write-through to D1. Fire-and-forget; failures leave the optimistic
  // local state in place, to be reconciled on the next load().
  function post(body) {
    return fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
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

    // Optimistic acorn update for an instant UI; the server is authoritative and
    // reconciles below.
    const acorns = done ? getAcorns(kidId) + 1 : Math.max(0, getAcorns(kidId) - 1);
    setAcorns(kidId, acorns);

    window.dispatchEvent(new CustomEvent('choreupdate', { detail: { kidId, choreId, done, acorns } }));
    window.dispatchEvent(new CustomEvent('questupdate', { detail: getFamilyProgress() }));

    // Write through to D1 and reconcile the acorn count to the server's value.
    post({ action: 'toggle', week: wk, kidId, choreId, done })
      .then((res) => (res && res.ok ? res.json() : null))
      .then((data) => {
        if (!data || typeof data.acorns !== 'number') return;
        if (data.acorns !== getAcorns(kidId)) {
          setAcorns(kidId, data.acorns);
          // done:false -> refresh the count without replaying the +1 animation.
          window.dispatchEvent(new CustomEvent('choreupdate', { detail: { kidId, done: false, acorns: data.acorns } }));
        }
      })
      .catch((e) => console.warn('[QuestStore] toggle sync failed (kept local):', e.message));

    return done;
  }

  function getFamilyProgress() {
    let total = 0;
    let completed = 0;
    // Only members on the chore board count toward the family quest.
    kids().filter((k) => k.onBoard !== false).forEach((k) => {
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
  function setQuestMeta(m) {
    const wk = getWeekKey();
    write(questKey(wk), m);
    post({ action: 'quest', week: wk, completed: !!m.completed, celebrationShown: !!m.celebrationShown })
      .catch((e) => console.warn('[QuestStore] quest-meta sync failed (kept local):', e.message));
  }
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
    write(questKey(wk), { completed: false, celebrationShown: false });
    ensureWeekMarker();
    // Write through so every device converges on the reset week (idempotent).
    post({ action: 'reset', week: wk })
      .catch((e) => console.warn('[QuestStore] reset sync failed (kept local):', e.message));
  }

  // Pull the shared state for the current week from D1 into the local cache and
  // repaint. Called on app start and on wake (main.js). Falls back to the
  // existing local cache if the API is unreachable.
  async function load() {
    const wk = getWeekKey();
    try {
      const res = await fetch(`${API}?week=${encodeURIComponent(wk)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      hydrate(wk, data);
      window.dispatchEvent(new CustomEvent('choreupdate', { detail: {} }));
      window.dispatchEvent(new CustomEvent('questupdate', { detail: getFamilyProgress() }));
    } catch (e) {
      console.warn('[QuestStore] API unavailable — using local cache:', e.message);
    }
  }

  // Overwrite the local cache for the current week with the shared D1 state.
  function hydrate(wk, data) {
    if (!data || typeof data !== 'object') return;
    const completion = data.completion || {};
    kids().forEach((k) => { write(choreKey(k.id, wk), completion[k.id] || {}); });
    const acorns = data.acorns || {};
    Object.keys(acorns).forEach((kidId) => setAcorns(kidId, parseInt(acorns[kidId], 10) || 0));
    const q = data.quest || {};
    write(questKey(wk), { completed: !!q.completed, celebrationShown: !!q.celebrationShown });
  }

  return {
    getWeekKey, getChoreState, toggleChore, getAcorns, getFamilyProgress,
    isKidComplete, getQuestMeta, setQuestMeta, markCelebrationShown, isCelebrationShown,
    isNewWeek, resetWeek, ensureWeekMarker, load,
  };
})();

window.QuestStore = QuestStore;
