(() => {
  'use strict';
  document.documentElement.classList.add('js-enabled');
  const links = [...document.querySelectorAll('.toc a[href^="#"]')];
  const sections = [...document.querySelectorAll('.notebook > section[id]')];
  const mobileToc = document.querySelector('.mobile-toc');
  let scheduled = false;
  function markCurrent() {
    scheduled = false;
    let current = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= 110) current = section;
    }
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) current = sections[sections.length - 1];
    if (!current) return;
    links.forEach(link => {
      if (link.hash === '#' + current.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function scheduleMark() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(markCurrent); }
  }
  addEventListener('scroll', scheduleMark, { passive: true });
  addEventListener('resize', scheduleMark);
  addEventListener('hashchange', scheduleMark);
  links.forEach(link => link.addEventListener('click', () => {
    if (mobileToc && mobileToc.contains(link)) {
      mobileToc.open = false;
      // Keep keyboard focus in the reading content after the menu closes.
      const target = document.getElementById(link.hash.slice(1));
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    }
  }));
  markCurrent();
  // Print all explanations, then restore exactly the reader's previous open states.
  let beforePrintState = null;
  function openForPrint() {
    if (beforePrintState) return;
    beforePrintState = [...document.querySelectorAll('.notebook details')].map(el => [el, el.open]);
    beforePrintState.forEach(([el]) => { el.open = true; });
  }
  function restoreAfterPrint() {
    if (!beforePrintState) return;
    beforePrintState.forEach(([el, open]) => { el.open = open; });
    beforePrintState = null;
  }
  addEventListener('beforeprint', openForPrint);
  addEventListener('afterprint', restoreAfterPrint);
  document.querySelectorAll('[data-print]').forEach(button => button.addEventListener('click', () => window.print()));
})();
