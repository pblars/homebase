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
  const KIDS_API = 'api/kids';
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
      body: JSON.stringify({ kidId, name: chore.name, description: chore.description, frequency: chore.frequency, days: chore.days || '' }),
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

  async function addKid(kid) {
    const res = await fetch(KIDS_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(kid),
    });
    if (!res.ok) throw new Error('add kid failed (' + res.status + ')');
    await load();
    return res.json().catch(() => ({}));
  }

  async function removeKid(id) {
    const res = await fetch(KIDS_API + '/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error('remove kid failed (' + res.status + ')');
    await load();
  }

  async function updateKid(id, fields) {
    const res = await fetch(KIDS_API + '/' + encodeURIComponent(id), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) throw new Error('update kid failed (' + res.status + ')');
    await load();
  }

  // Move a board member's card one slot left/right and persist the new order.
  // Optimistic: reorders window.KIDS + repaints immediately, then writes a
  // normalized 0..n-1 `sort` to every kid so all devices show the same order.
  async function reorderBoardKid(kidId, dir) {
    const all = (window.KIDS || []).slice();
    const board = all.filter((k) => k.onBoard !== false);
    const bi = board.findIndex((k) => k.id === kidId);
    if (bi < 0) return;
    const ni = bi + (dir === 'left' ? -1 : 1);
    if (ni < 0 || ni >= board.length) return;           // already at an edge
    // Swap the two board members' positions within the full KIDS array.
    const ai = all.findIndex((k) => k.id === board[bi].id);
    const bj = all.findIndex((k) => k.id === board[ni].id);
    const tmp = all[ai]; all[ai] = all[bj]; all[bj] = tmp;
    apply(all); cacheSet(all); emit();                   // optimistic repaint
    try {
      await Promise.all(all.map((k, i) => fetch(KIDS_API + '/' + encodeURIComponent(k.id), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sort: i }),
      })));
      await load();                                      // resync canonical order
    } catch (e) {
      console.warn('[ChoreData] reorder persist failed (kept local):', e.message);
    }
  }

  return { load, addChore, removeChore, updateChore, addKid, removeKid, updateKid, reorderBoardKid };
})();

window.ChoreData = ChoreData;
