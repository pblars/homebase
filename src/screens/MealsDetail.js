// MealsDetail.js
// -----------------------------------------------------------------------------
// The Meals tab. Embeds The Family Table meal-planning app (familytable.pages.dev)
// in an iframe so the family can plan meals right from Home Base. The iframe uses
// its own origin's data (localStorage), so it shows/saves the real plan. Loads
// lazily (only when the tab is first opened). Registers as "meals".
// -----------------------------------------------------------------------------

const MealsDetail = (() => {
  const FT_URL = 'https://familytable.pages.dev/';
  let root = null;

  function build() {
    root = document.createElement('div');
    root.className = 'meals-screen';
    root.innerHTML =
      '<div class="ml-frame-wrap">' +
        '<iframe class="ml-frame" src="' + FT_URL + '" title="The Family Table meal planner" ' +
          'loading="lazy" allow="clipboard-write" referrerpolicy="no-referrer"></iframe>' +
      '</div>';
    root.appendChild(NavBar.render('meals'));
    root.insertBefore(Breadcrumb.render('Meals'), root.firstChild);
  }

  const api = {
    show() {
      if (!root) build();
      const sr = document.getElementById('screen-root');
      if (root.parentNode !== sr) sr.appendChild(root);
    },
    hide() { if (root && root.parentNode) root.parentNode.removeChild(root); },
  };

  if (typeof Router !== 'undefined') Router.register('meals', api);
  window.MealsDetail = api;
  return api;
})();
