/* Progressive phone-reading helpers. No experiment state, progress or data is stored. */
(function () {
  'use strict';
  const phone = window.matchMedia('(max-width: 760px)');
  const originalDiagrams = [...document.querySelectorAll('.mr-original-diagram')];
  const regions = new Map();
  let scheduled = false;
  let nextHintId = 0;
  let beforePrint = null;

  function prepareRegion(element, kind) {
    if (regions.has(element)) return;
    element.classList.add('mr-scroll');
    const previous = {
      tabindex: element.getAttribute('tabindex'),
      role: element.getAttribute('role'),
      label: element.getAttribute('aria-label'),
      describedby: element.getAttribute('aria-describedby')
    };
    const hint = document.createElement('p');
    hint.className = 'mr-scroll-hint';
    hint.dataset.mobileReadingUi = '';
    hint.id = 'mr-scroll-hint-' + (++nextHintId);
    hint.textContent = kind + '较宽，可左右滑动查看；键盘可聚焦后按左右方向键。';
    element.insertAdjacentElement('afterend', hint);
    regions.set(element, { kind: kind, hint: hint, previous: previous });
  }

  function matchesIn(root, selector) {
    return [...(root.nodeType === 1 && root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)];
  }
  function prepareContent(root) {
    matchesIn(root, '.formula,.equation,.math,pre,.table-scroll,.table-wrap,.lv-scroll,.control-figure-viewport,.lesson-list').forEach(function (element) {
      if (element.closest('.lab-site-header')) return;
      const kind = element.matches('.formula,.equation,.math') ? '公式' :
        element.matches('pre') ? '代码' :
        element.matches('.table-scroll,.table-wrap') ? '表格' :
        element.matches('.lesson-list') ? '实验列表' : '图示';
      prepareRegion(element, kind);
    });
    matchesIn(root, 'table').forEach(function (table) {
      if (table.closest('.table-scroll,.table-wrap,.mr-table-viewport')) return;
      const viewport = document.createElement('div');
      viewport.className = 'mr-table-viewport';
      table.parentNode.insertBefore(viewport, table);
      viewport.appendChild(table);
      prepareRegion(viewport, '表格');
    });
    matchesIn(root, '.control-charts svg,.complex-figure svg,.learn-visual .lv-panel svg').forEach(function (svg) {
      if (svg.parentElement.classList.contains('mr-chart-viewport')) return;
      const viewport = document.createElement('div');
      viewport.className = 'mr-chart-viewport';
      svg.parentNode.insertBefore(viewport, svg);
      viewport.appendChild(svg);
      // Keep original coordinates and labels rather than shrinking an entire plot.
      const width = svg.viewBox.baseVal.width;
      if (width) viewport.style.setProperty('--mr-chart-width', width + 'px');
      prepareRegion(viewport, '图示');
    });
  }

  function restoreAttribute(element, name, value) {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }
  function measure() {
    scheduled = false;
    regions.forEach(function (record, element) {
      if (!element.isConnected) {
        record.hint.remove();
        regions.delete(element);
        return;
      }
      const overflow = phone.matches && element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2;
      element.dataset.overflow = String(overflow);
      record.hint.dataset.overflow = String(overflow);
      // Hidden disclosures need no tab stop. Desktop keeps its previous semantics.
      if (overflow) {
        if (record.previous.tabindex === null) element.tabIndex = 0;
        if (record.previous.role === null) element.setAttribute('role', 'region');
        if (record.previous.label === null) element.setAttribute('aria-label', '可左右滚动的' + record.kind);
        element.setAttribute('aria-describedby', [record.previous.describedby, record.hint.id].filter(Boolean).join(' '));
      } else {
        restoreAttribute(element, 'tabindex', record.previous.tabindex);
        restoreAttribute(element, 'role', record.previous.role);
        restoreAttribute(element, 'aria-label', record.previous.label);
        restoreAttribute(element, 'aria-describedby', record.previous.describedby);
      }
    });
  }
  function scheduleMeasure() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(measure);
  }
  function setDiagramLayout() {
    originalDiagrams.forEach(function (details) { details.open = !phone.matches; });
    scheduleMeasure();
  }
  prepareContent(document);
  setDiagramLayout();
  if (phone.addEventListener) phone.addEventListener('change', setDiagramLayout);
  else phone.addListener(setDiagramLayout);
  window.addEventListener('resize', scheduleMeasure, { passive: true });
  document.addEventListener('toggle', scheduleMeasure, true);
  document.addEventListener('input', scheduleMeasure, true);
  document.addEventListener('click', scheduleMeasure, true);
  // Existing experiments replace readout and chart nodes. Discover only newly added content.
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType === 1 && !node.matches('.mr-scroll-hint')) prepareContent(node);
      });
    });
    scheduleMeasure();
  });
  const main = document.querySelector('main');
  if (main) observer.observe(main, { childList: true, subtree: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleMeasure);
  window.addEventListener('beforeprint', function () {
    if (beforePrint) return;
    beforePrint = originalDiagrams.map(function (details) { return details.open; });
    originalDiagrams.forEach(function (details) { details.open = true; });
  }, { capture: true });
  window.addEventListener('afterprint', function () {
    if (!beforePrint) return;
    originalDiagrams.forEach(function (details, index) { details.open = beforePrint[index]; });
    beforePrint = null;
    scheduleMeasure();
  });
})();
