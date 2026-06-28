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
    forecast: [], // [{ dayName, high, low, condition, precipPct }]
  };

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

  function _zip() {
    return (window.CONFIG && CONFIG.ZIP) || '37064';
  }

  function _key() {
    return (window.CONFIG && CONFIG.OPENWEATHERMAP_API_KEY) || '';
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
        bucket.high = Math.max(bucket.high, entry.main.temp_max ?? t);
        bucket.low = Math.min(bucket.low, entry.main.temp_min ?? t);
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

  async function _fetchCurrent() {
    const url = `${_baseUrl('weather')}?zip=${encodeURIComponent(_zip())},us&appid=${_key()}&units=imperial`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`current weather HTTP ${res.status}`);
    const json = await res.json();

    const owmId = json.weather && json.weather[0] && json.weather[0].id;
    state.condition = mapCondition(owmId);
    state.tempF = Math.round(json.main?.temp ?? 72);
    state.feelsLikeF = Math.round(json.main?.feels_like ?? state.tempF);
    state.description = (json.weather && json.weather[0] && json.weather[0].description) || '';
    state.humidity = json.main?.humidity ?? null;
    state.windMph = json.wind?.speed != null ? Math.round(json.wind.speed) : null;
  }

  async function _fetchForecast() {
    const url = `${_baseUrl('forecast')}?zip=${encodeURIComponent(_zip())},us&appid=${_key()}&units=imperial&cnt=40`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`forecast HTTP ${res.status}`);
    const json = await res.json();
    state.forecast = _summarizeForecast(json.list || []);
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
      // current is the critical one; forecast is best-effort
      await _fetchCurrent();
      try {
        await _fetchForecast();
      } catch (fErr) {
        console.warn('[WeatherSystem] forecast fetch failed (non-fatal):', fErr.message);
      }
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
      forecast: state.forecast.slice(),
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
    mapCondition,           // exposed for debugging
    refresh: _refresh,      // manual trigger for debugging
    get condition() { return state.condition; },
    get tempF() { return state.tempF; },
  };
})();

window.WeatherSystem = WeatherSystem;
