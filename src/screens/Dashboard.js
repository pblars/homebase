// Dashboard.js
// -----------------------------------------------------------------------------
// The home screen. Mounts into #screen-root and sits on top of the sky.
// Glanceable from across the room: a large live clock + date, current weather,
// and a 5-day forecast strip. Reads live state from TimeSystem + WeatherSystem.
//
// Lifecycle (driven by Router):
//   show()  -> build/attach DOM, render once, start the 1s clock tick,
//              subscribe to weather updates.
//   hide()  -> stop the tick and detach.
//
// Registers itself with the Router at load as "dashboard".
// -----------------------------------------------------------------------------

const Dashboard = (() => {
  // condition string -> { icon, label }. Mirrors WeatherSystem's condition set.
  const CONDITION_META = {
    sunny:         { icon: '☀️', label: 'Sunny' },
    partly_cloudy: { icon: '⛅', label: 'Partly Cloudy' },
    cloudy:        { icon: '☁️', label: 'Cloudy' },
    rainy:         { icon: '🌧️', label: 'Rain' },
    stormy:        { icon: '⛈️', label: 'Storms' },
    snowy:         { icon: '❄️', label: 'Snow' },
    foggy:         { icon: '🌫️', label: 'Fog' },
  };

  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  let root = null;        // the .dashboard element
  let els = {};           // cached child element refs
  let tickHandle = null;
  let lastClock = '';     // de-dupe textContent writes
  let weatherSubscribed = false;

  function meta(condition) {
    return CONDITION_META[condition] || CONDITION_META.cloudy;
  }

  function cap(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  // Build the screen DOM once.
  function build() {
    root = document.createElement('div');
    root.className = 'dashboard';
    root.innerHTML = `
      <div class="dash-clock-block">
        <div class="dash-time" data-time>--:--</div>
        <div class="dash-date" data-date>&nbsp;</div>
      </div>

      <div class="dash-weather" data-weather>
        <div class="dash-weather-now">
          <span class="dash-weather-icon" data-wicon>·</span>
          <span class="dash-weather-temp" data-wtemp>--°</span>
        </div>
        <div class="dash-weather-meta">
          <div class="dash-weather-desc" data-wdesc>&nbsp;</div>
          <div class="dash-weather-loc" data-wloc>&nbsp;</div>
        </div>
      </div>

      <div class="dash-forecast" data-forecast></div>
    `;

    els = {
      time: root.querySelector('[data-time]'),
      date: root.querySelector('[data-date]'),
      wicon: root.querySelector('[data-wicon]'),
      wtemp: root.querySelector('[data-wtemp]'),
      wdesc: root.querySelector('[data-wdesc]'),
      wloc: root.querySelector('[data-wloc]'),
      forecast: root.querySelector('[data-forecast]'),
    };
  }

  // Repaint the clock + date. Cheap; called every second but only writes on change.
  function renderClock() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const hh = (h % 12) || 12;
    const mm = String(m).padStart(2, '0');
    const ampm = h < 12 ? 'AM' : 'PM';
    const clock = `${hh}:${mm}`;

    if (clock !== lastClock) {
      lastClock = clock;
      els.time.innerHTML = `${clock}<span class="dash-ampm">${ampm}</span>`;
      els.date.textContent =
        `${WEEKDAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
    }
  }

  // Repaint weather from a WeatherSystem snapshot.
  function renderWeather(snapshot) {
    const w = snapshot || WeatherSystem.getState();
    const m = meta(w.condition);

    els.wicon.textContent = m.icon;
    els.wtemp.textContent = `${Math.round(w.tempF)}°`;
    els.wdesc.textContent = w.description ? cap(w.description) : m.label;

    const loc = (typeof CONFIG !== 'undefined' && CONFIG.LOCATION_LABEL) || '';
    const feels = (w.feelsLikeF != null && Math.round(w.feelsLikeF) !== Math.round(w.tempF))
      ? ` · Feels ${Math.round(w.feelsLikeF)}°` : '';
    els.wloc.textContent = `${loc}${feels}`;

    renderForecast(w.forecast || []);
  }

  function renderForecast(days) {
    if (!days.length) { els.forecast.innerHTML = ''; return; }
    // Skip "today" if it's the first bucket; show the next several days.
    els.forecast.innerHTML = days.slice(0, 5).map((d) => {
      const m = meta(d.condition);
      const high = d.high != null ? `${d.high}°` : '--';
      const low = d.low != null ? `${d.low}°` : '--';
      const precip = d.precipPct ? `<span class="fc-precip">${d.precipPct}%</span>` : '';
      return `
        <div class="fc-day">
          <div class="fc-name">${d.dayName}</div>
          <div class="fc-icon">${m.icon}</div>
          <div class="fc-temps"><span class="fc-high">${high}</span> <span class="fc-low">${low}</span></div>
          ${precip}
        </div>`;
    }).join('');
  }

  function show() {
    if (!root) build();
    const screenRoot = document.getElementById('screen-root');
    if (root.parentNode !== screenRoot) screenRoot.appendChild(root);

    renderClock();
    renderWeather();

    // Live clock — every second, but renderClock() de-dupes the actual write.
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = setInterval(renderClock, 1000);

    // Weather pushes; subscribe once.
    if (!weatherSubscribed) {
      WeatherSystem.onUpdate((snap) => { if (root && root.isConnected) renderWeather(snap); });
      weatherSubscribed = true;
    }
  }

  function hide() {
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
    if (root && root.parentNode) root.parentNode.removeChild(root);
  }

  const api = { show, hide };

  // Self-register with the Router (loaded before this script).
  if (typeof Router !== 'undefined') Router.register('dashboard', api);

  window.Dashboard = api;
  return api;
})();
