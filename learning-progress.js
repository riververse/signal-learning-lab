/* Device-local self-reports only. No analytics, backend, chat access, or AI grading. */
(function (root, factory) {
  'use strict';
  var model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  if (!root || !root.document) return;
  if (root.RiverLearning) return;
  root.RiverLearning = model;
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { model.init(root); });
  else model.init(root);
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  var KEY = 'river.learning.progress.v1';
  var TOPICS = { transforms: '三大变换', 'iir-fir': 'IIR / FIR', kalman: '卡尔曼滤波', transfer: '传递函数', control: '自动控制', spectrum: '频谱分析', pll: '数字 PLL' };
  var BASE_LESSONS = [
    {id:'fourier-amplitude',topic:'transforms',title:'把 C(3) = 3 + 4i 读回幅值与相位',prerequisites:[],goal:'沿用笔记的归一化与负指数约定，解释模长、相位以及实余弦的正负频率配对。',check:'不看答案，写出 |C(3)|、正频率对应余弦的峰值幅度与初相位，并说清为什么不能只取实部 3。',why:'这道独立作答在已整理记录里仍待确认，也能检验“傅里叶结果给出什么”的已讲解内容。',href:'notes-transforms.html#fourier-amplitude',experiment:'simulation.html?scenario=frequency',material:'已有完整笔记与自查答案；打开或读完页面不会自动完成打卡。'},
    {id:'fourier-overview',topic:'transforms',title:'傅里叶结果到底给出什么？',prerequisites:['fourier-amplitude'],goal:'把“比较一个目标频率”和“得到一组频率的复系数”区分开，同时保留幅值与相位。',check:'用自己的话回答：傅里叶是否只是找频率与幅值？再解释为什么一个非零系数不一定代表独立的物理振动源。',why:'这个问题已有讲解，并已接到 DFT 频点；现有记录仍没有确认你的独立回答。',href:'notes-transforms.html#fourier-dft',experiment:'simulation.html?scenario=frequency',material:'已有总体频谱认识、DFT 频点与幅度换算材料；先独立回答总体问题，再检查真实采样点数翻倍后的频点变化。'},
    {id:'kalman-14',topic:'kalman',title:'第 14 讲：为什么是 FPFᵀ + Q？',prerequisites:[],goal:'让压力、变化率以及两个误差之间的联系一起向前传播。第 14 讲已有完整讲解，先回顾误差传播，再独立核算本节例子。',check:'写出二状态 F，说明为什么 P 的左右都要乘矩阵，并区分二状态 Q 矩阵与一维 Q 数值。',why:'第 14 讲预测协方差已经讲解，尚无新增独立答对记录，先验证再接第 15 讲。',href:'notes-kalman.html#kalman-prediction',experiment:'simulation.html?scenario=motion&algorithm=cvkalman',material:'已有第 14 讲逐元素推导与完整预测算例；相关实验是位置 / 速度二状态类比，不代替压力模型的独立核算。'},
    {id:'filters-impulse',topic:'iir-fir',title:'用一拍输入分清 FIR 与 IIR',prerequisites:[],goal:'从冲激响应是否有限，理解两类滤波器，而不是只看代码有没有递推。',check:'解释 4 点平均为什么只影响 4 拍，而指数平滑的影响会逐步衰减；再说明递推求滑动和为什么仍能是 FIR。',why:'先分清结构，后面的系数设计才不会只剩“改 α 或窗口”。',href:'notes-iir-fir.html#filter-impulse',experiment:'simulation.html?scenario=pressure',material:'已有交互冲激示例与自查题；练习完成由你自行记录。'},
    {id:'filters-coefficients',topic:'iir-fir',title:'同样两个系数，为什么可以低通或高通？',prerequisites:['filters-impulse'],goal:'用 [0.5, 0.5] 和 [0.5, −0.5] 看清系数符号、频率类型和滤波结构的区别。',check:'对恒定输入与正负交替输入各算两次输出，解释为什么抽头数本身不能决定频率响应。',why:'这是从窗口直觉走向一般 FIR / IIR 系数的必要连接。',href:'notes-iir-fir.html#filter-coefficients',experiment:'simulation.html?scenario=frequency',material:'已有系数算例与频率类型对照。'},
    {id:'filters-specification',topic:'iir-fir',title:'从 10 Hz 目标算系数，再检查代价',prerequisites:['filters-coefficients'],goal:'把采样率、截止、50 Hz 衰减和响应延迟放在同一份指标里。',check:'在 1000 Hz 采样下比较 EMA 与 44 点平均；说清截止频率、首个零点和群延迟不是同一件事。',why:'设计必须回到具体指标，平滑并不自动意味着满足需求。',href:'notes-iir-fir.html#filter-ema',experiment:'simulation.html?scenario=frequency',material:'已有数值设计例与边界检查；完成后可继续看下方真实器件案例。'},
    {id:'sampling',topic:'transforms',title:'先确定采样率，再解释混叠',prerequisites:['fourier-overview'],goal:'把连续信号与采样点连接，理解不同模拟频率为何可能产生相同采样序列。',check:'说明采样率、最高输入频率与奈奎斯特频率的关系；再解释混叠为何发生、观察时长为何影响频率分辨能力。',why:'频谱分析依赖正确的采样与观察条件，数字滤波不能补回已经混叠的信息。',href:'knowledge.html?topic=spectrum',experiment:'simulation.html?scenario=frequency',material:'用频谱导读与仿真检查采样概念；这一步仍按待学处理。'},
    {id:'spectrum-axis',topic:'spectrum',title:'给 FFT 横轴和纵轴正确的单位',prerequisites:['sampling'],goal:'连接 k、采样率、样本数与实际 Hz，再区分库输出与单边幅度。',check:'若 fs = 1000 Hz、N = 1000，50 Hz 对应哪个 k？说明实信号普通正频率处何时使用 2|X[k]|/N，以及 DC 和 Nyquist 为何例外。',why:'先确定频率轴与归一化，才有依据判断一根谱线的幅度。',href:'future-learning.html#spectral-analysis',experiment:'simulation.html?scenario=frequency',material:'已有 50 Hz、3 kPa 的导读算例；不把导读阅读记为理解验证。'},
    {id:'spectrum-window',topic:'spectrum',title:'分清谱泄漏、窗函数与分辨率',prerequisites:['spectrum-axis'],goal:'理解有限观察时间导致的谱形变化，避免把旁瓣误认为新的真实信号。',check:'比较整周期与非整周期截取，再说明窗的幅值补偿、主瓣宽度和旁瓣水平分别影响什么。',why:'非零频点既受信号影响，也受观测窗口影响。',href:'future-learning.html#spectral-analysis',experiment:'simulation.html?scenario=frequency',material:'现有页面提供入门导读；可带着具体采样率、点数与窗函数继续提问。'},
    {id:'transfer-first-order',topic:'transfer',title:'从一阶 RC 接上传递函数',prerequisites:['fourier-overview'],goal:'把输入、输出、微分方程和 H(s) 连起来，明确零初始条件约定。',check:'用 RC 阶跃例子解释时间常数，再区分 H(s) 与取 s = jω 后的频率响应。',why:'从熟悉的一阶系统出发，更容易理解拉普拉斯表达式对应的实际变化。',href:'future-learning.html#transfer-functions',experiment:'simulation.html?scenario=pressure',material:'已有一阶 RC 导读与完整小算例；仿真用于观察一阶响应类比。'},
    {id:'transfer-z',topic:'transfer',title:'从每拍递推写出 H(z)',prerequisites:['transfer-first-order','filters-impulse'],goal:'用指数平滑的差分方程连接延迟 z⁻¹、极点与离散频率响应。',check:'从 y[n] = αx[n] + (1−α)y[n−1] 写出 H(z)，说明采样周期改变后为何不能直接沿用原来的 Hz 解释。',why:'先有连续系统和递推经验，再把 Z 变换当成描述同一系统的工具。',href:'knowledge.html?topic=transforms',experiment:'simulation.html?scenario=pressure&algorithm=ema',material:'这里属于后续连接，现有三大变换材料以路线预览为主。',outline:true},
    {id:'control-feedback',topic:'control',title:'闭环里，谁看、谁比、谁调？',prerequisites:['transfer-first-order'],goal:'用目标、测量、误差、控制器与对象画出负反馈关系。',check:'根据导读的比例控制例子解释：为什么增益提高可能更快，却不保证零稳态误差或更稳。',why:'传递函数有了含义，才能把方框图接成闭环计算。',href:'future-learning.html#control-feedback',experiment:'simulation.html?scenario=motion',material:'已有生活反馈图与控制导读；运动实验帮助观察响应变化。'},
    {id:'control-poles',topic:'control',title:'用二阶极点解释稳、准、快',prerequisites:['control-feedback'],goal:'把特征方程的根、阻尼与时域曲线对在一起。',check:'对 T(s) = 4/(s² + 2s + 4) 说出极点与阻尼含义，并解释为什么只看上升速度会漏掉超调。',why:'同一套参数需要同时看稳定、误差与动态表现。',href:'future-learning.html#control-second-order',experiment:'simulation.html?scenario=motion',material:'已有完整二阶算例与控制概念图，仍需要独立验证。'},
    {id:'pll-input',topic:'pll',title:'做 PLL 前，先确定你拿到了什么信号',prerequisites:['fourier-overview'],goal:'回顾已讨论的相位与频率关系，明确输入是单路还是正交 sin / cos 双路。',check:'画出输入通道，说明能否直接用 atan2、相位展开能解决什么，以及整周期丢失为什么不是简单展开就能恢复。',why:'PLL 已有初次概念讨论，但实际输入类型与实现练习尚未确认。',href:'knowledge.html?topic=pll',experiment:'simulation.html?scenario=frequency',material:'PLL 知识入口用于回顾与提问；频率实验只是观察输入的辅助，不是完整 PLL 仿真。'},
    {id:'pll-loop',topic:'pll',title:'把鉴相、PI 与 NCO 接成闭环',prerequisites:['pll-input','control-feedback'],goal:'解释误差信号怎样修正频率和相位，以及环路带宽的跟踪与噪声折中。',check:'沿信号方向讲一轮运算，并说明速度加快或加速度变大时，哪些输入条件与参数要先核实。',why:'确认输入和反馈意义之后，再讨论数字 PLL 的实现与调参。',href:'knowledge.html?topic=pll',experiment:'simulation.html?scenario=motion',material:'这是后续学习任务，现有仿真用于比较动态跟踪的直觉，不是已实现的 PLL。',outline:true},
    {id:'kalman-15',topic:'kalman',title:'第 15 讲：把状态和协方差一起更新',prerequisites:['kalman-14'],goal:'从同一个新息连接 H、K、两个状态修正与协方差更新。',check:'先标明每个矩阵维度与单位，再解释为什么增益要使用预测协方差。',why:'预测不确定性之后，需要把一次测量对两个状态的影响闭合起来。',href:'notes-kalman.html#kalman-next',experiment:'simulation.html?scenario=motion&algorithm=cvkalman',material:'现有页面只有后续安排，需通过提问入口继续讲解。相关实验是位置 / 速度二状态类比，不是压力模型的数值基准。',outline:true},
    {id:'kalman-16',topic:'kalman',title:'第 16 讲：独立算通二状态的一整轮',prerequisites:['kalman-15'],goal:'把状态预测、协方差预测、增益、状态更新与协方差更新连成可检查的数值过程。',check:'保存每一步的中间量，检查矩阵维度、单位、对称性以及缺测分支，再与实现输出逐项核对。',why:'在写完整代码之前，先拥有一个能手工核对的基准例子。',href:'notes-kalman.html#kalman-next',experiment:'simulation.html?scenario=motion&algorithm=cvkalman',material:'现有页面只有课程安排，需要另行讲解与独立练习。相关实验用于观察二状态跟踪，不能代替逐步核算。',outline:true}
  ];
  // BEGIN GENERATED LEARNING PROFILE
  var PROFILE = {
  "schemaVersion": 1,
  "version": "2026-10-19.1",
  "reviewedAt": "2026-10-19",
  "reviewLabel": "2026-10-19 · 北京时间",
  "evidenceNote": "依据已复核的学习对话整理。看过讲解、提出问题和观察到现象，都不等于独立答对；本页不读取私人聊天，也不自动判分。",
  "preferredPriority": [
    "filters-frequency-delay",
    "filters-design-families",
    "fourier-bin-check",
    "kalman-14",
    "fourier-amplitude",
    "fourier-overview",
    "filters-impulse",
    "filters-coefficients",
    "filters-specification",
    "sampling",
    "spectrum-axis",
    "spectrum-window",
    "transfer-first-order",
    "transfer-z",
    "control-feedback",
    "control-poles",
    "pll-input",
    "pll-loop",
    "kalman-15",
    "kalman-16"
  ],
  "lessonAdditions": [
    {
      "id": "filters-frequency-delay",
      "topic": "iir-fir",
      "title": "平均为什么会让正弦变小，甚至消失？",
      "prerequisites": [],
      "prerequisiteText": "会逐拍读采样点并求平均；先用四个数验证。",
      "goal": "用一次 4 点平均，把平滑、延迟与频率抵消连起来，再与 EMA 的渐衰权重对照。",
      "check": "取稳态重复输入 1、0、−1、0，算 4 点平均的连续两拍输出；解释为何会抵消、恒定输入为何保留，再说明加大窗口为何可能同时增大延迟、减小某些正弦的幅度。",
      "why": "最近已观察到平滑带来的滞后，下一步需要解释窗口如何改变幅度，以及何时会完全抵消。",
      "frontier": "已观察到平均窗口与 EMA 平滑强度影响滞后；幅度变化、抵消根因和 FIR / IIR 的适用判断仍待独立验证。",
      "href": "notes-iir-fir.html#filter-average",
      "experiment": "simulation.html?scenario=frequency",
      "material": "先用 4 点平均手算，再对照笔记中的频率零点与边界；EMA 对照只解释权重与取舍，不把曲线更平当作更正确。",
      "estimatedMinutes": "10–15 分钟"
    },
    {
      "id": "filters-design-families",
      "topic": "iir-fir",
      "title": "FIR / IIR 与巴特沃斯，分的是同一件事吗？",
      "prerequisites": [
        "filters-frequency-delay"
      ],
      "prerequisiteText": "先能解释平均导致的抵消与延迟，再区分结构和响应指标。",
      "goal": "把冲激响应分类、频率响应形状和设计方法放在不同层次，先理解巴特沃斯与切比雪夫的取舍。",
      "check": "分别说明 FIR / IIR 与巴特沃斯、切比雪夫描述什么；再举一个通带纹波、过渡带或延迟指标，说明为什么不能仅凭“适合正弦”选滤波器。",
      "why": "最新追问已经到结构和设计家族的关系；先补清抵消机制，再接这个概念连接。",
      "frontier": "已提出 FIR / IIR 与设计家族的关系问题；当前没有独立解释正确的记录。",
      "href": "knowledge.html?topic=filter-families",
      "experiment": "simulation.html?scenario=frequency",
      "material": "知识页含巴特沃斯与切比雪夫的设计比较；椭圆部分待继续讲解。相关实验辅助观察幅度与延迟，不是设计家族的系数设计器。",
      "estimatedMinutes": "10–15 分钟"
    },
    {
      "id": "fourier-bin-check",
      "topic": "transforms",
      "title": "多采一倍真实样本，3 Hz 还在 X[6] 吗？",
      "prerequisites": [],
      "prerequisiteText": "会使用 Δf = fs / N 与 k = f / Δf，并分清真实样本与补零。",
      "goal": "保持 fs = 12 Hz，把真实采样点从 24 增至 48，区分物理频率、频点编号与观察时长。",
      "check": "不看答案，算 N = 48 时的观察时长、Δf 和 3 Hz 所在 k；说明 X[6] 现在对应几 Hz，以及真实加采样为何不等于补零。",
      "why": "傅里叶讲解已推进到 DFT 频点；这道最近的 3 Hz 检查尚未收到独立回答。",
      "frontier": "已讲解频域整体认识、DFT 频点与 FFT；最新真实样本翻倍检查与较早的 C(3) = 3 + 4i 均待独立作答。",
      "href": "notes-transforms.html#fourier-dft-check",
      "experiment": "simulation.html?scenario=frequency",
      "material": "笔记有这道检查及自查答案；先独立计算，再展开答案。相关仿真用于观察频率，不代替本题手算。",
      "estimatedMinutes": "10–15 分钟"
    }
  ],
  "lessonOverrides": {
    "kalman-14": {
      "goal": "回看第 14 讲已讲过的二状态预测，用预测状态 [100.2, 20] 与协方差 [[4.02, 1], [1, 104]] 核对误差传播。",
      "check": "根据笔记给定的 F、P、Q，独立重算预测状态 [100.2, 20] 与 P⁻ = [[4.02, 1], [1, 104]]；解释交叉协方差从哪里来，以及为什么两侧都乘矩阵。",
      "frontier": "第 14 讲状态和协方差预测已有讲解；第 15 讲只是预告，仍需先独立核算第 14 讲。",
      "prerequisiteText": "回看本节给定的二状态 F、P、Q 和单位，再独立计算。",
      "estimatedMinutes": "10–15 分钟"
    },
    "fourier-amplitude": {
      "frontier": "复系数幅相已有讲解；C(3) = 3 + 4i 的独立幅相检查仍未确认。",
      "prerequisiteText": "先核对笔记的归一化和负指数约定，再做复数模长与相位计算。"
    }
  },
  "evidence": {
    "filters-frequency-delay": {
      "status": "pending",
      "observedAt": "2026-10-14",
      "summary": "已观察到加大窗口或加重 EMA 平滑会增加滞后；幅度是否变化、为何变平的解释仍待核对。"
    },
    "filters-design-families": {
      "status": "pending",
      "observedAt": "2026-10-14",
      "summary": "已提出 FIR / IIR 与巴特沃斯、切比雪夫、椭圆关系的疑问，尚无独立答对证据。"
    },
    "fourier-bin-check": {
      "status": "pending",
      "summary": "12 Hz 采样、真实点数从 24 增至 48 的 3 Hz 频点检查尚未独立作答。"
    },
    "fourier-amplitude": {
      "status": "pending",
      "summary": "较早的 C(3) = 3 + 4i 检查仍未独立作答，保留为并行回看任务。"
    },
    "fourier-overview": {
      "status": "explained",
      "summary": "傅里叶总体认识、复系数与 DFT 频点已有讲解；未据此推断掌握。"
    },
    "kalman-14": {
      "status": "explained",
      "summary": "第 14 讲已讲到预测状态和协方差数值例；独立复算仍待确认。"
    },
    "kalman-15": {
      "status": "pending",
      "summary": "测量更新目前是下一讲预告，不按已讲解或已掌握处理。"
    }
  },
  "topicSummaries": [
    {
      "topic": "iir-fir",
      "title": "IIR / FIR · 当前主线",
      "status": "pending",
      "frontier": "从看到滞后，走到解释抵消与幅度。",
      "summary": "最近已观察到窗口与平滑强度影响延迟；正弦幅度的变化、平滑到近乎直线的根因，以及设计家族的关系仍是开放问题。",
      "check": "下一次验证：4 点平均为何会抵消 1、0、−1、0？",
      "href": "notes-iir-fir.html#filter-boundaries"
    },
    {
      "topic": "transforms",
      "title": "傅里叶 · 并行检查",
      "status": "explained",
      "frontier": "已讲解 DFT 频点与 FFT；最新频点题待答。",
      "summary": "保持 12 Hz 采样、真实点数 24 → 48，3 Hz 的频点检查未回答。较早的 C(3) = 3 + 4i 也仍待独立验证。",
      "check": "下一次验证：观察时长、Δf 与 k 怎样一起变化？",
      "href": "notes-transforms.html#fourier-frontier"
    },
    {
      "topic": "kalman",
      "title": "卡尔曼 · 预测之后",
      "status": "explained",
      "frontier": "第 14 讲已讲解，第 15 讲为预告。",
      "summary": "已讲到预测状态 [100.2, 20] 与协方差 [[4.02, 1], [1, 104]]；尚无新增独立答对证据。",
      "check": "下一次验证：独立重算 FPFᵀ + Q，再接测量更新。",
      "href": "notes-kalman.html#kalman-frontier"
    }
  ],
  "latestLearningAt": "2026-10-14"
};
  // END GENERATED LEARNING PROFILE
  var EVIDENCE_LABELS = {'explained':'已讲解 · 待独立验证', 'independent-correct':'有独立答对证据', 'pending':'待独立作答'};
  var own = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };
  function record(value) { return !!value && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
  function safeTree(value, depth) {
    if (depth > 12) throw new Error('数据层级过深。');
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value) && !record(value)) throw new Error('数据必须是普通 JSON 对象。');
    Object.keys(value).forEach(function (key) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('数据中包含不安全的字段。');
      safeTree(value[key], depth + 1);
    });
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function freeze(value) { if(value && typeof value==='object'){Object.keys(value).forEach(function(key){freeze(value[key]);});Object.freeze(value);}return value; }
  function isTopic(topic) { return topic === 'auto' || own(TOPICS, topic); }
  function safeLink(value) { return typeof value === 'string' && /^[a-z0-9][a-z0-9-]*\.html(?:\?[A-Za-z0-9%._~=&+\-]*)?(?:#[A-Za-z0-9._~\-]+)?$/.test(value); }
  function dateOnly(value) { return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value; }
  function validTimestamp(value) {
    if(typeof value!=='string'||value.length>40)return false;
    var match=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
    return !!match && dateOnly(match[1]) && +match[2]<24 && +match[3]<60 && +match[4]<60 && Number.isFinite(Date.parse(value));
  }
  function requireText(object,key) { if(typeof object[key]!=='string'||!object[key].trim())throw new Error('学习资料缺少文字字段：'+key); }
  function validateProfile(input) {
    safeTree(input,0);
    if(!record(input)||input.schemaVersion!==1||!dateOnly(input.reviewedAt))throw new Error('学习资料版本或复核日期无效。');
    ['version','reviewLabel','evidenceNote'].forEach(function(key){requireText(input,key);});
    if(input.latestLearningAt!==undefined&&!dateOnly(input.latestLearningAt))throw new Error('最新学习日期无效。');
    if(!Array.isArray(input.preferredPriority)||!Array.isArray(input.lessonAdditions)||!record(input.lessonOverrides)||!record(input.evidence)||!Array.isArray(input.topicSummaries))throw new Error('学习资料结构不完整。');
    var profile=clone(input), lessons=BASE_LESSONS.map(clone), known=Object.create(null);
    lessons.forEach(function(lesson){known[lesson.id]=lesson;});
    profile.lessonAdditions.forEach(function(lesson){
      if(!record(lesson)||typeof lesson.id!=='string'||!/^[a-z][a-z0-9-]*$/.test(lesson.id)||['constructor','prototype','__proto__'].indexOf(lesson.id)>=0||own(known,lesson.id))throw new Error('新增步骤编号无效或重复。');
      var addition=clone(lesson);lessons.push(addition);known[addition.id]=addition;
    });
    var fields=['topic','title','prerequisites','goal','check','why','href','experiment','material','outline','frontier','prerequisiteText','estimatedMinutes'];
    Object.keys(profile.lessonOverrides).forEach(function(id){
      var override=profile.lessonOverrides[id];
      if(!own(known,id)||!record(override))throw new Error('覆盖项必须指向已有步骤。');
      Object.keys(override).forEach(function(key){if(fields.indexOf(key)<0)throw new Error('步骤覆盖字段无效：'+key);known[id][key]=override[key];});
    });
    lessons.forEach(function(lesson){
      if(!own(TOPICS,lesson.topic)||!Array.isArray(lesson.prerequisites))throw new Error('步骤主题或前置格式无效。');
      ['title','goal','check','why','material'].forEach(function(key){requireText(lesson,key);});
      ['frontier','prerequisiteText','estimatedMinutes'].forEach(function(key){if(lesson[key]!==undefined)requireText(lesson,key);});
      if(lesson.outline!==undefined&&typeof lesson.outline!=='boolean')throw new Error('提纲标记必须为布尔值。');
      if(!safeLink(lesson.href)||!safeLink(lesson.experiment))throw new Error('学习入口只允许本站相对 HTML 链接。');
      if(new Set(lesson.prerequisites).size!==lesson.prerequisites.length)throw new Error('前置步骤重复。');
      lesson.prerequisites.forEach(function(id){if(typeof id!=='string'||!own(known,id))throw new Error('前置步骤不存在。');});
    });
    function visit(id,stack,visited){if(stack.has(id))throw new Error('学习路线出现循环依赖。');if(visited.has(id))return;stack.add(id);known[id].prerequisites.forEach(function(pre){visit(pre,stack,visited);});stack.delete(id);visited.add(id);}
    var visited=new Set();lessons.forEach(function(lesson){visit(lesson.id,new Set(),visited);});
    if(new Set(profile.preferredPriority).size!==profile.preferredPriority.length)throw new Error('推荐顺序含重复步骤。');
    profile.preferredPriority.forEach(function(id){if(typeof id!=='string'||!own(known,id))throw new Error('推荐顺序引用未知步骤。');});
    Object.keys(profile.evidence).forEach(function(id){var item=profile.evidence[id];if(!own(known,id)||!record(item)||!own(EVIDENCE_LABELS,item.status))throw new Error('学习证据状态无效。');requireText(item,'summary');if(item.observedAt!==undefined&&!dateOnly(item.observedAt))throw new Error('证据日期无效。');});
    var topics=new Set();
    profile.topicSummaries.forEach(function(item){if(!record(item)||!own(TOPICS,item.topic)||topics.has(item.topic)||!own(EVIDENCE_LABELS,item.status)||!safeLink(item.href))throw new Error('主题摘要无效。');topics.add(item.topic);['title','frontier','summary','check'].forEach(function(key){requireText(item,key);});});
    return {profile:profile,lessons:lessons};
  }
  function createModel(profileInput) {
    var parsed=validateProfile(profileInput), profile=freeze(parsed.profile), LESSONS=clone(parsed.lessons), byId=Object.create(null);
    LESSONS.forEach(function(lesson,index){lesson.order=index+1;byId[lesson.id]=lesson;});
    freeze(LESSONS);
    var orderedIds=profile.preferredPriority.concat(LESSONS.map(function(lesson){return lesson.id;}).filter(function(id){return profile.preferredPriority.indexOf(id)<0;}));
    var orderedLessons=orderedIds.map(function(id){return byId[id];});
    function emptyState() { return {version:1,preferredTopic:'auto',completed:{}}; }
    function validateState(raw) {
      safeTree(raw,0);
      if(!record(raw)||raw.version!==1||!isTopic(raw.preferredTopic)||!record(raw.completed)||Object.keys(raw).some(function(key){return ['version','preferredTopic','completed'].indexOf(key)<0;}))throw new Error('备份格式不符：需要本站导出的 v1 学习记录。');
      var result=emptyState();result.preferredTopic=raw.preferredTopic;
      Object.keys(raw.completed).forEach(function(id){
        if(!own(byId,id))throw new Error('备份中有不属于当前路线的步骤，请核对文件版本。');
        if(!validTimestamp(raw.completed[id]))throw new Error('备份中的完成时间无效。');
        result.completed[id]=raw.completed[id];
      });
      return result;
    }
    function evidence(id) { return profile.evidence[id]||{status:'pending',summary:'尚无这一步的独立作答确认；材料存在或读过页面不代表完成。'}; }
    function verified(id) { return evidence(id).status==='independent-correct'; }
    function nextMissing(id,state,seen) {
      if(seen.has(id))throw new Error('学习路线出现循环依赖。');
      if(verified(id))return null;
      seen.add(id);
      var lesson=byId[id];
      for(var i=0;i<lesson.prerequisites.length;i++){var missing=nextMissing(lesson.prerequisites[i],state,new Set(seen));if(missing)return missing;}
      return own(state.completed,id)?null:lesson;
    }
    function select(state,topic) {
      var candidates=orderedLessons.filter(function(lesson){return topic==='auto'||lesson.topic===topic;});
      for(var i=0;i<candidates.length;i++){var next=nextMissing(candidates[i].id,state,new Set());if(next)return {lesson:next,target:candidates[i],isPrerequisite:next.id!==candidates[i].id,preferredTopic:topic};}
      return null;
    }
    function recommend(input,preference) {
      var state=validateState(input),topic=isTopic(preference)?preference:state.preferredTopic,result=select(state,topic);
      if(!result)return null;
      var lesson=result.lesson,history=evidence(lesson.id),summary=profile.topicSummaries.find(function(item){return item.topic===lesson.topic;});
      result.reason=result.isPrerequisite?'先补「'+lesson.title+'」，再进入「'+result.target.title+'」。':lesson.why;
      result.prerequisiteText=lesson.prerequisiteText||(lesson.prerequisites.length?'必要前置：'+lesson.prerequisites.map(function(id){return byId[id].title;}).join('；')+'。':'本节可直接开始；先按材料给出的条件独立做一次检查。');
      result.frontier=lesson.frontier||(summary?summary.frontier:history.summary);
      result.verificationQuestion=lesson.check;
      result.evidenceStatus=history.status;
      result.evidenceLabel=EVIDENCE_LABELS[history.status];
      result.evidenceSummary=history.summary;
      result.estimatedMinutes=lesson.estimatedMinutes||'10–15 分钟';
      result.reviewedAt=profile.reviewedAt;
      var after=clone(state);after.completed[lesson.id]='2000-01-01T00:00:00.000Z';var next=select(after,topic);
      result.afterCheck=next?'独立回答后再自报完成，接着看：'+next.lesson.title+'。':'独立回答后再自报完成；这段清单结束后可切换方向或换一道题复查。';
      return result;
    }
    function prerequisitesDone(lesson,input) {var state=validateState(input),item=lesson&&byId[lesson.id];return !!item&&item.prerequisites.every(function(id){return !nextMissing(id,state,new Set());});}
    var API={key:KEY,topics:freeze(TOPICS),lessons:LESSONS,profile:profile,orderedLessons:freeze(orderedLessons),evidenceLabels:freeze(EVIDENCE_LABELS),emptyState:emptyState,validateState:validateState,recommend:recommend,prerequisitesDone:prerequisitesDone,createModel:createModel,validateProfile:validateProfile,safeLink:safeLink,getEvidence:function(id){return own(byId,id)?clone(evidence(id)):null;}};
  API.init = function (win) {
    var doc=win.document, state=emptyState(), storageOK=true, startupNote='', initialized=false;
    try { var saved=win.localStorage.getItem(KEY); if(saved) state=validateState(JSON.parse(saved)); }
    catch(error) { storageOK=false; startupNote='原有本机记录无法读取。当前先用空白记录；可以尝试导入备份。'; }
    var queryTopic=new URLSearchParams(win.location.search).get('topic');
    if (/next-learning\.html$/.test(win.location.pathname) && isTopic(queryTopic)) state.preferredTopic=queryTopic;
    var page=doc.getElementById('nl-lesson-list');
    var liveRecommendation=null, lastCompletionClick=0, importSequence=0;
    function copyState() { return validateState(JSON.parse(JSON.stringify(state))); }
    function notify() { doc.dispatchEvent(new win.CustomEvent('river:progress',{detail:{state:copyState()}})); }
    function save() {
      importSequence++;
      try { win.localStorage.setItem(KEY,JSON.stringify(state)); storageOK=true; }
      catch(error) { storageOK=false; }
      notify();
    }
    function put(id,value) { var el=doc.getElementById(id); if(el) el.textContent=value; }
    function link(id,href,label) { var el=doc.getElementById(id); if(el){el.href=href;if(label)el.textContent=label;} }
    function el(tag,className,text) { var node=doc.createElement(tag); if(className)node.className=className; if(text!==undefined)node.textContent=text; return node; }
    function render(message) {
      if(!page) return;
      liveRecommendation=recommend(state);
      var total=Object.keys(state.completed).length;
      doc.getElementById('nl-topic-select').value=state.preferredTopic;
      put('nl-progress-count',total+' / '+LESSONS.length+' 步已自报完成');
      put('nl-storage-note',storageOK?'只保存在此浏览器。更换设备、清理网站数据或使用隐私窗口可能丢失；不会同步 ChatGPT 私人对话。':'当前无法写入本机存储，打卡只保留在本次页面内。请导出备份，离开后可能丢失。');
      var complete=doc.getElementById('nl-complete'), ask=doc.getElementById('nl-ask');
      if(liveRecommendation) {
        var lesson=liveRecommendation.lesson;
        doc.body.dataset.learningTopic=lesson.topic;
        put('nl-topic-label',TOPICS[lesson.topic]); put('nl-recommend-label',liveRecommendation.isPrerequisite?'先补一个前置':'当前推荐');
        put('nl-lesson-title',lesson.title); put('nl-goal',lesson.goal); put('nl-check-text',lesson.check);
        put('nl-why','为什么先学它：'+liveRecommendation.reason);
        put('nl-material-note',lesson.material);
        put('nl-frontier',liveRecommendation.frontier);put('nl-prerequisite',liveRecommendation.prerequisiteText);
        put('nl-evidence-status',liveRecommendation.evidenceLabel);put('nl-after-check',liveRecommendation.afterCheck);
        put('nl-lesson-meta',liveRecommendation.estimatedMinutes+' · 一次独立检查');
        link('nl-read-link',lesson.href,lesson.outline?'查看下一讲提纲':'打开本节材料');
        link('nl-experiment-link',lesson.experiment,lesson.topic==='pll'?'打开辅助实验':'打开相关实验');
        complete.disabled=false; complete.hidden=false;
        ask.dataset.askQuestion='我现在想学习「'+lesson.title+'」。目标：'+lesson.goal+' 请先检查前置理解，再一步一步讲解，最后让我独立回答：'+lesson.check+' 不要直接把我看过的内容当成已经掌握。'; ask.hidden=false;
      } else {
        put('nl-topic-label',state.preferredTopic==='auto'?'本段路线已覆盖':TOPICS[state.preferredTopic]); put('nl-recommend-label','可以回看或换方向');
        put('nl-lesson-title','这一段暂无待完成步骤'); put('nl-goal','这份有限清单已由本机自报或已有独立答对证据覆盖，不表示全部知识已经掌握。');
        put('nl-check-text','换一个未见过的输入或参数，独立解释结果。发现仍不清楚的地方，可以撤回对应打卡。');
        put('nl-why','当前没有下一条未完成任务。可以切换优先方向，或返回知识库继续复习。');
        put('nl-material-note','系统不会无限生成新任务，也不会据此修改历史学习记录。');
        put('nl-frontier','当前方向的有限清单已满足；历史证据和本机自报仍分别保留。');
        put('nl-prerequisite','可以撤回本机打卡，或选择另一个方向继续。');
        put('nl-evidence-status','本机自报与历史证据分开');put('nl-after-check','换一道题验证迁移，发现疑问时再回看。');put('nl-lesson-meta','复习与迁移');
        link('nl-read-link','knowledge.html','返回知识库');link('nl-experiment-link','simulation.html','进入仿真实验');complete.disabled=true;complete.hidden=true;ask.hidden=true;
      }
      page.replaceChildren();
      var visible=orderedLessons.filter(function(lesson){return state.preferredTopic==='auto'||lesson.topic===state.preferredTopic;});
      if(liveRecommendation&&liveRecommendation.isPrerequisite&&!visible.some(function(item){return item.id===liveRecommendation.lesson.id;}))visible.unshift(liveRecommendation.lesson);
      visible.forEach(function(lesson){
        var done=own(state.completed,lesson.id), confirmed=verified(lesson.id), ready=prerequisitesDone(lesson,state),current=!!liveRecommendation&&liveRecommendation.lesson.id===lesson.id;
        var row=el('div','nl-lesson-row');row.dataset.complete=String(done);row.dataset.evidence=evidence(lesson.id).status;row.dataset.current=String(current);
        row.appendChild(el('span','nl-row-index',done?'已自报完成':confirmed?'已独立答对':current?'现在这一步':evidence(lesson.id).status==='explained'?'已讲解 · 待验证':'待独立作答'));
        var content=el('div','nl-row-content');content.appendChild(el('span','nl-row-topic',TOPICS[lesson.topic]));
        var anchor=el('a','nl-row-title',lesson.title);anchor.href=lesson.href;content.appendChild(anchor);
        var detail=done?'本机记录 · '+new Date(state.completed[lesson.id]).toLocaleDateString('zh-CN'):confirmed?'历史证据 · 已独立答对；没有写入本机打卡':lesson.outline?'已有提纲，需要继续讲解与练习':evidence(lesson.id).summary;
        if(!ready&&!confirmed)detail+=(done?' · 前置已撤回或未打卡':' · 先完成必要前置');
        content.appendChild(el('span','nl-row-detail',detail));row.appendChild(content);
        var toggle=el('button','',done?'撤回':'标记完成');toggle.type='button';toggle.disabled=!done&&(!ready||confirmed);if(confirmed&&!done)toggle.textContent='已有验证证据';toggle.setAttribute('aria-label',(done?'撤回':'自报完成')+'：'+lesson.title);
        toggle.addEventListener('click',function(){setCompleted(lesson.id,!done);var active=page.querySelector('[data-current="true"] a');if(active)active.focus();else doc.getElementById('nl-topic-select').focus();});row.appendChild(toggle);page.appendChild(row);
      });
      if(message)put('nl-status',message);
    }
    function setCompleted(id,done) {
      if(!own(byId,id))return false;
      if(done&&verified(id))return false;
      if(done&&own(state.completed,id))return true;
      if(done&&!prerequisitesDone(byId[id],state))return false;
      if(!done&&!own(state.completed,id))return true;
      if(done)state.completed[id]=new Date().toISOString();else delete state.completed[id];
      save();render((done?'已记录为自报完成：':'已撤回：')+byId[id].title+'。'+(storageOK?'':'当前未能保存到本机，请导出备份。'));return true;
    }
    API.getState=copyState; API.getRecommendation=function(){return recommend(state);};API.setCompleted=setCompleted;
    API.getCurrentTopic=function(){return page&&liveRecommendation?liveRecommendation.lesson.topic:state.preferredTopic;};
    if(!page)return;
    ['nl-complete','nl-topic-select','nl-export','nl-import','nl-reset'].forEach(function(id){doc.getElementById(id).disabled=false;});
    doc.getElementById('nl-complete').addEventListener('click',function(event){var now=Date.now();if(event.detail>1||now-lastCompletionClick<450)return;lastCompletionClick=now;if(liveRecommendation)setCompleted(liveRecommendation.lesson.id,true);if(!liveRecommendation)doc.getElementById('nl-topic-select').focus();});
    doc.getElementById('nl-topic-select').addEventListener('change',function(event){if(isTopic(event.target.value)){state.preferredTopic=event.target.value;save();render('已优先安排：'+(state.preferredTopic==='auto'?'当前学习缺口':TOPICS[state.preferredTopic])+'。');}});
    doc.getElementById('nl-export').addEventListener('click',function(){
      try {var blob=new win.Blob([JSON.stringify(state,null,2)],{type:'application/json'});var url=win.URL.createObjectURL(blob),a=doc.createElement('a');a.href=url;a.download='river-learning-progress-'+new Date().toISOString().slice(0,10)+'.json';doc.body.appendChild(a);a.click();a.remove();win.setTimeout(function(){win.URL.revokeObjectURL(url);},1000);put('nl-data-status','已准备备份下载。文件只包含你的本机打卡。');}
      catch(error){put('nl-data-status','当前浏览器无法下载备份，请换用支持文件下载的浏览器。');}
    });
    doc.getElementById('nl-import').addEventListener('change',async function(event){
      var input=event.target,file=input.files&&input.files[0], ticket=++importSequence;if(!file)return;
      try {
        if(file.size>65536)throw new Error('文件超过 64 KB，不像本站的进度备份。');
        var contents=await file.text();
        if(ticket!==importSequence)return;
        var imported=validateState(JSON.parse(contents));
        Object.keys(imported.completed).forEach(function(id){if(!state.completed[id]||Date.parse(imported.completed[id])>Date.parse(state.completed[id]))state.completed[id]=imported.completed[id];});
        state.preferredTopic=imported.preferredTopic;save();render('已合并导入的本机打卡。历史学习证据未改变。');put('nl-data-status',storageOK?'导入成功。完成项已合并，优先方向已采用备份设置。':'已导入，但本机存储不可用；请保留备份。');
      }catch(error){put('nl-data-status',error instanceof SyntaxError?'无法读取 JSON，请选择本站导出的备份。':error.message||'导入失败，原有记录未改变。');}
      finally{input.value='';}
    });
    doc.getElementById('nl-reset').addEventListener('click',function(){if(!win.confirm('清空此浏览器的全部学习打卡和方向选择？历史讲解记录不会改变。需要保留时请先导出备份。'))return;state=emptyState();save();render('本机打卡已清空，回到当前整理记录的推荐。');put('nl-data-status','已清空本机打卡。');});
    win.addEventListener('storage',function(event){if(event.key!==KEY&&event.key!==null)return;if(event.storageArea&&event.storageArea!==win.localStorage)return;try{var incoming=event.newValue?validateState(JSON.parse(event.newValue)):emptyState();state=incoming;importSequence++;storageOK=true;render('已读取此浏览器另一标签页更新的打卡。');notify();}catch(error){put('nl-status','另一标签页的记录无法读取，当前显示保持不变。');}});
    if(!initialized){initialized=true;render(startupNote);}
  };
    return API;
  }
  return createModel(PROFILE);
}));
