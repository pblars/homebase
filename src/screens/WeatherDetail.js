// WeatherDetail.js
// -----------------------------------------------------------------------------
// The Weather tab. Layout follows the reference (current summary on the left;
// hourly strip, daily forecast + stat tiles, and a precipitation-trend chart on
// the right) but keeps the app's frosted-glass-over-sky styling. Reads
// WeatherSystem and re-renders on `weatherupdate`. Registers as "weather".
// -----------------------------------------------------------------------------

const WeatherDetail = (() => {
  const CONDITION_LABEL = {
    sunny: 'Sunny', clear: 'Clear', partly_cloudy: 'Partly Cloudy', cloudy: 'Cloudy',
    rainy: 'Rain', stormy: 'Storms', snowy: 'Snow', foggy: 'Fog',
  };

  // Small inline glyphs for the stat tiles (stroke, inherit color via the tile).
  const GLYPH = {
    drop: '<svg viewBox="0 0 24 24" class="wx-glyph"><path d="M12 3.5s6 6.5 6 10.5a6 6 0 0 1-12 0c0-4 6-10.5 6-10.5z"/></svg>',
    wind: '<svg viewBox="0 0 24 24" class="wx-glyph"><path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5M3 13h15a2.5 2.5 0 1 1-2.5 2.5M3 17h9"/></svg>',
    sunrise: '<svg viewBox="0 0 24 24" class="wx-glyph"><path d="M3 18h18M12 3v5M12 8l3 3M12 8l-3 3M7 18a5 5 0 0 1 10 0"/></svg>',
    sunset: '<svg viewBox="0 0 24 24" class="wx-glyph"><path d="M3 18h18M12 11V6M12 11l3-3M12 11l-3-3M7 18a5 5 0 0 1 10 0"/></svg>',
  };

  let root = null;
  let els = {};
  let subscribed = false;

  function _location() {
    return (typeof CONFIG !== 'undefined' && CONFIG.LOCATION_LABEL) || 'Your area';
  }
  function _fmtClock(unix) {
    if (!unix) return '--';
    const d = new Date(unix * 1000);
    let h = d.getHours();
    const m = d.getMinutes();
    const ap = h < 12 ? 'AM' : 'PM';
    h = (h % 12) || 12;
    return `${h}:${String(m).padStart(2, '0')} ${ap}`;
  }

  // ---- left: current summary ------------------------------------------------

  function leftHTML(w) {
    const label = w.description || CONDITION_LABEL[w.condition] || 'Partly Cloudy';
    const hi = w.todayHigh != null ? w.todayHigh + '°' : '--';
    const lo = w.todayLow != null ? w.todayLow + '°' : '--';
    return (
      '<div class="wx-cur-icon">' + ICONS.weather(w.condition) + '</div>' +
      '<div class="wx-cur-temp">' + Math.round(w.tempF) + '<span class="wx-deg">°</span></div>' +
      '<div class="wx-cur-cond">' + label + '</div>' +
      '<div class="wx-cur-hilo"><span>High ' + hi + '</span><span class="wx-sep">/</span><span>Low ' + lo + '</span></div>' +
      '<div class="wx-cur-loc">' + _location() + '</div>' +
      '<div class="wx-cur-feels">Feels like ' + Math.round(w.feelsLikeF) + '°</div>'
    );
  }

  // ---- hourly strip ---------------------------------------------------------

  function hourlyHTML(hours) {
    if (!hours.length) return '<div class="wx-empty">Hourly forecast unavailable.</div>';
    return hours.map((h) =>
      '<div class="wx-hour">' +
        '<div class="wx-hour-lbl">' + h.label + '</div>' +
        '<div class="wx-hour-ic">' + ICONS.weather(h.condition) + '</div>' +
        '<div class="wx-hour-temp">' + h.tempF + '°</div>' +
        '<div class="wx-hour-pop">' + GLYPH.drop + '<span>' + h.precipPct + '%</span></div>' +
      '</div>').join('');
  }

  // ---- daily forecast -------------------------------------------------------

  function dailyHTML(days) {
    if (!days.length) return '<div class="wx-empty">Daily forecast unavailable.</div>';
    return days.map((d) =>
      '<div class="wx-day">' +
        '<div class="wx-day-name">' + String(d.dayName || '').toUpperCase() + '</div>' +
        '<div class="wx-day-ic">' + ICONS.weather(d.condition) + '</div>' +
        '<div class="wx-day-hi">' + (d.high != null ? d.high + '°' : '--') + '</div>' +
        '<div class="wx-day-lo">' + (d.low != null ? d.low + '°' : '--') + '</div>' +
      '</div>').join('');
  }

  // ---- stat tiles -----------------------------------------------------------

  function tile(glyph, label, value, sub) {
    return (
      '<div class="wx-tile">' +
        '<div class="wx-tile-ic">' + glyph + '</div>' +
        '<div class="wx-tile-body">' +
          '<div class="wx-tile-label">' + label + '</div>' +
          '<div class="wx-tile-value">' + value + '</div>' +
          (sub ? '<div class="wx-tile-sub">' + sub + '</div>' : '') +
        '</div>' +
      '</div>'
    );
  }
  function humidityWord(h) {
    if (h == null) return '';
    if (h < 40) return 'Dry';
    if (h <= 60) return 'Comfortable';
    return 'Humid';
  }
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

  // ---- precipitation trend --------------------------------------------------

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
      '<div class="wx-bar-col">' +
        '<div class="wx-bar-val">' + h.precipPct + '%</div>' +
        '<div class="wx-bar-track"><div class="wx-bar" style="height:' + Math.max(2, h.precipPct) + '%"></div></div>' +
        '<div class="wx-bar-lbl">' + h.label + '</div>' +
      '</div>').join('');
    return (
      '<div class="wx-chart">' + chart + '</div>' +
      '<div class="wx-trend-note">' +
        '<div class="wx-trend-note-h">Next 24 Hours</div>' +
        '<div class="wx-trend-note-b">' + summaryText(hours) + '</div>' +
      '</div>'
    );
  }

  // ---- render ---------------------------------------------------------------

  function render() {
    if (!els.left) return;
    const w = WeatherSystem.getState();
    els.left.innerHTML = leftHTML(w);
    els.hourly.innerHTML = hourlyHTML(w.hourly || []);
    els.daily.innerHTML = dailyHTML(w.forecast || []);
    els.tiles.innerHTML = tilesHTML(w);
    els.trend.innerHTML = trendHTML(w.hourly || []);
  }

  function build() {
    root = document.createElement('div');
    root.className = 'weather-screen';
    root.innerHTML =
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
      '</div>';
    root.appendChild(NavBar.render('weather'));
    root.insertBefore(Breadcrumb.render('Weather'), root.firstChild);

    els = {
      left: root.querySelector('[data-wx-left]'),
      hourly: root.querySelector('[data-wx-hourly]'),
      daily: root.querySelector('[data-wx-daily]'),
      tiles: root.querySelector('[data-wx-tiles]'),
      trend: root.querySelector('[data-wx-trend]'),
    };
  }

  function show() {
    if (!root) build();
    const sr = document.getElementById('screen-root');
    if (root.parentNode !== sr) sr.appendChild(root);
    render();
    if (!subscribed) {
      WeatherSystem.onUpdate(() => { if (root && root.isConnected) render(); });
      subscribed = true;
    }
  }

  function hide() {
    if (root && root.parentNode) root.parentNode.removeChild(root);
  }

  const api = { show, hide };
  if (typeof Router !== 'undefined') Router.register('weather', api);
  window.WeatherDetail = api;
  return api;
})();
