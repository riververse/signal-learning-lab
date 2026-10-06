/* Zero-state impulse comparison; independent of all existing experiments. */
(function () {
  'use strict';
  function impulse(windowLength, alpha, count) {
    if (!Number.isInteger(windowLength) || windowLength < 1 || !(alpha > 0 && alpha <= 1) || !Number.isInteger(count) || count < 1) {
      throw new RangeError('Expected positive integer lengths and 0 < alpha <= 1.');
    }
    const input = Array.from({ length: count }, (_, n) => n === 0 ? 8 : 0);
    const fir = input.map((_, n) => n < windowLength ? 8 / windowLength : 0);
    let previous = 0;
    const iir = input.map(value => {
      previous = alpha * value + (1 - alpha) * previous;
      return previous;
    });
    return { input, fir, iir };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { impulse };
  if (typeof document === 'undefined') return;
  const windowControl = document.getElementById('impulse-window');
  const alphaControl = document.getElementById('impulse-alpha');
  if (!windowControl || !alphaControl) return;
  const controls = document.getElementById('impulse-controls');
  const plots = ['input', 'fir', 'iir'].map(name => document.getElementById('impulse-' + name));
  const ns = 'http://www.w3.org/2000/svg';
  const colors = ['#b8c8d8', '#7bdacf', '#f1c57a'];
  const format = value => value !== 0 && Math.abs(value) < 0.000001 ? value.toExponential(3) : Number(value.toFixed(6)).toString();
  function element(tag, attributes, text) {
    const node = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, String(value)));
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function draw(svg, values, title, color) {
    const width = Math.max(240, Math.round(svg.getBoundingClientRect().width) || 320);
    const left = 30, right = width - 10, top = 18, bottom = 145;
    svg.setAttribute('viewBox', '0 0 ' + width + ' 180');
    svg.querySelector('title').textContent = title;
    svg.querySelector('desc').textContent = '横轴 n 从 0 到 8，纵轴 0 到 8。数值依次为 ' + values.map(format).join('、') + '。';
    svg.parentElement.querySelector('h4').textContent = title;
    const g = element('g', { class: 'if-chart-content' });
    [0, 4, 8].forEach(value => {
      const y = bottom - (bottom - top) * value / 8;
      g.appendChild(element('line', { x1: left, y1: y, x2: right, y2: y, stroke: '#2c3c50' }));
      g.appendChild(element('text', { x: left - 8, y: y + 4, 'text-anchor': 'end' }, value));
    });
    values.forEach((value, n) => {
      const x = left + (right - left) * (n + 0.5) / values.length;
      const y = bottom - (bottom - top) * value / 8;
      g.appendChild(element('line', { x1: x, y1: bottom, x2: x, y2: y, stroke: color, 'stroke-width': 4 }));
      g.appendChild(element('circle', { cx: x, cy: y, r: 3.5, fill: color }));
      if (n % 2 === 0) g.appendChild(element('text', { x, y: 168, 'text-anchor': 'middle' }, n));
    });
    svg.querySelector('.if-chart-content').replaceWith(g);
  }
  function render() {
    const windowLength = Number(windowControl.value);
    const alpha = Number(alphaControl.value);
    const values = impulse(windowLength, alpha, 9);
    document.getElementById('impulse-alpha-value').textContent = alpha.toFixed(2);
    alphaControl.setAttribute('aria-valuetext', alpha.toFixed(2) + '，本次输入权重');
    draw(plots[0], values.input, '输入 x[n]：只在 n = 0 打一拍', colors[0]);
    draw(plots[1], values.fir, 'FIR：' + windowLength + ' 点滑动平均', colors[1]);
    draw(plots[2], values.iir, 'IIR：α = ' + alpha.toFixed(2) + ' 的指数平滑', colors[2]);
    const end = values.iir[8];
    const tail = end < 0.000001 ? end.toExponential(2) : format(end);
    document.getElementById('impulse-readout').textContent =
      windowLength + ' 点平均在 n = ' + windowLength + ' 起归零；前 ' + windowLength + ' 拍各为 ' + format(8 / windowLength) + '。α = ' + alpha.toFixed(2) + ' 的 IIR 前四拍为 ' + values.iir.slice(0, 4).map(format).join('、') + '；到 n = 8 仍为 ' + tail + '，数学上还没有归零。';
  }
  windowControl.addEventListener('change', render);
  alphaControl.addEventListener('input', render);
  document.getElementById('impulse-reset').addEventListener('click', () => {
    windowControl.value = '4'; alphaControl.value = '0.5'; render();
  });
  controls.hidden = false;
  render();
  let frame = null;
  function scheduleRender() {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => { frame = null; render(); });
  }
  // Only the containing width matters. No animation and no stored learning state.
  if (typeof ResizeObserver !== 'undefined') {
    let lastWidth = 0;
    const observer = new ResizeObserver(entries => {
      const width = Math.round(entries[0].contentRect.width);
      if (width !== lastWidth) { lastWidth = width; scheduleRender(); }
    });
    observer.observe(document.querySelector('.if-impulse'));
  } else window.addEventListener('resize', scheduleRender, { passive: true });
  window.addEventListener('beforeprint', render);
  window.addEventListener('afterprint', scheduleRender);
})();
