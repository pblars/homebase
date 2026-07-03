// WeatherLocations.js
// -----------------------------------------------------------------------------
// The Weather tab's saved locations: the PRIMARY (home) location from config.js
// (always present, not removable — it also drives the sky) plus up to 3 extra
// locations the user adds, persisted in localStorage. Geocoding (city or US ZIP
// → lat/lon) uses OpenWeatherMap's free Geocoding API with the same key.
//
// Exposed as the global `WeatherLocations`.
// -----------------------------------------------------------------------------

const WeatherLocations = (() => {
  const KEY = 'homebase_wx_locations';
  const MAX_SECONDARY = 3;

  function _cfg() { return typeof CONFIG !== 'undefined' ? CONFIG : {}; }
  function _apiKey() { return _cfg().OPENWEATHERMAP_API_KEY || ''; }

  function _primary() {
    const c = _cfg();
    return {
      id: 'home',
      name: c.LOCATION_LABEL || 'Home',
      zip: c.ZIP || '37064',
      lat: c.LAT != null ? c.LAT : null,
      lon: c.LON != null ? c.LON : null,
      primary: true,
    };
  }

  function _loadSecondary() {
    try {
      const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(arr) ? arr.slice(0, MAX_SECONDARY) : [];
    } catch (_) { return []; }
  }
  function _saveSecondary(arr) {
    try { localStorage.setItem(KEY, JSON.stringify(arr.slice(0, MAX_SECONDARY))); }
    catch (_) { /* ignore quota / private-mode */ }
  }

  function list() { return [_primary()].concat(_loadSecondary()); }
  function get(id) { return list().find((l) => l.id === id) || null; }
  function canAdd() { return _loadSecondary().length < MAX_SECONDARY; }

  // loc = { name, lat, lon, zip? }. Returns the stored entry.
  function add(loc) {
    const arr = _loadSecondary();
    if (arr.length >= MAX_SECONDARY) throw new Error(`You can save up to ${MAX_SECONDARY} extra locations.`);
    if (loc.lat == null || loc.lon == null) throw new Error('That location is missing coordinates.');
    const dup = arr.find((l) => Math.abs(l.lat - loc.lat) < 0.05 && Math.abs(l.lon - loc.lon) < 0.05);
    if (dup) return dup;
    const entry = {
      id: 'loc_' + Date.now().toString(36),
      name: loc.name, lat: loc.lat, lon: loc.lon, zip: loc.zip || null, primary: false,
    };
    arr.push(entry);
    _saveSecondary(arr);
    return entry;
  }

  function remove(id) { _saveSecondary(_loadSecondary().filter((l) => l.id !== id)); }

  // City name ("Nashville", "Austin, TX") or US ZIP → { name, lat, lon, zip? }.
  async function geocode(query) {
    const key = _apiKey();
    const q = String(query || '').trim();
    if (!q) throw new Error('Enter a city or ZIP code.');
    if (!key) throw new Error('Weather API key is not configured.');

    const isZip = /^\d{5}$/.test(q);
    const url = isZip
      ? `https://api.openweathermap.org/geo/1.0/zip?zip=${q},US&appid=${key}`
      : `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${key}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status === 404 ? "Couldn't find that location." : `Lookup failed (HTTP ${res.status}).`);
    const data = await res.json();

    if (isZip) {
      if (!data || data.lat == null) throw new Error("Couldn't find that ZIP code.");
      return { name: data.name || q, lat: data.lat, lon: data.lon, zip: q };
    }
    if (!Array.isArray(data) || !data.length) throw new Error("Couldn't find that city.");
    const d = data[0];
    return { name: d.state ? `${d.name}, ${d.state}` : d.name, lat: d.lat, lon: d.lon };
  }

  return { list, get, canAdd, add, remove, geocode, MAX_SECONDARY };
})();

window.WeatherLocations = WeatherLocations;
