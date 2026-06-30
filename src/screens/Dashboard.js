// Dashboard.js
// -----------------------------------------------------------------------------
// The Home screen — an overview hub that floats frosted cards over the sky:
//   • center: live clock + date, condensed weather card, Family Adventure quest
//   • left:   Today's Agenda
//   • right:  Chores, Meal Plan
//   • bottom: 7-tab navigation bar
// Each card drills into its detail screen via the nav or a tap. Live data:
// the weather card reads WeatherSystem; everything else is placeholder data
// (EVENTS / CHORES / MEALS / QUEST) shaped to match the design.
//
// Registers itself with the Router at load as "dashboard".
// -----------------------------------------------------------------------------

const Dashboard = (() => {
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const CONDITION_LABEL = {
    sunny: 'Sunny', clear: 'Clear', partly_cloudy: 'Partly Cloudy', cloudy: 'Cloudy',
    rainy: 'Rain', stormy: 'Storms', snowy: 'Snow', foggy: 'Fog',
  };

  // Shown when WeatherSystem has no forecast yet (e.g. no API key on first load).
  const FALLBACK_FORECAST = [
    { dayName: 'Wed', condition: 'sunny',         high: 74, low: 58 },
    { dayName: 'Thu', condition: 'partly_cloudy', high: 71, low: 56 },
    { dayName: 'Fri', condition: 'rainy',         high: 66, low: 54 },
    { dayName: 'Sat', condition: 'cloudy',        high: 69, low: 55 },
    { dayName: 'Sun', condition: 'sunny',         high: 75, low: 57 },
  ];

  let root = null;
  let els = {};
  let tickHandle = null;
  let lastClock = '';
  let weatherSubscribed = false;

  // ---- section builders (return HTML strings) -------------------------------

  function clockHTML() {
    return (
      '<div class="clock-block">' +
        '<span class="bird bird--l">' + ICONS.deco.bird + '</span>' +
        '<span class="bird bird--r">' + ICONS.deco.bird + '</span>' +
        '<div class="clock-time"><span data-time>--:--</span><sup class="clock-ampm" data-ampm></sup></div>' +
        '<div class="clock-date" data-date>&nbsp;</div>' +
      '</div>'
    );
  }

  function weatherCardHTML() {
    return (
      '<div class="card weather-card" data-nav="weather">' +
        '<div class="wc-now">' +
          '<div class="wc-icon" data-wicon></div>' +
          '<div class="wc-readout">' +
            '<div class="wc-temp" data-wtemp>--&deg;</div>' +
            '<div class="wc-cond" data-wcond>&nbsp;</div>' +
          '</div>' +
        '</div>' +
        '<div class="wc-forecast" data-forecast></div>' +
      '</div>'
    );
  }

  function agendaHTML() {
    const rows = (window.EVENTS || []).map((e) =>
      '<div class="ag-row">' +
        '<span class="ag-ic ag-ic--' + e.icon + '">' + (ICONS.event[e.icon] || '') + '</span>' +
        '<div class="ag-body">' +
          '<div class="ag-time ag-time--' + e.period + '">' + e.time + (e.ampm ? ' ' + e.ampm : '') + '</div>' +
          '<div class="ag-title">' + e.title + '</div>' +
          '<div class="ag-sub">' + e.sub + '</div>' +
        '</div>' +
      '</div>').join('');
    return (
      '<div class="card agenda-card" data-nav="calendar">' +
        '<span class="deco deco--tl">' + ICONS.deco.leaf + '</span>' +
        '<div class="card-head"><span class="card-title">Today\'s Agenda</span></div>' +
        '<div class="agenda-list">' + rows + '</div>' +
        '<div class="agenda-foot"><span class="leaf-mini">' + ICONS.deco.sprig + '</span>Make today count.</div>' +
      '</div>'
    );
  }

  function mealsHTML() {
    const m = window.MEALS || { tonight: {}, upcoming: [] };
    const upcoming = (m.upcoming || []).map((u) =>
      '<div class="meal-row"><span class="meal-day">' + u.day + '</span>' +
      '<span class="meal-name">' + u.name + '</span></div>').join('');
    const thumb = m.tonight && m.tonight.photo
      ? '<div class="meal-thumb" style="background-image:url(' + m.tonight.photo + ')"></div>'
      : '<div class="meal-thumb meal-thumb--placeholder">' + ICONS.nav.meals + '</div>';
    return (
      '<div class="card meals-card" data-nav="meals">' +
        '<span class="deco deco--br">' + ICONS.deco.flower + '</span>' +
        '<div class="card-head">' +
          '<span class="card-title"><span class="leaf-mini">' + ICONS.deco.sprig + '</span>Meal Plan</span>' +
          '<button type="button" class="view-all" data-nav="meals">View All</button>' +
        '</div>' +
        '<div class="meal-tonight">' + thumb +
          '<div class="meal-tonight-body">' +
            '<div class="meal-tonight-kicker">Tonight\'s Dinner</div>' +
            '<div class="meal-tonight-name">' + ((m.tonight && m.tonight.name) || '') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="meal-upcoming">' + upcoming + '</div>' +
      '</div>'
    );
  }

  // ---- dynamic rendering ----------------------------------------------------

  function renderClock() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const hh = (h % 12) || 12;
    const mm = String(m).padStart(2, '0');
    const clock = `${hh}:${mm}`;
    if (clock === lastClock) return;
    lastClock = clock;
    els.time.textContent = clock;
    els.ampm.textContent = h < 12 ? 'AM' : 'PM';
    els.date.textContent = `${WEEKDAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
  }

  function renderForecast(days) {
    const list = (days && days.length) ? days.slice(0, 5) : FALLBACK_FORECAST;
    els.forecast.innerHTML = list.map((d) =>
      '<div class="fc-col">' +
        '<div class="fc-day">' + String(d.dayName || '').toUpperCase() + '</div>' +
        '<div class="fc-ic">' + ICONS.weather(d.condition) + '</div>' +
        '<div class="fc-hi">' + (d.high != null ? d.high + '°' : '--') + '</div>' +
        '<div class="fc-lo">' + (d.low != null ? d.low + '°' : '--') + '</div>' +
      '</div>').join('');
  }

  function renderWeather(snapshot) {
    const w = snapshot || WeatherSystem.getState();
    els.wicon.innerHTML = ICONS.weather(w.condition);
    els.wtemp.innerHTML = Math.round(w.tempF) + '°';
    els.wcond.textContent = CONDITION_LABEL[w.condition] || 'Partly Cloudy';
    renderForecast(w.forecast || []);
  }

  // ---- lifecycle ------------------------------------------------------------

  function build() {
    root = document.createElement('div');
    root.className = 'dashboard';
    // The Chores card and quest banner are rendered by the quest system into
    // these mount-point slots (KidChorePanel -> #chores-card, QuestBanner ->
    // #quest-banner-card). The layout/positions stay identical.
    root.innerHTML =
      '<section class="dash-left">' + agendaHTML() + '</section>' +
      '<section class="dash-center">' + clockHTML() + weatherCardHTML() +
        '<div class="card quest-card" id="quest-banner-card"></div></section>' +
      '<section class="dash-right">' +
        '<div class="card chores-card" id="chores-card"></div>' + mealsHTML() + '</section>';

    root.appendChild(NavBar.render('dashboard'));

    els = {
      time: root.querySelector('[data-time]'),
      ampm: root.querySelector('[data-ampm]'),
      date: root.querySelector('[data-date]'),
      wicon: root.querySelector('[data-wicon]'),
      wtemp: root.querySelector('[data-wtemp]'),
      wcond: root.querySelector('[data-wcond]'),
      forecast: root.querySelector('[data-forecast]'),
    };

    // Card / "View All" drill-downs: any [data-nav] routes to that screen.
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-nav]');
      if (t && t.dataset.nav && typeof Router !== 'undefined') Router.show(t.dataset.nav);
    });
  }

  function show() {
    if (!root) build();
    const screenRoot = document.getElementById('screen-root');
    if (root.parentNode !== screenRoot) screenRoot.appendChild(root);

    // Render the quest-system-owned slots now that their containers exist.
    if (typeof QuestBanner !== 'undefined') QuestBanner.mount();
    if (typeof KidChorePanel !== 'undefined') KidChorePanel.mountSummary();

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
  if (typeof Router !== 'undefined') Router.register('dashboard', api);
  window.Dashboard = api;
  return api;
})();
