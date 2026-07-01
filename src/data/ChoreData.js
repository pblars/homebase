// ChoreData.js
// -----------------------------------------------------------------------------
// Client data layer for chore DEFINITIONS (kids + chores), backed by the D1
// database via /api/chores. Completion + acorns stay local (QuestStore); this
// only manages who-has-which-chores.
//
// Strategy for a wall tablet that must stay up:
//   • window.KIDS starts as the built-in defaults (chores.js) so the board
//     renders instantly even before the DB is reachable.
//   • load() paints from the localStorage cache first, then fetches the API and
//     updates. If the API is unreachable, the cache/defaults remain.
//   • add/remove/update call the API then reload.
// Dispatches 'choresupdated' (and a 'questupdate') so the UI re-renders.
// -----------------------------------------------------------------------------

const ChoreData = (() => {
  const API = 'api/chores';                 // relative → /api/chores on the deployed site
  const CACHE_KEY = 'homebase_chore_defs';

  function cacheGet() {
    try { const r = localStorage.getItem(CACHE_KEY); return r ? JSON.parse(r) : null; }
    catch (_) { return null; }
  }
  function cacheSet(kids) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(kids)); } catch (_) { /* ignore */ }
  }

  function apply(kids) {
    if (Array.isArray(kids) && kids.length) window.KIDS = kids;
  }

  function emit() {
    window.dispatchEvent(new CustomEvent('choresupdated'));
    // keep the quest banner % in sync with the new chore total
    if (window.QuestStore) {
      window.dispatchEvent(new CustomEvent('questupdate', { detail: QuestStore.getFamilyProgress() }));
    }
  }

  async function load() {
    // 1) instant paint from cache (window.KIDS already holds defaults otherwise)
    const cached = cacheGet();
    if (cached) { apply(cached); emit(); }
    // 2) refresh from the database
    try {
      const res = await fetch(API, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data && Array.isArray(data.kids) && data.kids.length) {
        apply(data.kids);
        cacheSet(data.kids);
        emit();
      }
    } catch (e) {
      console.warn('[ChoreData] API unavailable — using cache/defaults:', e.message);
    }
  }

  async function addChore(kidId, chore) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kidId, name: chore.name, description: chore.description, frequency: chore.frequency }),
    });
    if (!res.ok) throw new Error('add failed (' + res.status + ')');
    await load();
    return res.json().catch(() => ({}));
  }

  async function removeChore(id) {
    const res = await fetch(API + '/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error('remove failed (' + res.status + ')');
    await load();
  }

  async function updateChore(id, fields) {
    const res = await fetch(API + '/' + encodeURIComponent(id), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) throw new Error('update failed (' + res.status + ')');
    await load();
  }

  return { load, addChore, removeChore, updateChore };
})();

window.ChoreData = ChoreData;
