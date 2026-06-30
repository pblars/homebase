// Placeholders.js
// -----------------------------------------------------------------------------
// Minimal stand-in screens for the non-Home nav tabs (Weather, Calendar,
// Chores, Meals, Photos, Settings). Each shows its name centered over the sky
// and carries the same bottom nav bar so you can tab back to Home. These get
// replaced by real detail screens in later passes.
//
// Registers one screen per tab id with the Router on load.
// -----------------------------------------------------------------------------

const Placeholders = (() => {
  // 'chores' is intentionally absent — KidChorePanel registers the real
  // Chores screen with the Router.
  const SCREENS = [
    { id: 'weather',  label: 'Weather' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'meals',    label: 'Meals' },
    { id: 'photos',   label: 'Photos' },
    { id: 'settings', label: 'Settings' },
  ];

  function make(def) {
    let root = null;
    function build() {
      root = document.createElement('div');
      root.className = 'placeholder-screen';
      root.innerHTML =
        '<div class="ph-center">' +
          '<div class="ph-title">' + def.label + '</div>' +
          '<div class="ph-sub">Coming soon</div>' +
        '</div>';
      root.appendChild(NavBar.render(def.id));
    }
    function show() {
      if (!root) build();
      const sr = document.getElementById('screen-root');
      if (root.parentNode !== sr) sr.appendChild(root);
    }
    function hide() {
      if (root && root.parentNode) root.parentNode.removeChild(root);
    }
    return { show, hide };
  }

  SCREENS.forEach((def) => {
    if (typeof Router !== 'undefined') Router.register(def.id, make(def));
  });

  return {};
})();

window.Placeholders = Placeholders;
