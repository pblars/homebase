// WeatherRadar.js
// -----------------------------------------------------------------------------
// Animated precipitation radar for the Weather screen. Draws RainViewer radar
// tiles (free, no API key) over a muted CARTO base map via Leaflet (loaded from
// CDN in index.html). Centered on home (CONFIG.LAT/LON). Classic-script global.
//
// Lifecycle (driven by WeatherDetail):
//   mount(el, {lat, lon}) - build once: map + controls, load frames, animate
//   resume()              - re-entering the tab: fix map size + resume playback
//   pause()               - leaving the tab: stop the animation timer
//
// RainViewer API: https://api.rainviewer.com/public/weather-maps.json
//   -> { host, radar:{ past:[{time,path}], nowcast:[{time,path}] } }
//   tile: {host}{path}/{size}/{z}/{x}/{y}/{color}/{smooth}_{snow}.png
// -----------------------------------------------------------------------------

const WeatherRadar = (() => {
  const RV_API = 'https://api.rainviewer.com/public/weather-maps.json';
  const COLOR = 4;                 // RainViewer color scheme (The Weather Channel)
  const SMOOTH = 1, SNOW = 1;
  const OPACITY = 0.72;
  const STEP_MS = 600;             // animation frame interval
  const REFRESH_MS = 5 * 60 * 1000; // re-fetch frames every 5 min (radar updates ~10 min)

  let map = null, els = {}, container = null;
  let host = '', frames = [], layers = [], idx = 0;
  let playTimer = null, refreshTimer = null, playing = true, visible = false;
  let center = [35.9251, -86.8689], zoom = 7, mountTries = 0, resizeObs = null;

  const ready = () => typeof L !== 'undefined' && L.map;

  function fmt(unix, forecast) {
    const d = new Date(unix * 1000);
    let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0');
    const ap = h < 12 ? 'AM' : 'PM'; h = (h % 12) || 12;
    return (forecast ? 'Forecast ' : '') + h + ':' + m + ' ' + ap;
  }

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
      '<div class="wx-radar-bar">' +
        '<button type="button" class="wx-radar-play" data-play aria-label="Play or pause radar">❚❚</button>' +
        '<input type="range" class="wx-radar-scrub" data-scrub min="0" max="0" value="0" aria-label="Radar time" />' +
        '<span class="wx-radar-time" data-time>—</span>' +
      '</div>';
    els = {
      map: el.querySelector('[data-map]'),
      play: el.querySelector('[data-play]'),
      scrub: el.querySelector('[data-scrub]'),
      time: el.querySelector('[data-time]'),
    };

    map = L.map(els.map, {
      zoomControl: false, attributionControl: true, scrollWheelZoom: false,
      fadeAnimation: false, doubleClickZoom: false,
    }).setView(center, zoom);
    L.control.zoom({ position: 'topright' }).addTo(map);
    map.attributionControl.setPrefix('');
    setBase();
    // "You are here" dot at home.
    L.circleMarker(center, { radius: 5, color: '#fff', weight: 2, fillColor: '#3a9d96', fillOpacity: 1, interactive: false }).addTo(map);

    els.play.addEventListener('click', () => setPlaying(!playing));
    els.scrub.addEventListener('input', () => { setPlaying(false); showFrame(parseInt(els.scrub.value, 10)); });

    // The card can measure 0 at the instant the tab mounts (before layout
    // settles), so Leaflet would request no tiles and stay blank. Force it to
    // re-measure once the container actually has a size — via a ResizeObserver
    // plus a couple of delayed passes as a fallback.
    const fixSize = () => { if (map) map.invalidateSize(false); };
    requestAnimationFrame(fixSize);
    setTimeout(fixSize, 150);
    setTimeout(fixSize, 500);
    if (window.ResizeObserver) {
      resizeObs = new ResizeObserver(fixSize);
      resizeObs.observe(els.map);
    }

    visible = true;
    loadFrames();
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => { if (visible) loadFrames(); }, REFRESH_MS);
  }

  function setBase() {
    const dark = document.documentElement.dataset.scene === 'dark';
    const style = dark ? 'dark_all' : 'light_all';
    L.tileLayer('https://{s}.basemaps.cartocdn.com/' + style + '/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 18,
      attribution: '&copy; OpenStreetMap, &copy; CARTO · Radar © RainViewer',
    }).addTo(map);
  }

  async function loadFrames() {
    try {
      const res = await fetch(RV_API, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      host = data.host || '';
      const past = (data.radar && data.radar.past) || [];
      const nowcast = (data.radar && data.radar.nowcast) || [];
      const combined = past.map((f) => ({ time: f.time, path: f.path, forecast: false }))
        .concat(nowcast.map((f) => ({ time: f.time, path: f.path, forecast: true })));
      if (!combined.length) throw new Error('no frames');

      // Rebuild the tile layers (one per frame, shown by toggling opacity).
      layers.forEach((l) => { if (map.hasLayer(l.layer)) map.removeLayer(l.layer); });
      layers = combined.map((f) => ({
        f,
        layer: L.tileLayer(host + f.path + '/256/{z}/{x}/{y}/' + COLOR + '/' + SMOOTH + '_' + SNOW + '.png', {
          opacity: 0, maxZoom: 18, zIndex: 5,
        }),
      }));
      layers.forEach((l) => l.layer.addTo(map));
      frames = combined;
      els.scrub.max = String(Math.max(0, frames.length - 1));
      idx = Math.max(0, past.length - 1);   // default to the most recent real ("now") frame
      showFrame(idx);
      setPlaying(playing);
    } catch (e) {
      console.warn('[WeatherRadar] frame load failed:', e.message);
      if (els.time) els.time.textContent = 'radar unavailable';
    }
  }

  function showFrame(i) {
    if (!frames.length) return;
    i = Math.max(0, Math.min(frames.length - 1, i));
    layers.forEach((l, j) => l.layer.setOpacity(j === i ? OPACITY : 0));
    idx = i;
    if (els.scrub) els.scrub.value = String(i);
    if (els.time) els.time.textContent = fmt(frames[i].time, frames[i].forecast);
  }

  function setPlaying(on) {
    playing = on;
    if (els.play) els.play.textContent = on ? '❚❚' : '►';
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
    if (on && visible && frames.length) {
      playTimer = setInterval(() => showFrame((idx + 1) % frames.length), STEP_MS);
    }
  }

  // Tab re-entered: Leaflet needs a size recompute after being re-attached.
  function resume() {
    if (!map) return;
    visible = true;
    setTimeout(() => { if (map) map.invalidateSize(); }, 60);
    setPlaying(playing);
  }
  // Tab left: stop animating (saves work while off-screen).
  function pause() {
    visible = false;
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
  }

  return { mount, resume, pause };
})();

window.WeatherRadar = WeatherRadar;
