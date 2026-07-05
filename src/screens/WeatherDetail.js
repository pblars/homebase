// WeatherDetail.js
// -----------------------------------------------------------------------------
// The Weather tab. A location switcher (temp cards) sits under the breadcrumb:
// the PRIMARY (home) location plus up to 3 saved locations. The selected card's
// location is shown in full below (current summary + hourly + daily + tiles +
// precip trend); the others show just a compact temp card. Tap a card to switch,
// "+ Add" to add (city or ZIP), "×" to remove. Home always drives the sky, so
// switching here never changes the background.
//
// Reads WeatherSystem (per-location snapshots) + WeatherLocations. Registers as
// "weather".
// -----------------------------------------------------------------------------

const WeatherDetail = (() => {
  const CONDITION_LABEL = {
    sunny: 'Sunny', clear: 'Clear', partly_cloudy: 'Partly Cloudy', cloudy: 'Cloudy',
    rainy: 'Rain', stormy: 'Storms', snowy: 'Snow', foggy: 'Fog',
  };
  const GLYPH = {
    drop: '<svg viewBox="0 0 24 24" class="wx-glyph"><path d="M12 3.5s6 6.5 6 10.5a6 6 0 0 1-12 0c0-4 6-10.5 6-10.5z"/></svg>',
    wind: '<svg viewBox="0 0 24 24" class="wx-glyph"><path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5M3 13h15a2.5 2.5 0 1 1-2.5 2.5M3 17h9"/></svg>',
    sunrise: '<svg viewBox="0 0 24 24" class="wx-glyph"><path d="M3 18h18M12 3v5M12 8l3 3M12 8l-3 3M7 18a5 5 0 0 1 10 0"/></svg>',
    sunset: '<svg viewBox="0 0 24 24" class="wx-glyph"><path d="M3 18h18M12 11V6M12 11l3-3M12 11l-3-3M7 18a5 5 0 0 1 10 0"/></svg>',
  };

  let root = null;
  let els = {};
  let subscribed = false;
  let radarMounted = false;

  let selectedId = 'home';
  const snaps = {};        // id -> weather snapshot (partial=current-only or full)
  let adding = false;
  let addBusy = false;
  let addError = '';

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function _isFull(snap) { return !!(snap && snap.hourly && snap.hourly.length); }
  function _fmtClock(unix) {
    if (!unix) return '--';
    const d = new Date(unix * 1000);
    let h = d.getHours();
    const m = d.getMinutes();
    const ap = h < 12 ? 'AM' : 'PM';
    h = (h % 12) || 12;
    return `${h}:${String(m).padStart(2, '0')} ${ap}`;
  }

  // ---- location switcher ----------------------------------------------------

  function locCardHTML(loc) {
    const snap = snaps[loc.id];
    const temp = snap ? Math.round(snap.tempF) + '°' : '—';
    const icon = snap ? ICONS.weather(snap.condition) : '';
    const cond = snap ? (CONDITION_LABEL[snap.condition] || '') : 'Loading…';
    const remove = loc.primary ? '' :
      '<span class="wx-loc-remove" data-remove="' + loc.id + '" title="Remove" aria-label="Remove location">&times;</span>';
    const star = loc.primary ? '<span class="wx-loc-star" title="Home">★</span>' : '';
    return (
      '<button type="button" class="wx-loc' + (loc.id === selectedId ? ' is-active' : '') + '" data-loc="' + loc.id + '">' +
        '<span class="wx-loc-ic">' + icon + '</span>' +
        '<span class="wx-loc-info">' +
          '<span class="wx-loc-name">' + star + _esc(loc.name) + '</span>' +
          '<span class="wx-loc-cond">' + _esc(cond) + '</span>' +
        '</span>' +
        '<span class="wx-loc-temp">' + temp + '</span>' +
        remove +
      '</button>'
    );
  }

  function addControlHTML() {
    if (!WeatherLocations.canAdd() && !adding) return '';
    if (!adding) {
      return '<button type="button" class="wx-loc-add" data-add>' +
        '<span class="wx-loc-add-plus">+</span><span>Add location</span></button>';
    }
    const err = addError ? '<div class="wx-loc-err">' + _esc(addError) + '</div>' : '';
    return (
      '<form class="wx-loc-addform" data-addform>' +
        '<input class="wx-loc-input" data-addinput type="text" placeholder="City or ZIP" ' +
          'maxlength="60" autocomplete="off"' + (addBusy ? ' disabled' : '') + ' />' +
        '<button type="submit" class="wx-loc-addbtn" data-addsubmit' + (addBusy ? ' disabled' : '') + '>' +
          (addBusy ? '…' : 'Add') + '</button>' +
        '<button type="button" class="wx-loc-addcancel" data-addcancel aria-label="Cancel">&times;</button>' +
        err +
      '</form>'
    );
  }

  function renderSwitch() {
    if (!els.switch) return;
    els.switch.innerHTML = WeatherLocations.list().map(locCardHTML).join('') + addControlHTML();
    const input = els.switch.querySelector('[data-addinput]');
    if (input && !addBusy) input.focus();
  }

  // ---- full view (selected location) ----------------------------------------

  function leftHTML(w) {
    const label = w.description || CONDITION_LABEL[w.condition] || 'Partly Cloudy';
    const hi = w.todayHigh != null ? w.todayHigh + '°' : '--';
    const lo = w.todayLow != null ? w.todayLow + '°' : '--';
    const loc = WeatherLocations.get(selectedId);
    return (
      '<div class="wx-cur-icon">' + ICONS.weather(w.condition) + '</div>' +
      '<div class="wx-cur-temp">' + Math.round(w.tempF) + '<span class="wx-deg">°</span></div>' +
      '<div class="wx-cur-cond">' + _esc(label) + '</div>' +
      '<div class="wx-cur-hilo"><span>High ' + hi + '</span><span class="wx-sep">/</span><span>Low ' + lo + '</span></div>' +
      '<div class="wx-cur-loc">' + _esc((loc && loc.name) || '') + '</div>' +
      '<div class="wx-cur-feels">Feels like ' + Math.round(w.feelsLikeF) + '°</div>'
    );
  }
  function hourlyHTML(hours) {
    if (!hours.length) return '<div class="wx-empty">Hourly forecast unavailable.</div>';
    return hours.map((h) =>
      '<div class="wx-hour">' +
        '<div class="wx-hour-lbl">' + _esc(h.label) + '</div>' +
        '<div class="wx-hour-ic">' + ICONS.weather(h.condition) + '</div>' +
        '<div class="wx-hour-temp">' + h.tempF + '°</div>' +
        '<div class="wx-hour-pop">' + GLYPH.drop + '<span>' + h.precipPct + '%</span></div>' +
      '</div>').join('');
  }
  function dailyHTML(days) {
    if (!days.length) return '<div class="wx-empty">Daily forecast unavailable.</div>';
    return days.map((d) =>
      '<div class="wx-day">' +
        '<div class="wx-day-name">' + _esc(String(d.dayName || '').toUpperCase()) + '</div>' +
        '<div class="wx-day-ic">' + ICONS.weather(d.condition) + '</div>' +
        '<div class="wx-day-hi">' + (d.high != null ? d.high + '°' : '--') + '</div>' +
        '<div class="wx-day-lo">' + (d.low != null ? d.low + '°' : '--') + '</div>' +
      '</div>').join('');
  }
  function tile(glyph, label, value, sub) {
    return (
      '<div class="wx-tile"><div class="wx-tile-ic">' + glyph + '</div>' +
        '<div class="wx-tile-body"><div class="wx-tile-label">' + label + '</div>' +
          '<div class="wx-tile-value">' + value + '</div>' +
          (sub ? '<div class="wx-tile-sub">' + sub + '</div>' : '') + '</div></div>'
    );
  }
  function humidityWord(h) { return h == null ? '' : h < 40 ? 'Dry' : h <= 60 ? 'Comfortable' : 'Humid'; }
  function tilesHTML(w) {
    const precip = w.hourly && w.hourly.length ? Math.max.apply(null, w.hourly.map((h) => h.precipPct)) : 0;
    return (
      tile(GLYPH.drop, 'Precipitation', precip + '%', 'Chance of rain') +
      tile(GLYPH.drop, 'Humidity', (w.humidity != null ? w.humidity + '%' : '--'), humidityWord(w.humidity)) +
      tile(GLYPH.wind, 'Wind', (w.windMph != null ? w.windMph + ' <span class="wx-unit">mph</span>' : '--'), w.windDir || '') +
      tile(GLYPH.sunrise, 'Sunrise', _fmtClock(w.sunrise), '') +
      tile(GLYPH.sunset, 'Sunset', _fmtClock(w.sunset), '')
    );
  }
  function summaryText(hours) {
    const steps = hours.slice(0, 9);
    const maxPop = steps.length ? Math.max.apply(null, steps.map((h) => h.precipPct)) : 0;
    if (maxPop >= 60) return 'Rain likely — keep an umbrella handy.';
    if (maxPop >= 30) return 'Showers possible later today. Grab a jacket.';
    if (maxPop >= 10) return 'Mostly dry, with a slight chance of a passing shower.';
    return 'Dry and settled for the next day.';
  }
  function trendHTML(hours) {
    const bars = hours.slice(0, 8);
    if (!bars.length) return '<div class="wx-empty">No precipitation data.</div>';
    const chart = bars.map((h) =>
      '<div class="wx-bar-col"><div class="wx-bar-val">' + h.precipPct + '%</div>' +
        '<div class="wx-bar-track"><div class="wx-bar" style="height:' + Math.max(2, h.precipPct) + '%"></div></div>' +
        '<div class="wx-bar-lbl">' + _esc(h.label) + '</div></div>').join('');
    return (
      '<div class="wx-chart">' + chart + '</div>' +
      '<div class="wx-trend-note"><div class="wx-trend-note-h">Next 24 Hours</div>' +
        '<div class="wx-trend-note-b">' + summaryText(hours) + '</div></div>'
    );
  }

  function renderFull() {
    if (!els.left) return;
    const w = snaps[selectedId] || { tempF: 72, feelsLikeF: 72, condition: 'cloudy', forecast: [], hourly: [] };
    els.left.innerHTML = leftHTML(w);
    els.hourly.innerHTML = hourlyHTML(w.hourly || []);
    els.daily.innerHTML = dailyHTML(w.forecast || []);
    els.tiles.innerHTML = tilesHTML(w);
    els.trend.innerHTML = trendHTML(w.hourly || []);
  }

  function render() { renderSwitch(); renderFull(); }

  // ---- data loading ---------------------------------------------------------

  function _params(loc) { return { lat: loc.lat, lon: loc.lon, zip: loc.zip }; }

  // Home reuses the live singleton state; others fetch.
  async function ensureCard(loc) {
    if (loc.id === 'home') { snaps.home = WeatherSystem.getState(); return; }
    if (snaps[loc.id]) return;
    try { snaps[loc.id] = await WeatherSystem.fetchCurrent(_params(loc)); }
    catch (err) { console.warn('[WeatherDetail] card fetch failed:', err.message); }
  }
  async function ensureFull(loc) {
    if (loc.id === 'home') { snaps.home = WeatherSystem.getState(); return; }
    if (_isFull(snaps[loc.id])) return;
    try { snaps[loc.id] = await WeatherSystem.fetchSnapshot(_params(loc)); }
    catch (err) { console.warn('[WeatherDetail] snapshot fetch failed:', err.message); }
  }

  async function loadAll() {
    const locs = WeatherLocations.list();
    await ensureFull(WeatherLocations.get(selectedId) || locs[0]);
    render();
    // fill the remaining temp cards in the background
    await Promise.all(locs.filter((l) => l.id !== selectedId).map((l) =>
      ensureCard(l).then(() => renderSwitch())));
  }

  // ---- interactions ---------------------------------------------------------

  async function selectLoc(id) {
    if (id === selectedId) return;
    selectedId = id;
    adding = false; addError = '';
    render(); // paint whatever we have (temp already known → big view shows it)
    await ensureFull(WeatherLocations.get(id));
    if (selectedId === id) render();
  }

  function removeLoc(id) {
    WeatherLocations.remove(id);
    delete snaps[id];
    if (selectedId === id) { selectedId = 'home'; }
    render();
  }

  async function submitAdd() {
    const input = els.switch.querySelector('[data-addinput]');
    const query = input ? input.value : '';
    if (!query.trim()) { addError = 'Enter a city or ZIP code.'; renderSwitch(); return; }
    addBusy = true; addError = ''; renderSwitch();
    try {
      const found = await WeatherLocations.geocode(query);
      const entry = WeatherLocations.add(found);
      adding = false; addBusy = false;
      snaps[entry.id] = await WeatherSystem.fetchSnapshot(_params(entry));
      selectedId = entry.id;
      render();
    } catch (err) {
      addBusy = false;
      addError = err.message || "Couldn't add that location.";
      renderSwitch();
    }
  }

  // ---- build / lifecycle ----------------------------------------------------

  function build() {
    root = document.createElement('div');
    root.className = 'weather-screen';
    root.innerHTML =
      '<div class="wx-switch" data-switch></div>' +
      '<div class="wx-main">' +
        '<aside class="wx-left" data-wx-left></aside>' +
        '<div class="wx-right">' +
          '<section class="wx-card glass wx-hourly">' +
            '<div class="wx-card-head"><span class="wx-card-title">Hourly Forecast</span></div>' +
            '<div class="wx-hourly-strip" data-wx-hourly></div>' +
          '</section>' +
          '<div class="wx-mid">' +
            '<section class="wx-card glass wx-daily">' +
              '<div class="wx-card-head"><span class="wx-card-title">Daily Forecast</span></div>' +
              '<div class="wx-daily-row" data-wx-daily></div>' +
            '</section>' +
            '<div class="wx-tiles" data-wx-tiles></div>' +
          '</div>' +
          '<section class="wx-card glass wx-precip">' +
            '<div class="wx-card-head"><span class="wx-card-title">Precipitation Trend</span></div>' +
            '<div class="wx-precip-body" data-wx-trend></div>' +
          '</section>' +
        '</div>' +
        '<section class="wx-card glass wx-radar-card">' +
          '<div class="wx-card-head"><span class="wx-card-title">Radar</span></div>' +
          '<div class="wx-radar" data-wx-radar></div>' +
        '</section>' +
      '</div>';
    root.appendChild(NavBar.render('weather'));
    root.insertBefore(Breadcrumb.render('Weather'), root.firstChild);

    els = {
      switch: root.querySelector('[data-switch]'),
      left: root.querySelector('[data-wx-left]'),
      hourly: root.querySelector('[data-wx-hourly]'),
      daily: root.querySelector('[data-wx-daily]'),
      tiles: root.querySelector('[data-wx-tiles]'),
      trend: root.querySelector('[data-wx-trend]'),
      radar: root.querySelector('[data-wx-radar]'),
    };

    // Switcher interactions (event delegation).
    els.switch.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-remove]');
      if (rm) { e.preventDefault(); e.stopPropagation(); removeLoc(rm.getAttribute('data-remove')); return; }
      if (e.target.closest('[data-add]')) { adding = true; addError = ''; renderSwitch(); return; }
      if (e.target.closest('[data-addcancel]')) { adding = false; addError = ''; renderSwitch(); return; }
      const card = e.target.closest('[data-loc]');
      if (card) selectLoc(card.getAttribute('data-loc'));
    });
    els.switch.addEventListener('submit', (e) => {
      if (e.target.closest('[data-addform]')) { e.preventDefault(); submitAdd(); }
    });
  }

  function show() {
    if (!root) build();
    const sr = document.getElementById('screen-root');
    if (root.parentNode !== sr) sr.appendChild(root);
    render();
    loadAll();
    // Radar: mount once (centered on home), then just resume on later visits so
    // Leaflet re-measures its container after being re-attached to the DOM.
    if (window.WeatherRadar) {
      if (!radarMounted) {
        const home = (window.WeatherLocations && WeatherLocations.get('home')) || {};
        const cfg = window.CONFIG || {};
        WeatherRadar.mount(els.radar, {
          lat: home.lat != null ? home.lat : cfg.LAT,
          lon: home.lon != null ? home.lon : cfg.LON,
        });
        radarMounted = true;
      } else {
        WeatherRadar.resume();
      }
    }
    if (!subscribed) {
      WeatherSystem.onUpdate(() => {
        if (!root || !root.isConnected) return;
        snaps.home = WeatherSystem.getState();
        if (selectedId === 'home') renderFull();
        renderSwitch();
      });
      subscribed = true;
    }
  }

  function hide() {
    if (window.WeatherRadar) WeatherRadar.pause();
    if (root && root.parentNode) root.parentNode.removeChild(root);
  }

  const api = { show, hide };
  if (typeof Router !== 'undefined') Router.register('weather', api);
  window.WeatherDetail = api;
  return api;
})();
