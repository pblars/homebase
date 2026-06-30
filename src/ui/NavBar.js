// NavBar.js
// -----------------------------------------------------------------------------
// The bottom navigation bar — a full-width frosted pill with 7 tabs. Shared by
// every "app" screen (Home + the placeholder tabs). Each screen renders its own
// nav with the correct active tab, so no global state is needed; clicks route
// through Router.show().
//
// Usage:  container.appendChild(NavBar.render('dashboard'))
// Exposed as the global `NavBar`.
// -----------------------------------------------------------------------------

const NavBar = (() => {
  // id = Router screen name; label/icon for display. Home maps to 'dashboard'.
  const TABS = [
    { id: 'dashboard', label: 'Home',     icon: 'home' },
    { id: 'weather',   label: 'Weather',  icon: 'weather' },
    { id: 'calendar',  label: 'Calendar', icon: 'calendar' },
    { id: 'chores',    label: 'Chores',   icon: 'chores' },
    { id: 'meals',     label: 'Meals',    icon: 'meals' },
    { id: 'photos',    label: 'Photos',   icon: 'photos' },
    { id: 'settings',  label: 'Settings', icon: 'settings' },
  ];

  function render(activeId) {
    const nav = document.createElement('nav');
    nav.className = 'navbar';

    TABS.forEach((tab) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'navtab' + (tab.id === activeId ? ' is-active' : '');
      btn.innerHTML =
        '<span class="navtab-ic">' + ICONS.nav[tab.icon] + '</span>' +
        '<span class="navtab-label">' + tab.label + '</span>';
      btn.addEventListener('click', () => {
        if (tab.id !== activeId && typeof Router !== 'undefined') Router.show(tab.id);
      });
      nav.appendChild(btn);
    });

    return nav;
  }

  return { render, get tabs() { return TABS.slice(); } };
})();

window.NavBar = NavBar;
