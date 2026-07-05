// WeatherRadar.js
// -----------------------------------------------------------------------------
// Precipitation radar for the Weather screen. Draws OpenWeatherMap's
// `precipitation_new` tile layer (uses the existing CONFIG.OPENWEATHERMAP_API_KEY)
// over a muted CARTO base map via Leaflet (loaded from CDN in index.html),
// centered on home (CONFIG.LAT/LON). Classic-script global.
//
// NOTE: OWM's free tile layer is a CURRENT snapshot (no time frames), so this is
// a live overlay — there's no animation timeline. It refreshes every 10 minutes.
//
// Lifecycle (driven by WeatherDetail):
//   mount(el, {lat, lon}) - build once: map + base + radar overlay + home dot
//   resume()              - re-entering the tab: fix map size + refresh overlay
//   pause()               - leaving the tab: stop the refresh timer
//
// OWM tile: https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=KEY
// -----------------------------------------------------------------------------

const WeatherRadar = (() => {
  const OWM_LAYER = 'precipitation_new';
  const OPACITY = 0.8;
  const REFRESH_MS = 10 * 60 * 1000;  // OWM precipitation updates ~every 10 min

  let map = null, els = {}, container = null;
  let owmLayer = null, resizeObs = null, refreshTimer = null, visible = false;
  let center = [35.9251, -86.8689], zoom = 8, mountTries = 0;

  const ready = () => typeof L !== 'undefined' && L.map;
  const apiKey = () => (window.CONFIG && CONFIG.OPENWEATHERMAP_API_KEY) || '';

  function mount(el, opts) {
    container = el;
    if (opts && opts.lat != null && opts.lon != null) center = [Number(opts.lat), Number(opts.lon)];
    // Leaflet loads async from the CDN; if it isn't ready yet, retry briefly.
    if (!ready()) {
      if (mountTries++ < 15) { setTimeout(() => mount(el, opts), 350); return; }
      el.innerHTML = '<div class="wx-radar-fallback">Radar map couldn’t load. Check the connection.</div>';
      return;
    }

    el.innerHTML =
      '<div class="wx-radar-map" data-map></div>' +
      '<div class="wx-radar-legend"><span class="wx-radar-dot"></span><span data-legend>Live precipitation · OpenWeather</span></div>';
    els = { map: el.querySelector('[data-map]'), legend: el.querySelector('[data-legend]') };

    map = L.map(els.map, {
      zoomControl: false, attributionControl: true, scrollWheelZoom: false,
      fadeAnimation: false, doubleClickZoom: false,
    }).setView(center, zoom);
    L.control.zoom({ position: 'topright' }).addTo(map);
    map.attributionControl.setPrefix('');
    setBase();
    L.circleMarker(center, { radius: 5, color: '#fff', weight: 2, fillColor: '#3a9d96', fillOpacity: 1, interactive: false }).addTo(map);
    addRadar();

    // The card can measure 0 the instant the tab mounts (before layout settles),
    // so force Leaflet to re-measure once it actually has a size.
    const fixSize = () => { if (map) map.invalidateSize(false); };
    requestAnimationFrame(fixSize);
    setTimeout(fixSize, 150);
    setTimeout(fixSize, 500);
    if (window.ResizeObserver) { resizeObs = new ResizeObserver(fixSize); resizeObs.observe(els.map); }

    visible = true;
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => { if (visible) addRadar(); }, REFRESH_MS);
  }

  function setBase() {
    const dark = document.documentElement.dataset.scene === 'dark';
    const style = dark ? 'dark_all' : 'light_all';
    L.tileLayer('https://{s}.basemaps.cartocdn.com/' + style + '/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 18,
      attribution: '&copy; OpenStreetMap, &copy; CARTO · Radar &copy; OpenWeather',
    }).addTo(map);
  }

  // (Re)add the OWM precipitation overlay. New layer is added first, then the
  // previous one removed on load, to avoid a flash of empty map on refresh.
  function addRadar() {
    const k = apiKey();
    if (!k) {
      if (els.legend) els.legend.textContent = 'Set OPENWEATHERMAP_API_KEY to enable radar';
      return;
    }
    const url = 'https://tile.openweathermap.org/map/' + OWM_LAYER + '/{z}/{x}/{y}.png?appid=' + k;
    const next = L.tileLayer(url, { opacity: OPACITY, maxZoom: 18, zIndex: 5, updateWhenIdle: true });
    const swap = () => { if (owmLayer && owmLayer !== next && map.hasLayer(owmLayer)) map.removeLayer(owmLayer); owmLayer = next; };
    next.once('load', swap);
    setTimeout(swap, 4000);   // fallback if 'load' doesn't fire (all tiles cached/empty)
    next.addTo(map);
  }

  // Tab re-entered: Leaflet needs a size recompute after being re-attached, and
  // a fresh overlay in case the precipitation moved while we were away.
  function resume() {
    if (!map) return;
    visible = true;
    setTimeout(() => { if (map) map.invalidateSize(); }, 60);
    addRadar();
    if (!refreshTimer) refreshTimer = setInterval(() => { if (visible) addRadar(); }, REFRESH_MS);
  }
  // Tab left: stop refreshing while off-screen.
  function pause() {
    visible = false;
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  }

  return { mount, resume, pause };
})();

window.WeatherRadar = WeatherRadar;
