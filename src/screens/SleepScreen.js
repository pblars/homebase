// SleepScreen.js
// -----------------------------------------------------------------------------
// The ambient "resting" screen — what the wall tablet shows by default. A large
// soft clock + date + current temperature over the sky, intentionally sparse.
// Tapping ANYWHERE wakes the tablet to the full Dashboard.
//
// Lifecycle (driven by Router):
//   show()  -> build/attach DOM, render, start 1s clock tick, subscribe to
//              weather, arm the tap-to-wake handler.
//   hide()  -> stop the tick, remove the handler, detach.
//
// Registers itself with the Router at load as "sleep".
// -----------------------------------------------------------------------------

const SleepScreen = (() => {
  // condition string -> icon. Mirrors WeatherSystem's condition set.
  const CONDITION_ICON = {
    sunny: '☀️', partly_cloudy: '⛅', cloudy: '☁️', rainy: '🌧️',
    stormy: '⛈️', snowy: '❄️', foggy: '🌫️',
  };

  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  let root = null;
  let els = {};
  let tickHandle = null;
  let lastClock = '';
  let weatherSubscribed = false;

  function wake() {
    if (typeof Router !== 'undefined') Router.show('dashboard');
  }

  function build() {
    root = document.createElement('div');
    root.className = 'sleep';
    root.setAttribute('role', 'button');
    root.setAttribute('aria-label', 'Tap to open dashboard');
    root.innerHTML = `
      <div class="sleep-time" data-time>--:--</div>
      <div class="sleep-date" data-date>&nbsp;</div>
      <div class="sleep-temp" data-temp>
        <span class="sleep-temp-icon" data-ticon>·</span>
        <span class="sleep-temp-val" data-tval>--°</span>
      </div>
      <div class="sleep-hint">tap to open</div>
    `;
    els = {
      time: root.querySelector('[data-time]'),
      date: root.querySelector('[data-date]'),
      ticon: root.querySelector('[data-ticon]'),
      tval: root.querySelector('[data-tval]'),
    };
    // Any tap/click anywhere on the screen wakes to the dashboard.
    root.addEventListener('click', wake);
  }

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
      els.time.innerHTML = `${clock}<span class="sleep-ampm">${ampm}</span>`;
      els.date.textContent =
        `${WEEKDAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
    }
  }

  function renderWeather(snapshot) {
    const w = snapshot || WeatherSystem.getState();
    els.ticon.textContent = CONDITION_ICON[w.condition] || CONDITION_ICON.cloudy;
    els.tval.textContent = `${Math.round(w.tempF)}°`;
  }

  function show() {
    if (!root) build();
    const screenRoot = document.getElementById('screen-root');
    if (root.parentNode !== screenRoot) screenRoot.appendChild(root);

    renderClock();
    renderWeather();

    if (tickHandle) clearInterval(tickHandle);
    tickHandle = setInterval(renderClock, 1000);

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

  if (typeof Router !== 'undefined') Router.register('sleep', api);

  window.SleepScreen = api;
  return api;
})();
