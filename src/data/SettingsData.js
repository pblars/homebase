// SettingsData.js
// -----------------------------------------------------------------------------
// Site-wide settings (family name, address) from the D1-backed /api/settings.
// Cached to localStorage, falls back to sensible defaults. Dispatches
// 'settingsupdated' so any screen can react. Classic-script global.
// -----------------------------------------------------------------------------

const SettingsData = (() => {
  const API = 'api/settings';
  const CACHE_KEY = 'homebase_settings';
  const DEFAULTS = { family_name: 'Our Family', address: '', city: '', state: '', zip: '' };

  let state = Object.assign({}, DEFAULTS);

  function cacheGet() {
    try { const r = localStorage.getItem(CACHE_KEY); return r ? JSON.parse(r) : null; }
    catch (_) { return null; }
  }
  function cacheSet(v) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch (_) { /* ignore */ } }

  function apply(obj) {
    if (obj && typeof obj === 'object') state = Object.assign({}, DEFAULTS, obj);
    window.SETTINGS = state;
    window.dispatchEvent(new CustomEvent('settingsupdated', { detail: state }));
  }

  async function load() {
    const cached = cacheGet();
    if (cached) apply(cached);
    else window.SETTINGS = state;
    try {
      const res = await fetch(API, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      apply(data);
      cacheSet(state);
    } catch (e) {
      console.warn('[SettingsData] API unavailable — using cache/defaults:', e.message);
    }
  }

  async function save(partial) {
    const res = await fetch(API, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(partial),
    });
    if (!res.ok) throw new Error('save failed (' + res.status + ')');
    apply(Object.assign({}, state, partial));
    cacheSet(state);
  }

  function get(key) { return state[key]; }
  function all() { return Object.assign({}, state); }

  return { load, save, get, all };
})();

window.SettingsData = SettingsData;
