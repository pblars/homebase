// Dashboard.js
// -----------------------------------------------------------------------------
// The Home screen — frosted-glass cards over the sky, in the "2a" layout:
//   • header: greeting + live clock (left), weather pill (right)
//   • body:   Today's Agenda | Quest hero (#quest-banner-card) | Family Glow Jars (#glowjars-card)
//   • meals strip, then the bottom nav
// Weather reads WeatherSystem; the quest banner + glow jars are rendered by the
// quest system into their slots. (Chores keep their own full-screen tab.)
// Registers with the Router as "dashboard".
// -----------------------------------------------------------------------------

const Dashboard = (() => {
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const CONDITION_LABEL = {
    sunny: 'Sunny', clear: 'Clear', partly_cloudy: 'Partly Cloudy', cloudy: 'Cloudy',
    rainy: 'Rain', stormy: 'Storms', snowy: 'Snow', foggy: 'Fog',
  };
  const FALLBACK_FORECAST = [
    { dayName: 'Wed', condition: 'sunny', high: 74 }, { dayName: 'Thu', condition: 'partly_cloudy', high: 71 },
    { dayName: 'Fri', condition: 'rainy', high: 66 }, { dayName: 'Sat', condition: 'cloudy', high: 69 },
    { dayName: 'Sun', condition: 'sunny', high: 75 },
  ];

  let root = null;
  let els = {};
  let tickHandle = null;
  let lastClock = '';
  let weatherSubscribed = false;

  function greetingText() {
    const h = new Date().getHours();
    const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const fam = (window.SETTINGS && window.SETTINGS.family_name) || '';
    return part + ', ' + (fam && fam !== 'Our Family' ? fam : 'family');
  }

  function headerHTML() {
    return (
      '<header class="dash-header">' +
        '<div class="dash-hello">' +
          '<div class="hello-greeting" data-greeting>&nbsp;</div>' +
          '<div class="hello-clock">' +
            '<span class="clk-time" data-time>--:--</span>' +
            '<span class="clk-ampm" data-ampm></span>' +
            '<span class="clk-date" data-date></span>' +
          '</div>' +
        '</div>' +
        '<div class="weather-pill glass" data-nav="weather">' +
          '<div class="wp-now">' +
            '<div class="wp-icon" data-wicon></div>' +
            '<div><div class="wp-temp" data-wtemp>--&deg;</div><div class="wp-desc" data-wcond>&nbsp;</div></div>' +
          '</div>' +
          '<div class="wp-divider"></div>' +
          '<div class="wp-forecast" data-forecast></div>' +
        '</div>' +
      '</header>'
    );
  }

  function agendaRowsHTML() {
    const events = window.EVENTS || [];
    if (!events.length) return '<div class="ag-empty">Nothing on the calendar.</div>';
    return events.map((e) =>
      '<div class="ag-row">' +
        '<span class="ag-dot ag-dot--' + e.period + '"></span>' +
        '<div class="ag-body">' +
          '<div class="ag-time">' + e.time + (e.ampm ? ' ' + e.ampm : '') + '</div>' +
          '<div class="ag-title">' + e.title + '</div>' +
          '<div class="ag-sub">' + (e.sub || '') + '</div>' +
        '</div>' +
      '</div>').join('');
  }

  function agendaHTML() {
    return (
      '<div class="ag-eyebrow" data-agenda-eyebrow>Today\'s Agenda</div>' +
      '<div class="agenda-list" data-agenda>' + agendaRowsHTML() + '</div>' +
      '<div class="ag-foot">Make today count.</div>'
    );
  }

  function renderAgenda() {
    if (els.agenda) els.agenda.innerHTML = agendaRowsHTML();
    if (els.agendaEyebrow) els.agendaEyebrow.textContent = window.AGENDA_LABEL || "Today's Agenda";
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // Meals card (lives under the agenda in the left column). Reads window.MEALS
  // (fed by MealsData ← the shared meal plan). Tapping it opens the Meals tab.
  function mealsCardHTML() {
    const m = window.MEALS || { tonight: {}, upcoming: [] };
    const tonight = (m.tonight && m.tonight.name) || '';
    const up = (m.upcoming || []).slice(0, 3).map((u) =>
      '<div class="dm-row"><span class="dm-day">' + esc(u.day) + '</span>' +
      '<span class="dm-name">' + esc(u.name) + '</span></div>').join('');
    return (
      '<div class="dm-head"><span class="ag-eyebrow">Dinner</span>' +
        '<span class="dm-fork">' + ICONS.nav.meals + '</span></div>' +
      '<div class="dm-tonight' + (tonight ? '' : ' is-empty') + '">' + (tonight ? esc(tonight) : 'Tap to plan dinner') + '</div>' +
      (up ? '<div class="dm-up">' + up + '</div>' : '')
    );
  }

  // ---- dynamic rendering ----------------------------------------------------

  function renderClock() {
    const now = new Date();
    const h = now.getHours();
    const clock = `${(h % 12) || 12}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (clock === lastClock) { els.greeting.textContent = greetingText(); return; }
    lastClock = clock;
    els.time.textContent = clock;
    els.ampm.textContent = h < 12 ? 'AM' : 'PM';
    els.date.textContent = `${WEEKDAYS[now.getDay()].slice(0, 3)}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
    els.greeting.textContent = greetingText();
  }

  function renderForecast(days) {
    const list = (days && days.length) ? days.slice(0, 5) : FALLBACK_FORECAST;
    els.forecast.innerHTML = list.map((d) =>
      '<div class="fc-col">' +
        '<div class="fc-day">' + String(d.dayName || '').toUpperCase() + '</div>' +
        '<div class="fc-ic">' + ICONS.weather(d.condition) + '</div>' +
        '<div class="fc-hi">' + (d.high != null ? d.high + '°' : '--') + '</div>' +
      '</div>').join('');
  }

  function renderWeather(snapshot) {
    const w = snapshot || WeatherSystem.getState();
    els.wicon.innerHTML = ICONS.weather(w.condition);
    els.wtemp.innerHTML = Math.round(w.tempF) + '°';
    els.wcond.textContent = w.description ? w.description : (CONDITION_LABEL[w.condition] || 'Partly Cloudy');
    renderForecast(w.forecast || []);
  }

  // ---- lifecycle ------------------------------------------------------------

  function build() {
    root = document.createElement('div');
    root.className = 'dashboard';
    root.innerHTML =
      headerHTML() +
      '<div class="dash-body">' +
        '<div class="dash-left">' +
          '<section class="dash-agenda glass">' + agendaHTML() + '</section>' +
          '<section class="dash-meals-card glass" data-nav="meals">' + mealsCardHTML() + '</section>' +
        '</div>' +
        '<div class="quest-card" id="quest-banner-card"></div>' +
        '<div class="glowjars-card glass" id="glowjars-card"></div>' +
      '</div>';
    root.appendChild(NavBar.render('dashboard'));

    els = {
      greeting: root.querySelector('[data-greeting]'),
      time: root.querySelector('[data-time]'),
      ampm: root.querySelector('[data-ampm]'),
      date: root.querySelector('[data-date]'),
      wicon: root.querySelector('[data-wicon]'),
      wtemp: root.querySelector('[data-wtemp]'),
      wcond: root.querySelector('[data-wcond]'),
      forecast: root.querySelector('[data-forecast]'),
      agenda: root.querySelector('[data-agenda]'),
      agendaEyebrow: root.querySelector('[data-agenda-eyebrow]'),
    };

    // Card / weather-pill drill-downs: any [data-nav] routes to that screen.
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-nav]');
      if (t && t.dataset.nav && typeof Router !== 'undefined') Router.show(t.dataset.nav);
    });
  }

  function show() {
    if (!root) build();
    const screenRoot = document.getElementById('screen-root');
    if (root.parentNode !== screenRoot) screenRoot.appendChild(root);

    if (typeof QuestBanner !== 'undefined') QuestBanner.mount();
    if (typeof FamilyGlowJarsCard !== 'undefined') FamilyGlowJarsCard.mount();

    renderClock();
    renderWeather();
    renderAgenda();
    // Refresh the shared meal plan each time Home is shown, so a dinner planned
    // in the Meals tab shows up on the card when you come back.
    if (window.MealsData) MealsData.load();

    if (tickHandle) clearInterval(tickHandle);
    tickHandle = setInterval(renderClock, 1000);

    if (!weatherSubscribed) {
      WeatherSystem.onUpdate((snap) => { if (root && root.isConnected) renderWeather(snap); });
      if (typeof CalendarSystem !== 'undefined') {
        CalendarSystem.onUpdate(() => { if (root && root.isConnected) renderAgenda(); });
      }
      // Meal plan (from The Family Table) landed → refresh the meals card.
      window.addEventListener('mealsupdated', () => {
        const card = root && root.querySelector('.dash-meals-card');
        if (card && root.isConnected) card.innerHTML = mealsCardHTML();
      });
      weatherSubscribed = true;
    }
  }

  function hide() {
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
    if (root && root.parentNode) root.parentNode.removeChild(root);
  }

  const api = { show, hide };
  if (typeof Router !== 'undefined') Router.register('dashboard', api);
  window.Dashboard = api;
  return api;
})();
