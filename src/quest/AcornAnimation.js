// AcornAnimation.js
// -----------------------------------------------------------------------------
// Tiny utility: floats a "+1 🌰" above a target element when a chore is checked
// off. Self-removing. Classic-script global `AcornAnimation`.
// -----------------------------------------------------------------------------

const AcornAnimation = (() => {
  function play(targetElement) {
    if (!targetElement || !targetElement.getBoundingClientRect) return;
    const r = targetElement.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'acorn-float';
    el.textContent = '+1 🌰';
    el.style.left = (r.left + r.width / 2) + 'px';
    el.style.top = (r.top) + 'px';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => { if (el.parentNode) el.parentNode.removeChild(el); });
    // Safety net in case animationend doesn't fire.
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 1300);
  }
  return { play };
})();

window.AcornAnimation = AcornAnimation;
