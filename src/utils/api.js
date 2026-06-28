// api.js — shared fetch helpers. Phase 1 stub.
// WeatherSystem currently does its own fetching; later phases (calendar, etc.)
// can route through here for consistent error handling / caching.

const Api = (() => {
  async function getJSON(url, opts = {}) {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }
  return { getJSON };
})();

window.Api = Api;
