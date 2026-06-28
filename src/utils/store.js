// store.js — tiny global state holder with localStorage persistence.
// Phase 1 stub; screens build on this in later phases.

const Store = (() => {
  const PREFIX = 'homebase:';
  const mem = {};
  const listeners = {};

  function get(key, fallback = null) {
    if (key in mem) return mem[key];
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw != null) { mem[key] = JSON.parse(raw); return mem[key]; }
    } catch (_) { /* ignore */ }
    return fallback;
  }

  function set(key, value) {
    mem[key] = value;
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (_) { /* ignore */ }
    (listeners[key] || []).forEach((cb) => { try { cb(value); } catch (e) { console.error(e); } });
  }

  function subscribe(key, cb) {
    (listeners[key] = listeners[key] || []).push(cb);
  }

  return { get, set, subscribe };
})();

window.Store = Store;
