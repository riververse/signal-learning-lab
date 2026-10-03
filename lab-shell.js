/* Shared page navigation. Experiment controls and calculations are independent. */
(function () {
  'use strict';
  const header = document.querySelector('.lab-site-header');
  if (!header) return;
  const toggle = header.querySelector('.lab-nav-toggle');
  const smallScreen = window.matchMedia('(max-width: 1120px)');
  let open = false;
  function render() {
    header.dataset.menuOpen = String(open);
    toggle.setAttribute('aria-expanded', String(!smallScreen.matches || open));
  }
  toggle.hidden = false;
  header.dataset.navigationReady = 'true';
  toggle.addEventListener('click', function () { open = !open; render(); });
  header.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && open && smallScreen.matches) {
      open = false; render(); toggle.focus();
    }
  });
  function resize() { if (!smallScreen.matches) open = false; render(); }
  if (smallScreen.addEventListener) smallScreen.addEventListener('change', resize);
  else smallScreen.addListener(resize);
  render();
})();
