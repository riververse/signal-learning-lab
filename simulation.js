(function (root) {
  'use strict';
  const SCENARIOS = {
    pressure: {
      file: 'pressure.html', title: '压力测量波形实验',
      note: '100 Hz 压力信号。三种滤波器共享同一组噪声，比较输出与 RMSE。',
      groups: [['经典滤波', [['iir', 'IIR · 一阶指数平滑'], ['fir', 'FIR · 滑动平均'], ['kalman', 'Kalman · 标量随机游走']]]]
    },
    motion: {
      file: 'motion.html', title: '运动控制波形实验',
      note: '同屏最多比较 4 条结果；保留误差、阶跃 T50、频谱、播放和数据导出。',
      groups: [
        ['经典滤波', [['iir', 'IIR · 一阶低通'], ['fir', 'FIR · Hamming 窗低通'], ['kalman', 'Kalman · 标量模型'], ['moving-average', '滑动平均 · FIR 特例'], ['median', '滑动中值 · 非线性']]],
        ['其他可运行教学实现', [['butter', '二阶 Butterworth 低通'], ['notch', '二阶陷波'], ['cvkalman', '恒速度 Kalman'], ['alphabeta', 'α–β 位置与速度估计'], ['oneeuro', 'One Euro · 离散变体'], ['trimmed', '截尾均值'], ['hampel', 'Hampel 异常值抑制'], ['nlms', 'NLMS · 需要参考通道'], ['sg', 'Savitzky–Golay · 尾随端点'], ['wavelet', 'Haar 小波 · 离线整段'], ['slew', '变化率限制'], ['deadband', '死区保持']]],
        ['专用输入场景', [['unwrap', '编码器 · 展开后低通'], ['complementary', 'IMU · 一轴互补融合'], ['anglebias', 'IMU · 角度与偏置 Kalman'], ['gyro', 'IMU · 纯陀螺积分基线']]]
      ]
    },
    frequency: {
      file: 'frequency.html', title: '频率选择波形实验',
      note: '100 Hz 采样；输入包含 0.5、5、20 Hz。观察稳态波形和幅度保留比例。',
      groups: [['一阶 IIR 与级联', [['low', '低通 · 留下慢变化'], ['high', '高通 · 削弱基线与慢漂移'], ['band', '带通 · 高通与低通级联']]]]
    }
  };
  const ALIASES = { ema: 'iir', ma: 'moving-average', movingaverage: 'moving-average', moving_average: 'moving-average', oneEuro: 'oneeuro', 'one-euro': 'oneeuro', lowpass: 'low', highpass: 'high', bandpass: 'band' };
  const algorithms = scenario => SCENARIOS[scenario].groups.flatMap(group => group[1].map(item => item[0]));
  function resolve(search) {
    const query = new URLSearchParams(search);
    let scenario = query.get('scenario') || 'pressure';
    let algorithm = query.get('algorithm') || '';
    let notice = '';
    if (!Object.hasOwn(SCENARIOS, scenario)) { scenario = 'pressure'; notice = '未识别这个场景，已打开压力实验。'; }
    algorithm = Object.hasOwn(ALIASES, algorithm) ? ALIASES[algorithm] : algorithm;
    if (scenario === 'pressure' && algorithm === 'moving-average') algorithm = 'fir';
    if (scenario === 'frequency' && algorithm === 'iir') algorithm = 'low';
    if (algorithm && !algorithms(scenario).includes(algorithm)) {
      if (algorithms('motion').includes(algorithm)) {
        scenario = 'motion'; notice = '这个算法使用运动实验的输入与参数，已切换到运动控制。';
      } else if (algorithms('frequency').includes(algorithm)) {
        scenario = 'frequency'; notice = '这个预设属于频率选择，已切换到对应实验。';
      } else {
        algorithm = ''; notice = '这个算法尚未接入当前波形，已打开默认对比。可在下方查看源码项目与实现边界。';
      }
    }
    return { scenario, algorithm, notice };
  }
  function queryFor(state) {
    const query = new URLSearchParams({ scenario: state.scenario });
    if (state.algorithm) query.set('algorithm', state.algorithm);
    return query.toString();
  }
  function standaloneFor(state) {
    return SCENARIOS[state.scenario].file + (state.algorithm ? '?algorithm=' + encodeURIComponent(state.algorithm) : '');
  }
  const API = { SCENARIOS, resolve, queryFor, standaloneFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (!root || !root.document) return;
  const document = root.document;
  const $ = id => document.getElementById(id);
  const frame = $('simulation-frame');
  if (!frame) return;
  const status = $('simulation-status');
  const statusText = status.querySelector('span');
  const retry = $('simulation-retry');
  let current, serial = 0, token = '', watchdog = null, ready = false;
  function showError(message) {
    status.hidden = false;
    status.dataset.error = 'true';
    statusText.textContent = message + ' 可点击“单独打开实验”继续。';
    retry.hidden = false;
    $('simulation-frame-shell').setAttribute('aria-busy', 'false');
  }
  function refreshControls() {
    const config = SCENARIOS[current.scenario];
    document.querySelectorAll('[data-scenario]').forEach(link => {
      if (link.dataset.scenario === current.scenario) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const select = $('simulation-algorithm');
    select.replaceChildren();
    const defaultOption = document.createElement('option');
    defaultOption.value = ''; defaultOption.textContent = '默认对比'; select.appendChild(defaultOption);
    config.groups.forEach(([name, values]) => {
      const group = document.createElement('optgroup'); group.label = name;
      values.forEach(([value, name]) => { const option = document.createElement('option'); option.value = value; option.textContent = name; group.appendChild(option); });
      select.appendChild(group);
    });
    select.value = current.algorithm;
    $('simulation-scenario-note').textContent = config.note;
    $('simulation-standalone').href = standaloneFor(current);
    frame.title = config.title;
    document.querySelectorAll('[data-quick-algorithm]').forEach(link => {
      const id = link.dataset.quickAlgorithm;
      const candidate = resolve(new URLSearchParams({ scenario: current.scenario, algorithm: id }).toString());
      link.href = 'simulation.html?' + queryFor(candidate);
      if (candidate.scenario === current.scenario && candidate.algorithm === current.algorithm) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    $('simulation-selection-note').hidden = !current.notice;
    $('simulation-selection-note').textContent = current.notice;
  }
  function load(state, historyMode) {
    current = state;
    refreshControls();
    if (historyMode && root.history && root.location.protocol !== 'file:') {
      const url = new URL(root.location.href); url.search = queryFor(current);
      root.history[historyMode + 'State']({ scenario: current.scenario, algorithm: current.algorithm }, '', url);
    }
    clearTimeout(watchdog);
    ready = false;
    token = String(Date.now()) + '-' + (++serial);
    status.hidden = false; status.dataset.error = 'false'; statusText.textContent = '正在准备' + SCENARIOS[current.scenario].title + '…'; retry.hidden = true;
    $('simulation-frame-shell').setAttribute('aria-busy', 'true');
    // A fresh bounded height lets both a tall and a short scenario resize correctly.
    frame.style.height = '1250px';
    const frameURL = new URL(standaloneFor(current), root.location.href);
    frameURL.searchParams.set('embed', '1'); frameURL.searchParams.set('bridge', token);
    frame.src = frameURL.href;
    if (root.location.protocol === 'file:') {
      showError('本地文件预览无法验证嵌入页面来源。请通过站点地址访问，或单独打开实验。');
      return;
    }
    const expectedToken = token;
    watchdog = root.setTimeout(() => { if (!ready && token === expectedToken) showError('实验未能完成加载。'); }, 8000);
  }
  function acceptMessage(event) {
    if (event.origin !== root.location.origin || event.origin === 'null' || event.source !== frame.contentWindow) return;
    const message = event.data;
    if (!message || message.channel !== 'river-lab-embed' || message.token !== token || message.page !== SCENARIOS[current.scenario].file) return;
    if (message.type === 'error') { clearTimeout(watchdog); showError('实验运行遇到问题，请重新载入。'); return; }
    if (message.type === 'ready') {
      ready = true; clearTimeout(watchdog); status.hidden = true;
      $('simulation-frame-shell').setAttribute('aria-busy', 'false');
    }
    if ((message.type === 'resize' || message.type === 'ready') && typeof message.height === 'number' && Number.isFinite(message.height)) {
      const height = Math.min(30000, Math.max(360, Math.ceil(message.height)));
      if (Math.abs(parseFloat(frame.style.height) - height) > 2) frame.style.height = height + 'px';
    }
  }
  root.addEventListener('message', acceptMessage);
  frame.addEventListener('error', () => showError('无法载入实验页面。'));
  frame.addEventListener('load', () => {
    if (ready) return;
    try {
      const doc = frame.contentDocument;
      if (!doc || !doc.querySelector('canvas')) showError('未找到完整的实验内容。');
    } catch (error) { showError('无法读取实验页面。'); }
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-scenario],a[data-quick-algorithm],a[data-launch]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (link.dataset.scenario === current.scenario) return;
    const next = resolve(new URL(link.href, root.location.href).search);
    if (current.scenario === next.scenario && current.algorithm === next.algorithm) return;
    load(next, 'push');
    if (link.hasAttribute('data-launch')) {
      document.querySelector('.simulation-workspace').scrollIntoView({ behavior: root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  });
  $('simulation-algorithm').addEventListener('change', event => load(resolve(new URLSearchParams({ scenario: current.scenario, algorithm: event.target.value }).toString()), 'push'));
  retry.addEventListener('click', () => load(current));
  root.addEventListener('popstate', () => load(resolve(root.location.search)));
  load(resolve(root.location.search), 'replace');
})(typeof window === 'undefined' ? null : window);
