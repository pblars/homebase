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
// Completion is keyed by PERIOD, which depends on the chore's frequency:
//   • DAILY chore  -> period = calendar date 'YYYY-MM-DD'  (resets each day)
//   • WEEKLY chore -> period = ISO week number '27'         (resets each week)
// Acorns are a lifetime running total (never reset) — checking a chore adds one,
// so re-doing daily chores day after day keeps the acorns summing up.
//
// localStorage cache keys:
//   homebase_chores_{kidId}_{period}   -> { choreId: boolean }  (one bucket/period)
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
  function choreDef(kidId, choreId) {
    const k = kid(kidId);
    return k ? (k.chores || []).find((c) => c.id === choreId) || null : null;
  }

  const isDaily = (c) => !c || c.frequency !== 'Weekly';
  function getWeekKey() { return String(getISOWeek(new Date())); }
  function dayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  // The completion bucket a chore lives in: date for daily, week for weekly.
  function periodOf(c) { return isDaily(c) ? dayKey() : getWeekKey(); }

  const choreKey = (kidId, period) => `homebase_chores_${kidId}_${period}`;
  const acornKey = (kidId) => `homebase_acorns_${kidId}`;
  const questKey = (wk) => `homebase_quest_${wk}`;

  function read(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw == null ? fallback : JSON.parse(raw); }
    catch (_) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) { /* ignore quota/private mode */ }
  }

  // Count of in-flight write-throughs. A background load() skips while this is
  // > 0 so a periodic sync can't overwrite an optimistic toggle with stale
  // server data before its POST has landed.
  let pendingWrites = 0;

  // Background write-through to D1. Fire-and-forget; failures leave the optimistic
  // local state in place, to be reconciled on the next load().
  function post(body) {
    pendingWrites += 1;
    return fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).finally(() => { pendingWrites = Math.max(0, pendingWrites - 1); });
  }

  // { choreId: boolean } for a kid — each chore read from its own period bucket
  // (daily = today's date, weekly = this week), defaulting to false.
  function getChoreState(kidId) {
    const chores = kid(kidId) ? kid(kidId).chores : [];
    const bucketCache = {};
    const state = {};
    chores.forEach((c) => {
      const p = periodOf(c);
      if (!(p in bucketCache)) bucketCache[p] = read(choreKey(kidId, p), {}) || {};
      state[c.id] = !!bucketCache[p][c.id];
    });
    return state;
  }

  function getAcorns(kidId) {
    const n = parseInt(read(acornKey(kidId), 0), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  function setAcorns(kidId, n) { write(acornKey(kidId), Math.max(0, n)); }

  function toggleChore(kidId, choreId) {
    const period = periodOf(choreDef(kidId, choreId));
    const key = choreKey(kidId, period);
    const bucket = read(key, {}) || {};
    const done = !bucket[choreId];
    bucket[choreId] = done;
    write(key, bucket);

    // Optimistic acorn update for an instant UI; the server is authoritative and
    // reconciles below. (Acorns are lifetime — a daily reset never subtracts one,
    // since it's a new day's bucket, not an uncheck.)
    const acorns = done ? getAcorns(kidId) + 1 : Math.max(0, getAcorns(kidId) - 1);
    setAcorns(kidId, acorns);

    window.dispatchEvent(new CustomEvent('choreupdate', { detail: { kidId, choreId, done, acorns } }));
    window.dispatchEvent(new CustomEvent('questupdate', { detail: getFamilyProgress() }));

    // Write through to D1 and reconcile the acorn count to the server's value.
    post({ action: 'toggle', period, kidId, choreId, done })
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

  // Clears this week's WEEKLY chore completion + quest meta. Daily chores reset
  // on their own each day (date-keyed bucket). Acorns are untouched.
  function resetWeek() {
    const wk = getWeekKey();
    kids().forEach((k) => {
      const weekly = (k.chores || []).filter((c) => !isDaily(c));
      if (!weekly.length) return;
      const st = {};
      weekly.forEach((c) => { st[c.id] = false; });
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
    // Don't sync while a local write is still being written through — a stale GET
    // could momentarily revert the tap the user just made.
    if (pendingWrites > 0) return;
    const wk = getWeekKey();
    try {
      const res = await fetch(`${API}?week=${encodeURIComponent(wk)}&date=${encodeURIComponent(dayKey())}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      hydrate(data);
      window.dispatchEvent(new CustomEvent('choreupdate', { detail: {} }));
      window.dispatchEvent(new CustomEvent('questupdate', { detail: getFamilyProgress() }));
    } catch (e) {
      console.warn('[QuestStore] API unavailable — using local cache:', e.message);
    }
  }

  // Rebuild the local period buckets from the shared D1 state. The GET returns
  // completion for both this week and today; each chore is filed into its own
  // period bucket (daily = date, weekly = week), so the buckets exactly mirror
  // the server (a chore with no row reads as false).
  function hydrate(data) {
    if (!data || typeof data !== 'object') return;
    const completion = data.completion || {};
    kids().forEach((k) => {
      const kc = completion[k.id] || {};
      const buckets = {};
      (k.chores || []).forEach((c) => {
        const p = periodOf(c);
        (buckets[p] = buckets[p] || {})[c.id] = !!kc[c.id];
      });
      Object.keys(buckets).forEach((p) => write(choreKey(k.id, p), buckets[p]));
    });
    const acorns = data.acorns || {};
    Object.keys(acorns).forEach((kidId) => setAcorns(kidId, parseInt(acorns[kidId], 10) || 0));
    const q = data.quest || {};
    write(questKey(getWeekKey()), { completed: !!q.completed, celebrationShown: !!q.celebrationShown });
  }

  return {
    getWeekKey, getChoreState, toggleChore, getAcorns, getFamilyProgress,
    isKidComplete, getQuestMeta, setQuestMeta, markCelebrationShown, isCelebrationShown,
    isNewWeek, resetWeek, ensureWeekMarker, load,
  };
})();

window.QuestStore = QuestStore;
