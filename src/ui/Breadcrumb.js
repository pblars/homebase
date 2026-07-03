// Breadcrumb.js
// -----------------------------------------------------------------------------
// A small top-left breadcrumb for detail screens: a cloud logo + "Home" (taps
// back to the Dashboard) › current screen. Sits over the sky above each screen's
// content. Rendered per screen like the NavBar.
//
// Usage:  root.insertBefore(Breadcrumb.render('Weather'), root.firstChild)
// Exposed as the global `Breadcrumb`.
// -----------------------------------------------------------------------------

const Breadcrumb = (() => {
  const CLOUD =
    '<svg viewBox="0 0 24 24" class="bc-cloud" aria-hidden="true">' +
    '<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 8.6 4.5 4.5 0 0 0 7 18z" ' +
    'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  function render(label) {
    const nav = document.createElement('nav');
    nav.className = 'breadcrumb';
    nav.setAttribute('aria-label', 'Breadcrumb');
    nav.innerHTML =
      '<button type="button" class="bc-home" data-bc-home>' +
        '<span class="bc-logo">' + CLOUD + '</span>' +
        '<span class="bc-home-label">Home</span>' +
      '</button>' +
      '<span class="bc-sep" aria-hidden="true">›</span>' +
      '<span class="bc-current" aria-current="page">' + String(label || '') + '</span>';

    nav.querySelector('[data-bc-home]').addEventListener('click', () => {
      if (typeof Router !== 'undefined') Router.show('dashboard');
    });
    return nav;
  }

  return { render };
})();

window.Breadcrumb = Breadcrumb;
