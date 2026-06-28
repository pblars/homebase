// router.js — minimal screen router. Phase 1 stub (no screens yet).
// Later phases register screens and switch between them here.

const Router = (() => {
  const screens = {};
  let current = null;

  function register(name, screen) { screens[name] = screen; }

  function show(name, params) {
    if (!screens[name]) { console.warn(`[Router] unknown screen: ${name}`); return; }
    if (current && screens[current] && screens[current].hide) screens[current].hide();
    current = name;
    if (screens[name].show) screens[name].show(params);
  }

  return { register, show, get current() { return current; } };
})();

window.Router = Router;
