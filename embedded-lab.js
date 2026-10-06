/* Adapt existing experiment controls without replacing their numerical engines. */
(function () {
  'use strict';
  const query = new URLSearchParams(window.location.search);
  const page = window.location.pathname.split('/').pop();
  if (!['pressure.html', 'motion.html', 'frequency.html'].includes(page)) return;
  let embedded = false;
  try {
    embedded = query.get('embed') === '1' && window.parent !== window &&
      window.location.origin !== 'null' && window.parent.location.origin === window.location.origin &&
      window.parent.location.pathname.split('/').pop() === 'simulation.html';
  } catch (error) { embedded = false; }
  if (embedded) document.documentElement.classList.add('lab-embedded');
  let token = query.get('bridge') || '';
  const aliases = { ema: 'iir', ma: 'moving-average', movingaverage: 'moving-average', moving_average: 'moving-average', oneEuro: 'oneeuro', 'one-euro': 'oneeuro', lowpass: 'low', highpass: 'high', bandpass: 'band' };
  const requested = query.get('algorithm') || '';
  const algorithm = Object.hasOwn(aliases, requested) ? aliases[requested] : requested;
  let scheduled = false, lastHeight = 0;
  function contentHeight() {
    // scrollHeight is at least the iframe viewport height and cannot reliably shrink.
    const rect = document.body.getBoundingClientRect();
    const style = window.getComputedStyle(document.body);
    return Math.min(30000, Math.max(360, Math.ceil(rect.height + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0) + 2)));
  }
  function post(type) {
    if (!embedded) return;
    const height = contentHeight();
    if (type === 'resize' && Math.abs(height - lastHeight) <= 2) return;
    lastHeight = height;
    window.parent.postMessage({ channel: 'river-lab-embed', type, token, page, algorithm, height }, window.location.origin);
  }
  function scheduleResize() {
    if (scheduled || !embedded) return;
    scheduled = true;
    window.requestAnimationFrame(() => { scheduled = false; post('resize'); });
  }
  function applyAlgorithm() {
    if (!algorithm) return;
    if (page === 'pressure.html') {
      const presets = { iir: ['alpha', 0.05], fir: ['n', 40], 'moving-average': ['n', 40], kalman: ['q', 0.8] };
      if (!Object.hasOwn(presets, algorithm)) return;
      const [id, value] = presets[algorithm];
      const input = document.getElementById(id);
      if (!input) throw new Error('压力实验控件未能初始化');
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.closest('.control')?.classList.add('embedded-focus-control');
    } else if (page === 'motion.html') {
      const id = algorithm === 'iir' ? 'ema' : algorithm === 'moving-average' ? 'ma' : algorithm;
      if (!window.Teaching || !Object.hasOwn(window.Teaching.algorithms, id)) return;
      const button = document.querySelector('[data-try="' + id + '"]');
      if (!button || !window.FilterLab) throw new Error('运动实验控件未能初始化');
      // Reuse the original "try in waveform" handler: it sets compatible inputs,
      // selects the requested algorithm, focuses its controls, and recomputes.
      button.click();
    } else if (page === 'frequency.html') {
      const mode = algorithm === 'iir' ? 'low' : algorithm;
      if (!['low', 'high', 'band'].includes(mode)) return;
      const button = document.querySelector('[data-mode="' + mode + '"]');
      if (!button) throw new Error('频率实验控件未能初始化');
      button.click();
    }
  }
  function addJumps() {
    if (!embedded) return;
    const main = document.querySelector('main');
    if (!main) return;
    let targets = [];
    if (page === 'motion.html') {
      targets = [['wave-chart', '看波形'], ['parameters', '调算法参数'], ['scenario', '改信号与对比算法'], ['error-chart', '看误差 / 频谱']];
    } else if (page === 'pressure.html') {
      targets = [['plot', '看波形'], ['sliders', '调参数'], ['metrics', '看误差']];
    } else {
      targets = [['timeplot', '看波形'], ['cutoff', '调截止频率'], ['gainplot', '看幅频响应']];
    }
    const nav = document.createElement('nav');
    nav.className = 'embedded-lab-jumps'; nav.setAttribute('aria-label', '当前实验快捷跳转');
    targets.forEach(([id, label]) => {
      const link = document.createElement('a'); link.href = '#' + id; link.textContent = label; nav.appendChild(link);
    });
    main.prepend(nav);
  }
  function reportError() { post('error'); }
  function start() {
    try {
      applyAlgorithm();
      addJumps();
      if (!embedded) return;
      if (page === 'motion.html' && !window.FilterLab) throw new Error('运动实验尚未就绪');
      if (page === 'pressure.html' && !document.querySelector('#metrics .metric')) throw new Error('压力实验尚未就绪');
      if (page === 'frequency.html' && !document.querySelector('#components .component')) throw new Error('频率实验尚未就绪');
      // Parent navigation must never become a second website nested inside the frame.
      // In-page anchors remain local, downloads retain their original behavior.
      document.addEventListener('click', event => {
        const anchor = event.target.closest('a[href]');
        if (!anchor || anchor.hasAttribute('download') || anchor.target === '_blank') return;
        const href = anchor.getAttribute('href');
        if (!href || href.startsWith('#')) return;
        let url;
        try { url = new URL(href, window.location.href); } catch (error) { return; }
        if (url.origin === window.location.origin && /\.html$/.test(url.pathname)) anchor.target = '_top';
      });
      let healthy = true;
      window.addEventListener('message', event => {
        if (event.source !== window.parent || event.origin !== window.location.origin || event.origin === 'null') return;
        const message = event.data;
        if (!message || message.channel !== 'river-lab-embed' || message.type !== 'sync' ||
            message.page !== page || message.algorithm !== algorithm ||
            typeof message.token !== 'string' || !message.token || message.token.length > 100) return;
        // A restored document may have an older bridge token in its URL. Rejoin
        // the current parent navigation only for this exact page and preset;
        // do not reapply the preset or discard the restored experiment state.
        token = message.token;
        post(healthy ? 'ready' : 'error');
      });
      window.addEventListener('pageshow', () => post('hello'));
      const runtimeError = () => { healthy = false; reportError(); };
      window.addEventListener('error', runtimeError);
      window.addEventListener('unhandledrejection', runtimeError);
      if (typeof ResizeObserver === 'function') {
        const observer = new ResizeObserver(scheduleResize);
        observer.observe(document.body);
        const main = document.querySelector('main'); if (main) observer.observe(main);
      }
      window.addEventListener('resize', scheduleResize, { passive: true });
      document.addEventListener('toggle', scheduleResize, true);
      document.addEventListener('input', scheduleResize, true);
      document.addEventListener('change', scheduleResize, true);
      document.addEventListener('click', scheduleResize, true);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleResize);
      window.requestAnimationFrame(() => { post(healthy ? 'ready' : 'error'); post('hello'); });
    } catch (error) {
      if (embedded) post('error');
      else {
        const notice = document.createElement('p');
        notice.className = 'notice'; notice.setAttribute('role', 'alert');
        notice.textContent = '预设未能载入。请刷新后重试，或使用下方控件手动选择算法。';
        document.querySelector('main')?.prepend(notice);
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
