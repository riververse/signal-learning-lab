/* Progressive enhancements for the visual notebook additions only.
   No learning-status or persistence writes; all figures have a complete static fallback. */
(() => {
  'use strict';
  const B = '#72b4ff', A = '#f1c57a', T = '#65d6c2', M = '#adc2d5', I = '#e3edf7', GRID = '#33495f';
  const clean = n => Math.abs(n) < 0.0000001 ? 0 : n;
  function phaseValues(degrees) {
    const radians = degrees * Math.PI / 180;
    return { degrees, u: clean(2 * Math.cos(radians)), v: clean(-2 * Math.sin(radians)) };
  }
  function gainValues(r) {
    const k = 16 / (16 + r);
    return { r, k, mean: 100 + k * 10, variance: (1 - k) * 16 };
  }
  const line = (x1, y1, x2, y2, c = GRID, w = 1) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}"/>`;
  const txt = (x, y, text, c = I, size = 15, anchor = 'start') => `<text x="${x}" y="${y}" fill="${c}" font-size="${size}" text-anchor="${anchor}">${text}</text>`;
  function vector(x1, y1, x2, y2, color) {
    const distance = Math.hypot(x2 - x1, y2 - y1);
    const dx = (x2 - x1) / distance, dy = (y2 - y1) / distance;
    return line(x1, y1, x2, y2, color, 2.5) + `<path d="M${x2},${y2} L${x2-8*dx-4*dy},${y2-8*dy+4*dx} L${x2-8*dx+4*dy},${y2-8*dy-4*dx} Z" fill="${color}"/>`;
  }
  function gainSVG(values) {
    const { r, mean, variance } = values;
    const x = pressure => 55 + (pressure - 88) * 17;
    let body = txt(20, 26, '横向看压力，线段宽度看标准差', I, 17);
    [[84, '预测', 100, 16, B], [154, '测量', 110, r, A], [224, '更新', mean, variance, T]].forEach(([y, label, center, v, c]) => {
      const sd = Math.sqrt(v);
      body += txt(20, y-21, label, c) + line(x(center-sd), y, x(center+sd), y, c, 6);
      body += `<circle cx="${x(center)}" cy="${y}" r="5" fill="${c}"/>`;
      [center-sd, center+sd].forEach(end => { body += line(x(end), y-9, x(end), y+9, c, 2); });
      body += txt(590, y-21, center.toFixed(2), c, 15, 'end');
    });
    [90,95,100,105,110,115,120].forEach(p => { body += line(x(p),249,x(p),255) + txt(x(p),277,p,M,13,'middle'); });
    body += line(x(88),249,x(121),249) + txt(591,308,'压力 / kPa',M,14,'end');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 328" role="img" aria-labelledby="lv-uncertainty-title lv-uncertainty-desc" font-family="Noto Sans CJK SC, Microsoft YaHei, sans-serif"><title id="lv-uncertainty-title">预测、测量与更新的中心和标准差</title><desc id="lv-uncertainty-desc">预测100千帕，方差16；测量110千帕，方差${r}。更新后${mean.toFixed(2)}千帕，方差${variance.toFixed(3)}。每条横线表示中心加减一个标准差，不是真值保证区间。</desc><rect width="620" height="328" fill="#101c29"/>${body}</svg>`;
  }
  const phaseInput = document.getElementById('lv-phase');
  if (phaseInput) {
    const setPhase = () => {
      const { degrees, u, v } = phaseValues(Number(phaseInput.value));
      const imaginary = clean(-v);
      const coefficient = `${u.toFixed(2)} ${imaginary < 0 ? '−' : '+'} ${Math.abs(imaginary).toFixed(2)}i`;
      document.getElementById('lv-phase-value').textContent = `${degrees}°`;
      document.getElementById('lv-u').textContent = `U = ${u.toFixed(2)}`;
      document.getElementById('lv-v').textContent = `V = ${v.toFixed(2)}`;
      document.getElementById('lv-phase-vector').innerHTML = vector(156,156,156+41*u,156-41*imaginary,T);
      document.getElementById('lv-channels-desc').textContent = `相位${degrees}度；余弦路平均U为${u.toFixed(2)}，正弦路平均V为${v.toFixed(2)}。系数C为${coefficient}。`;
      document.getElementById('lv-phase-desc').textContent = `系数C为${coefficient}，模长为2，相位${degrees}度。原信号峰值幅度为4。`;
      document.getElementById('lv-phase-summary').textContent = `φ = ${degrees}°：U = ${u.toFixed(2)}，V = ${v.toFixed(2)}，C = ${coefficient}。模长始终为 2。`;
    };
    phaseInput.addEventListener('input', setPhase);
    document.querySelector('[data-phase-control]').hidden = false;
    setPhase();
  }
  const rInput = document.getElementById('lv-r');
  if (rInput) {
    const setGain = () => {
      const values = gainValues(Number(rInput.value));
      const { r, k, mean, variance } = values;
      document.getElementById('lv-r-value').textContent = `${r} kPa²`;
      document.querySelector('#lv-uncertainty-chart .lv-scroll').innerHTML = gainSVG(values);
      document.getElementById('lv-gain-summary').textContent = `R = ${r} kPa² → K = ${k.toFixed(3)} → 更新压力 ${mean.toFixed(2)} kPa；P⁺ = ${variance.toFixed(3)} kPa²。`;
    };
    rInput.addEventListener('input', setGain);
    document.querySelector('[data-gain-control]').hidden = false;
    setGain();
  }
  // Existing or newly added anchors inside a folded explanation must remain usable.
  // Never open checkpoint answers merely because their containing chapter is targeted.
  function revealHash(hash = location.hash) {
    if (!hash || hash === '#') return;
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch (_) { return; }
    const target = document.getElementById(id);
    if (!target) return;
    let current = target, changed = false;
    while (current && current !== document.body) {
      if (current.tagName === 'DETAILS' && !current.open) { current.open = true; changed = true; }
      current = current.parentElement;
    }
    if (changed) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  }
  addEventListener('hashchange', () => revealHash());
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (link && link.hash === location.hash) revealHash(link.hash);
  });
  revealHash();
})();
