// diag.js
// -----------------------------------------------------------------------------
// On-device diagnostics. Visit  <site>/?diag  to render a full-screen readout of
// what THIS browser actually is and supports, then photograph it.
//
// The wall iPad runs an old iOS with no console (Safari there cannot be
// inspected without a tethered Mac), so layout bugs had to be guessed at from
// photographs. This replaces the guessing: it reports the real viewport, which
// layout breakpoints are matching, which CSS/JS features are present, and
// whether the latest stylesheet actually reached the device.
//
// ES5 only, and deliberately dependency-free — it has to run on the oldest
// browser we support, including when the rest of the app cannot.
// -----------------------------------------------------------------------------

(function () {
  if (window.location.search.indexOf('diag') === -1) return;

  function yes(v) { return v ? 'YES' : 'no'; }

  function cssOK(prop, val) {
    try { return !!(window.CSS && CSS.supports && CSS.supports(prop, val)); }
    catch (e) { return false; }
  }

  // Does a rule from the newest deploy actually exist in the loaded CSS? Answers
  // "did my change reach the tablet, or is this a stale cache?"
  function cssBuildCheck() {
    var found = { grid700: false, jarHeight: false, dashNarrow: false };
    var sheets = document.styleSheets;
    for (var i = 0; i < sheets.length; i++) {
      var rules;
      try { rules = sheets[i].cssRules; } catch (e) { continue; }
      if (!rules) continue;
      for (var j = 0; j < rules.length; j++) {
        var t = rules[j].cssText || '';
        if (t.indexOf('max-width: 700px') !== -1) found.grid700 = true;
        if (t.indexOf('131.93px') !== -1) found.jarHeight = true;
        if (t.indexOf('max-width: 900px') !== -1 && t.indexOf('190px') !== -1) found.dashNarrow = true;
      }
    }
    return found;
  }

  function build() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var b = cssBuildCheck();
    var rows = [
      ['iOS / browser', navigator.userAgent],
      ['--- LAYOUT ---', ''],
      ['viewport (CSS px)', vw + ' x ' + vh],
      ['orientation', vw > vh ? 'LANDSCAPE' : 'PORTRAIT'],
      ['screen', screen.width + ' x ' + screen.height],
      ['devicePixelRatio', String(window.devicePixelRatio || 1)],
      ['visualViewport', window.visualViewport
        ? Math.round(window.visualViewport.width) + ' x ' + Math.round(window.visualViewport.height)
        : 'unsupported'],
      ['--- BREAKPOINTS (these drive the layout) ---', ''],
      ['matches max-width:700px', yes(matchMedia('(max-width: 700px)').matches) + '  (chores -> 1 column)'],
      ['matches max-width:760px', yes(matchMedia('(max-width: 760px)').matches) + '  (glow jars -> 1 column)'],
      ['matches max-width:900px', yes(matchMedia('(max-width: 900px)').matches) + '  (dashboard sides -> 190px)'],
      ['--- CSS SUPPORT ---', ''],
      ['clamp()', yes(cssOK('width', 'clamp(1px, 2vw, 3px)'))],
      ['aspect-ratio', yes(cssOK('aspect-ratio', '1 / 1'))],
      ['gap', yes(cssOK('gap', '1px'))],
      ['display:grid', yes(cssOK('display', 'grid'))],
      ['env() safe-area', yes(cssOK('padding-top', 'env(safe-area-inset-top)'))],
      ['inset shorthand', yes(cssOK('inset', '0'))],
      ['position:sticky', yes(cssOK('position', 'sticky'))],
      ['--- JS SUPPORT ---', ''],
      ['Promise.finally', yes(typeof Promise === 'function' && !!Promise.prototype['finally'])],
      ['fetch', yes(typeof fetch === 'function')],
      ['wakeLock', yes('wakeLock' in navigator)],
      ['ResizeObserver', yes(typeof ResizeObserver !== 'undefined')],
      ['--- DID THE LATEST CSS ARRIVE? ---', ''],
      ['chores 700px rule', yes(b.grid700)],
      ['jar height fallback', yes(b.jarHeight)],
      ['dashboard 190px rule', yes(b.dashNarrow)],
      ['stylesheets loaded', String(document.styleSheets.length)]
    ];

    var html = '<div style="font:13px/1.5 ui-monospace,Menlo,Consolas,monospace;padding:14px;">'
             + '<div style="font-size:17px;font-weight:700;margin-bottom:10px;">Home Base — device diagnostics</div>';
    for (var i = 0; i < rows.length; i++) {
      var k = rows[i][0], v = rows[i][1];
      if (k.indexOf('---') === 0) {
        html += '<div style="margin:12px 0 4px;font-weight:700;color:#9fe0c0;">' + k + '</div>';
      } else {
        html += '<div style="display:flex;gap:8px;border-bottom:1px solid rgba(255,255,255,.12);padding:3px 0;">'
              + '<span style="flex:0 0 46%;color:#bbb;word-break:break-word;">' + k + '</span>'
              + '<span style="flex:1;font-weight:700;word-break:break-all;">' + v + '</span></div>';
      }
    }
    html += '</div>';

    var el = document.createElement('div');
    el.id = 'diag-panel';
    el.style.cssText = 'position:fixed;z-index:100000;top:0;left:0;right:0;bottom:0;'
                     + 'overflow:auto;-webkit-overflow-scrolling:touch;'
                     + 'background:#10161b;color:#fff;';
    el.innerHTML = html;
    (document.body || document.documentElement).appendChild(el);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(build, 300); });
  } else {
    setTimeout(build, 300);
  }
})();
