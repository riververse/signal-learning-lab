/* Digital low-pass magnitude responses. Bilinear frequency mapping, fs = 1000 Hz,
   Wn = 100 Hz. The formulas are checked against SciPy butter/cheby1 SOS responses.
   This comparison neither designs implementation coefficients nor records progress. */
(function (root, factory) {
 'use strict';
 var api = factory();
 if (typeof module === 'object' && module.exports) module.exports = api;
 if (!root || !root.document) return;
 root.RiverFilterFamilies = api;
 var doc = root.document;
 function init() {
  var panel = doc.getElementById('topic-filter-families');
  if (!panel) return;
  var order = doc.getElementById('ff-order'), ripple = doc.getElementById('ff-ripple');
  function render() {
   var n = Number(order.value), rp = Number(ripple.value);
   if (![2, 4, 6].includes(n) || ![0.5, 1, 3].includes(rp)) return;
   panel.querySelectorAll('[data-ff-curve]').forEach(function (path) {
    var zoom = path.dataset.ffZoom === 'true';
    path.setAttribute('d', api.path(path.dataset.ffCurve, n, rp, zoom ? 100 : 400, zoom ? -3.5 : -60));
   });
   doc.getElementById('ff-summary').textContent = n + ' 阶，rp = ' + rp + ' dB。100 Hz 处：巴特沃斯 −3.01 dB，切比雪夫 I −' + rp.toFixed(2) + ' dB。200 Hz 处分别为 ' + api.response('butter', 200, n, rp).toFixed(2) + ' dB 与 ' + api.response('cheby1', 200, n, rp).toFixed(2) + ' dB。';
   doc.getElementById('ff-ripple-note').textContent = '切比雪夫 I 的通带在 0 到 −' + rp + ' dB 之间起伏。这里都是偶数阶，所以 0 Hz 也在 −' + rp + ' dB；没有偷偷把直流重新拉到 0 dB。';
  }
  order.disabled = false; ripple.disabled = false;
  order.addEventListener('change', render); ripple.addEventListener('change', render);
  render();
 }
 if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
}(typeof window !== 'undefined' ? window : null, function () {
 'use strict';
 function response(family, f, order, ripple) {
  if (!(f >= 0 && f < 500) || !Number.isInteger(order) || order < 1 || !(ripple > 0)) throw new RangeError('Invalid filter comparison parameter');
  var x = Math.tan(Math.PI * f / 1000) / Math.tan(Math.PI * 100 / 1000);
  if (family === 'butter') return -10 * Math.log10(1 + Math.pow(x, 2 * order));
  if (family !== 'cheby1') throw new RangeError('Unknown filter family');
  var t0 = 1, t1 = x;
  for (var k = 2; k <= order; k++) { var next = 2 * x * t1 - t0; t0 = t1; t1 = next; }
  return -10 * Math.log10(1 + (Math.pow(10, ripple / 10) - 1) * t1 * t1);
 }
 function path(family, order, ripple, maximum, floor) {
  var parts = [];
  for (var i = 0; i <= 600; i++) {
   var db = Math.max(floor, Math.min(0, response(family, maximum * i / 600, order, ripple)));
   parts.push((i ? 'L' : 'M') + i.toFixed(2) + ' ' + (220 * db / floor).toFixed(3));
  }
  return parts.join(' ');
 }
 return {response: response, path: path};
}));
