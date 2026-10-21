/* Original synthetic reference calculation, written for this case.
 * No vendor/library source copied, downloaded, imported, or executed.
 * Runs in a browser console or any JavaScript runtime. O(N^2), educational only.
 * Deterministic xorshift32 noise is a test fixture, not a physical noise model.
 */
function psdReference(x, w, fs, nfft = x.length) {
  const sw = w.reduce((a, b) => a + b, 0);
  const sw2 = w.reduce((a, b) => a + b * b, 0);
  const psd = [], power = [];
  for (let k = 0; k <= Math.floor(nfft / 2); k++) {
    let re = 0, im = 0;
    for (let n = 0; n < x.length; n++) {
      const a = -2 * Math.PI * k * n / nfft;
      re += x[n] * w[n] * Math.cos(a);
      im += x[n] * w[n] * Math.sin(a);
    }
    const c = k === 0 || (nfft % 2 === 0 && k === nfft / 2) ? 1 : 2;
    psd.push(c * (re * re + im * im) / (fs * sw2));
    power.push(c * (re * re + im * im) / (sw * sw));
  }
  return {
    sw, sw2, enbw: fs * sw2 / (sw * sw), psd, power,
    integrated: psd.reduce((a, b) => a + b, 0) * fs / nfft,
    sumPower: power.reduce((a, b) => a + b, 0)
  };
}
function periodicHann(n) {
  return Array.from({length: n}, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n));
}
function assertClose(a, b, tolerance = 1e-10) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > tolerance) throw new Error(`${a} != ${b}`);
}
const N = 1024, fs = 1024;
const w = periodicHann(N);
const x = Array.from({length: N}, (_, n) => Math.SQRT2 * Math.sin(2 * Math.PI * 128 * n / N));
const s = psdReference(x, w, fs);
const padded = psdReference(x, w, fs, 4096);
assertClose(s.sw, 512);
assertClose(s.sw2, 384);
assertClose(s.enbw, 1.5);
assertClose(s.power[128], 1);
assertClose(s.psd[128], 2 / 3);
assertClose(s.integrated, 1);
assertClose(s.sumPower, 1.5);
assertClose(padded.enbw, 1.5);
assertClose(padded.integrated, 1);
assertClose(padded.sumPower, 6);
const dc = psdReference(Array(N).fill(1), Array(N).fill(1), fs);
const nyquist = psdReference(Array.from({length:N}, (_,n) => n % 2 ? -1 : 1), Array(N).fill(1), fs);
assertClose(dc.integrated, 1);
assertClose(nyquist.integrated, 1);
let state = 0x12345678;
const samples = Array.from({length: 16384}, () => {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return Math.sqrt(3) * (2 * ((state >>> 0) / 4294967296) - 1);
});
function welchReference(L) {
  const window = periodicHann(L);
  let count = 0, p = null, q = null;
  for (let i = 0; i + L <= samples.length; i += L / 2) {
    const z = psdReference(samples.slice(i, i + L), window, fs);
    if (!p) { p = z.psd.map(() => 0); q = z.power.map(() => 0); }
    for (let k = 0; k < p.length; k++) { p[k] += z.psd[k]; q[k] += z.power[k]; }
    count++;
  }
  p = p.map(v => v / count);
  q = q.map(v => v / count);
  return {
    L, count, df: fs / L, enbw: 1.5 * fs / L,
    meanInteriorPSD: p.slice(1, -1).reduce((a,b) => a+b, 0) / (p.length - 2),
    meanInteriorPower: q.slice(1, -1).reduce((a,b) => a+b, 0) / (q.length - 2),
    integrated: p.reduce((a,b) => a+b, 0) * fs / L
  };
}
const output = {
  tone: {sumW:s.sw, sumW2:s.sw2, enbw:s.enbw, psd127to129:s.psd.slice(127,130), power127to129:s.power.slice(127,130), integrated:s.integrated, sumPower:s.sumPower},
  padded: {nfft:4096, df:fs/4096, enbw:padded.enbw, integrated:padded.integrated, sumPower:padded.sumPower},
  dc:{integrated:dc.integrated, psd0:dc.psd[0]},
  nyquist:{integrated:nyquist.integrated, psdLast:nyquist.psd.at(-1)},
  noise:[welchReference(256),welchReference(512)],
  noiseExpectedPSD:2/fs,
  assertionTolerance:1e-10
};
if (typeof console !== 'undefined') console.log(JSON.stringify(output, null, 2));

// Publication contract and independent deterministic Welch regressions.
const assert = require('node:assert/strict'), fsNode = require('node:fs');
const published = JSON.parse(fsNode.readFileSync(__dirname + '/engineering-cases.json', 'utf8')).cases.find(c => c.id === 'ni-psd-window-normalization');
assert.ok(published);
assert.equal(published.last_verified, '2026-10-21');
assert.equal(published.status, '待学习');
for (const phrase of ['1.5 Hz','0.25 Hz','1.2247 Vrms','DC','Nyquist','Σw²','未执行 SciPy','不是物理白噪声','不去均值']) assert.ok(JSON.stringify(published).includes(phrase), phrase);
assertClose(output.noise[0].integrated, .99521113001, 1e-10);
assertClose(output.noise[1].integrated, .99792179025, 1e-10);
assertClose(output.noise[0].meanInteriorPSD, .00194053448, 1e-11);
assertClose(output.noise[1].meanInteriorPSD, .00194797347, 1e-11);
assert.equal(output.noise[0].count,127); assert.equal(output.noise[1].count,63);
assertClose(s.power[127], .25); assertClose(s.power[129], .25);
assertClose(padded.sumPower / 1.5, 4);
assertClose(s.sumPower / s.integrated, s.enbw / (fs / N));
console.log('PASS: PSD normalization, zero-padding, endpoint, Welch and publication contracts.');
