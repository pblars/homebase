// WeatherSystem.js
// -----------------------------------------------------------------------------
// Singleton that fetches current weather + 5-day forecast from OpenWeatherMap,
// maps OWM condition codes to our internal condition strings, caches the result,
// and notifies listeners. Exposed as the global `WeatherSystem`.
//
// Internal condition strings (must match sky image naming):
//   sunny | partly_cloudy | cloudy | rainy | stormy | snowy | foggy
//
// Falls back to { condition: 'sunny', tempF: 72 } if a fetch fails.
// Dispatches a `weatherupdate` CustomEvent on window after every update.
// -----------------------------------------------------------------------------

const WeatherSystem = (() => {
  const REFRESH_MS = 15 * 60 * 1000; // 15 minutes

  const state = {
    condition: 'sunny',
    tempF: 72,
    feelsLikeF: 72,
    description: '',
    humidity: null,
    windMph: null,
    windDeg: null,
    windDir: '',
    sunrise: null,   // unix seconds
    sunset: null,    // unix seconds
    todayHigh: null,
    todayLow: null,
    forecast: [],    // [{ dayName, high, low, condition, precipPct }]
    hourly: [],      // [{ label, tempF, condition, precipPct }] — 'Now' + next steps
  };

  const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  function _compass(deg) { return COMPASS[Math.round((deg % 360) / 45) % 8]; }

  let refreshHandle = null;
  const updateListeners = [];

  // Map an OWM `weather[0].id` code to an internal condition string.
  function mapCondition(owmId) {
    const id = Number(owmId);
    if (id === 800) return 'sunny';
    if (id === 801 || id === 802) return 'partly_cloudy';
    if (id >= 803 && id <= 804) return 'cloudy';
    if (id >= 500 && id <= 531) return 'rainy';
    if (id >= 200 && id <= 232) return 'stormy';
    if (id >= 600 && id <= 622) return 'snowy';
    if (id >= 701 && id <= 741) return 'foggy';
    return 'cloudy'; // catch-all
  }

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function _baseUrl(path) {
    return `https://api.openweathermap.org/data/2.5/${path}`;
  }

  // NOTE: config.js declares `const CONFIG`, which is reachable by bare name
  // across classic <script> tags but is NOT a property of window. So reference
  // CONFIG directly (guarded by typeof) — `window.CONFIG` would be undefined.
  function _cfg() {
    return typeof CONFIG !== 'undefined' ? CONFIG : {};
  }

  function _zip() {
    return _cfg().ZIP || '37064';
  }

  function _key() {
    return _cfg().OPENWEATHERMAP_API_KEY || '';
  }

  // Collapse the 3-hourly forecast list into per-day {high, low, condition, precipPct}.
  function _summarizeForecast(list) {
    const byDay = new Map();

    for (const entry of list) {
      const d = new Date(entry.dt * 1000);
      const dayKey = d.toISOString().slice(0, 10); // YYYY-MM-DD (local-ish; fine for display)

      if (!byDay.has(dayKey)) {
        byDay.set(dayKey, {
          dayName: DAY_NAMES[d.getDay()],
          high: -Infinity,
          low: Infinity,
          // tally conditions to pick the most common one for the day
          conditionCounts: {},
          precipPct: 0,
        });
      }
      const bucket = byDay.get(dayKey);

      const t = entry.main && typeof entry.main.temp === 'number' ? entry.main.temp : null;
      if (t !== null) {
        bucket.high = Math.max(bucket.high, entry.main.temp_max != null ? entry.main.temp_max : t);
        bucket.low = Math.min(bucket.low, entry.main.temp_min != null ? entry.main.temp_min : t);
      }

      const cond = mapCondition(entry.weather && entry.weather[0] && entry.weather[0].id);
      bucket.conditionCounts[cond] = (bucket.conditionCounts[cond] || 0) + 1;

      // pop = probability of precipitation (0..1)
      if (typeof entry.pop === 'number') {
        bucket.precipPct = Math.max(bucket.precipPct, Math.round(entry.pop * 100));
      }
    }

    const days = [];
    for (const bucket of byDay.values()) {
      // pick most frequent condition
      let condition = 'sunny';
      let best = -1;
      for (const [c, n] of Object.entries(bucket.conditionCounts)) {
        if (n > best) { best = n; condition = c; }
      }
      days.push({
        dayName: bucket.dayName,
        high: bucket.high === -Infinity ? null : Math.round(bucket.high),
        low: bucket.low === Infinity ? null : Math.round(bucket.low),
        condition,
        precipPct: bucket.precipPct,
      });
    }
    return days.slice(0, 5);
  }

  // Query string for a location: {lat,lon} preferred, else {zip}, else home zip.
  function _qs(loc) {
    if (loc && loc.lat != null && loc.lon != null) return `lat=${loc.lat}&lon=${loc.lon}`;
    return `zip=${encodeURIComponent((loc && loc.zip) || _zip())},us`;
  }

  // Build a "current conditions" snapshot from an OWM /weather response.
  function _snapCurrent(json) {
    const owmId = json.weather && json.weather[0] && json.weather[0].id;
    const tempF = Math.round(json.main && json.main.temp != null ? json.main.temp : 72);
    const windDeg = json.wind && json.wind.deg != null ? json.wind.deg : null;
    return {
      condition: mapCondition(owmId),
      tempF,
      feelsLikeF: Math.round(json.main && json.main.feels_like != null ? json.main.feels_like : tempF),
      description: (json.weather && json.weather[0] && json.weather[0].description) || '',
      humidity: json.main && json.main.humidity != null ? json.main.humidity : null,
      windMph: json.wind && json.wind.speed != null ? Math.round(json.wind.speed) : null,
      windDeg,
      windDir: windDeg != null ? _compass(windDeg) : '',
      sunrise: json.sys && json.sys.sunrise != null ? json.sys.sunrise : null,
      sunset: json.sys && json.sys.sunset != null ? json.sys.sunset : null,
      todayHigh: null, todayLow: null, forecast: [], hourly: [],
    };
  }

  // 'Now' (current conditions) followed by the next 3-hourly forecast steps,
  // each labelled by its local hour. Feeds the Weather tab's hourly strip +
  // precipitation trend.
  function _buildHourly(list, nowTempF, nowCondition) {
    const out = [{
      label: 'Now', tempF: nowTempF, condition: nowCondition,
      precipPct: (list[0] && typeof list[0].pop === 'number') ? Math.round(list[0].pop * 100) : 0,
    }];
    for (const entry of list.slice(0, 9)) {
      const d = new Date(entry.dt * 1000);
      const h = d.getHours();
      out.push({
        label: `${(h % 12) || 12} ${h < 12 ? 'AM' : 'PM'}`,
        tempF: Math.round(entry.main && entry.main.temp != null ? entry.main.temp : nowTempF),
        condition: mapCondition(entry.weather && entry.weather[0] && entry.weather[0].id),
        precipPct: typeof entry.pop === 'number' ? Math.round(entry.pop * 100) : 0,
      });
    }
    return out;
  }

  // Current-conditions-only fetch for a location (1 call). Used by the Weather
  // tab's non-selected "temp cards".
  async function fetchCurrent(loc) {
    const res = await fetch(`${_baseUrl('weather')}?${_qs(loc)}&appid=${_key()}&units=imperial`);
    if (!res.ok) throw new Error(`current weather HTTP ${res.status}`);
    return _snapCurrent(await res.json());
  }

  // Full snapshot for a location (current + 5-day forecast; forecast best-effort).
  // Does NOT touch the singleton state — safe for arbitrary locations.
  async function fetchSnapshot(loc) {
    const snap = await fetchCurrent(loc);
    try {
      const res = await fetch(`${_baseUrl('forecast')}?${_qs(loc)}&appid=${_key()}&units=imperial&cnt=40`);
      if (res.ok) {
        const list = ((await res.json()).list) || [];
        snap.forecast = _summarizeForecast(list);
        snap.hourly = _buildHourly(list, snap.tempF, snap.condition);
        const today = snap.forecast[0];
        if (today) {
          snap.todayHigh = today.high != null ? Math.max(today.high, snap.tempF) : snap.tempF;
          snap.todayLow = today.low != null ? Math.min(today.low, snap.tempF) : snap.tempF;
        }
      }
    } catch (fErr) {
      console.warn('[WeatherSystem] forecast fetch failed (non-fatal):', fErr.message);
    }
    if (snap.todayHigh == null) { snap.todayHigh = snap.tempF; snap.todayLow = snap.tempF; }
    return snap;
  }

  function _emitUpdate() {
    const snapshot = getState();
    updateListeners.forEach((cb) => {
      try { cb(snapshot); } catch (err) { console.error('[WeatherSystem] onUpdate listener error:', err); }
    });
    window.dispatchEvent(new CustomEvent('weatherupdate', { detail: snapshot }));
  }

  async function _refresh() {
    const key = _key();
    if (!key || key === 'your_key_here') {
      console.warn('[WeatherSystem] No OPENWEATHERMAP_API_KEY set — using fallback weather. Add a real key to config.js.');
      // keep fallback defaults, still emit so the sky resolves
      _emitUpdate();
      return;
    }

    try {
      // Home location drives the sky + dashboard; forecast is best-effort inside.
      const snap = await fetchSnapshot({ zip: _zip() });
      Object.assign(state, snap);
      console.log(`[WeatherSystem] update — ${state.tempF}°F, condition: ${state.condition} (${state.description})`);
      _emitUpdate();
    } catch (err) {
      console.error('[WeatherSystem] fetch failed, using fallback:', err.message);
      state.condition = 'sunny';
      state.tempF = 72;
      state.feelsLikeF = 72;
      _emitUpdate();
    }
  }

  function getState() {
    return {
      condition: state.condition,
      tempF: state.tempF,
      feelsLikeF: state.feelsLikeF,
      description: state.description,
      humidity: state.humidity,
      windMph: state.windMph,
      windDeg: state.windDeg,
      windDir: state.windDir,
      sunrise: state.sunrise,
      sunset: state.sunset,
      todayHigh: state.todayHigh,
      todayLow: state.todayLow,
      forecast: state.forecast.slice(),
      hourly: state.hourly.slice(),
    };
  }

  function onUpdate(callback) {
    if (typeof callback === 'function') updateListeners.push(callback);
  }

  function init() {
    _refresh(); // immediate
    if (refreshHandle) clearInterval(refreshHandle);
    refreshHandle = setInterval(_refresh, REFRESH_MS);
    console.log('[WeatherSystem] init — refreshing every 15 min');
  }

  return {
    init,
    onUpdate,
    getState,
    fetchCurrent,           // current-only snapshot for an arbitrary location
    fetchSnapshot,          // full snapshot for an arbitrary location
    mapCondition,           // exposed for debugging
    refresh: _refresh,      // manual trigger for debugging
    get condition() { return state.condition; },
    get tempF() { return state.tempF; },
  };
})();

window.WeatherSystem = WeatherSystem;
