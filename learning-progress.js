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
  var LESSONS = [
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
  var byId = Object.create(null);
  LESSONS.forEach(function (lesson, index) { lesson.order = index + 1; byId[lesson.id] = lesson; });
  function emptyState() { return {version:1, preferredTopic:'auto', completed:{}}; }
  function isTopic(topic) { return topic === 'auto' || Object.prototype.hasOwnProperty.call(TOPICS, topic); }
  function validateState(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1 || !isTopic(raw.preferredTopic) || !raw.completed || typeof raw.completed !== 'object' || Array.isArray(raw.completed)) throw new Error('备份格式不符：需要本站导出的 v1 学习记录。');
    var result = emptyState(); result.preferredTopic = raw.preferredTopic;
    Object.keys(raw.completed).forEach(function (id) {
      if (!Object.prototype.hasOwnProperty.call(byId, id)) throw new Error('备份中有不属于当前路线的步骤，请核对文件版本。');
      var value = raw.completed[id];
      if (typeof value !== 'string' || value.length > 40 || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('备份中的完成时间无效。');
      result.completed[id] = value;
    });
    return result;
  }
  function nextMissing(id, state, seen) {
    if (seen.has(id)) throw new Error('学习路线出现循环依赖。');
    seen.add(id);
    var lesson = byId[id];
    for (var i=0; i<lesson.prerequisites.length; i++) {
      var missing = nextMissing(lesson.prerequisites[i], state, new Set(seen));
      if (missing) return missing;
    }
    return state.completed[id] ? null : lesson;
  }
  function recommend(state, preference) {
    var topic = isTopic(preference) ? preference : state.preferredTopic;
    var candidates = LESSONS.filter(function (lesson) { return topic === 'auto' || lesson.topic === topic; });
    for (var i=0; i<candidates.length; i++) {
      var next = nextMissing(candidates[i].id,state,new Set());
      if (next) return {lesson:next,target:candidates[i],isPrerequisite:next.id !== candidates[i].id,preferredTopic:topic};
    }
    return null;
  }
  function prerequisitesDone(lesson, state) { return lesson.prerequisites.every(function (id) { return !nextMissing(id,state,new Set()); }); }
  var API = {key:KEY,topics:TOPICS,lessons:LESSONS,emptyState:emptyState,validateState:validateState,recommend:recommend,prerequisitesDone:prerequisitesDone};
  API.init = function (win) {
    var doc=win.document, state=emptyState(), storageOK=true, startupNote='', initialized=false;
    try { var saved=win.localStorage.getItem(KEY); if(saved) state=validateState(JSON.parse(saved)); }
    catch(error) { storageOK=false; startupNote='原有本机记录无法读取。当前先用空白记录；可以尝试导入备份。'; }
    var queryTopic=new URLSearchParams(win.location.search).get('topic');
    if (/next-learning\.html$/.test(win.location.pathname) && isTopic(queryTopic)) state.preferredTopic=queryTopic;
    var page=doc.getElementById('nl-lesson-list');
    var liveRecommendation=null, lastCompletionClick=0;
    function copyState() { return validateState(JSON.parse(JSON.stringify(state))); }
    function notify() { doc.dispatchEvent(new win.CustomEvent('river:progress',{detail:{state:copyState()}})); }
    function save() {
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
        put('nl-why',liveRecommendation.isPrerequisite?'你想继续「'+TOPICS[liveRecommendation.target.topic]+'」，先补「'+lesson.title+'」，再进入「'+liveRecommendation.target.title+'」。':'为什么先学它：'+lesson.why);
        put('nl-material-note',lesson.material);
        link('nl-read-link',lesson.href,lesson.outline?'查看下一讲提纲':'打开本节材料');
        link('nl-experiment-link',lesson.experiment,lesson.topic==='pll'?'打开辅助实验':'打开相关实验');
        complete.disabled=false; complete.hidden=false;
        ask.dataset.askQuestion='我现在想学习「'+lesson.title+'」。目标：'+lesson.goal+' 请先检查前置理解，再一步一步讲解，最后让我独立回答：'+lesson.check+' 不要直接把我看过的内容当成已经掌握。'; ask.hidden=false;
      } else {
        put('nl-topic-label',state.preferredTopic==='auto'?'本段路线已打卡':TOPICS[state.preferredTopic]); put('nl-recommend-label','可以回看或换方向');
        put('nl-lesson-title','这一段已全部自报完成'); put('nl-goal','这表示你完成了这份有限清单的打卡，不表示全部知识已经掌握。');
        put('nl-check-text','换一个未见过的输入或参数，独立解释结果。发现仍不清楚的地方，可以撤回对应打卡。');
        put('nl-why','当前没有下一条未完成任务。可以切换优先方向，或返回知识库继续复习。');
        put('nl-material-note','系统不会无限生成新任务，也不会据此修改历史学习记录。');
        link('nl-read-link','knowledge.html','返回知识库');link('nl-experiment-link','simulation.html','进入仿真实验');complete.disabled=true;complete.hidden=true;ask.hidden=true;
      }
      page.replaceChildren();
      var visible=LESSONS.filter(function(lesson){return state.preferredTopic==='auto'||lesson.topic===state.preferredTopic;});
      if(liveRecommendation&&liveRecommendation.isPrerequisite&&!visible.some(function(item){return item.id===liveRecommendation.lesson.id;}))visible.unshift(liveRecommendation.lesson);
      visible.forEach(function(lesson){
        var done=!!state.completed[lesson.id], ready=prerequisitesDone(lesson,state),current=!!liveRecommendation&&liveRecommendation.lesson.id===lesson.id;
        var row=el('div','nl-lesson-row');row.dataset.complete=String(done);row.dataset.current=String(current);
        row.appendChild(el('span','nl-row-index',done?'已自报完成':current?'现在这一步':'待学习'));
        var content=el('div','nl-row-content');content.appendChild(el('span','nl-row-topic',TOPICS[lesson.topic]));
        var anchor=el('a','nl-row-title',lesson.title);anchor.href=lesson.href;content.appendChild(anchor);
        var detail=done?'本机记录 · '+new Date(state.completed[lesson.id]).toLocaleDateString('zh-CN'):lesson.outline?'已有提纲，需要继续讲解与练习':'材料可回看，尚未完成本机打卡';
        if(!ready)detail+=(done?' · 前置已撤回或未打卡':' · 先完成必要前置');
        content.appendChild(el('span','nl-row-detail',detail));row.appendChild(content);
        var toggle=el('button','',done?'撤回':'标记完成');toggle.type='button';toggle.disabled=!done&&!ready;toggle.setAttribute('aria-label',(done?'撤回':'自报完成')+'：'+lesson.title);
        toggle.addEventListener('click',function(){setCompleted(lesson.id,!done);var active=page.querySelector('[data-current="true"] a');if(active)active.focus();else doc.getElementById('nl-topic-select').focus();});row.appendChild(toggle);page.appendChild(row);
      });
      if(message)put('nl-status',message);
    }
    function setCompleted(id,done) {
      if(!byId[id])return false;
      if(done&&!prerequisitesDone(byId[id],state))return false;
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
      var input=event.target,file=input.files&&input.files[0];if(!file)return;
      try {
        if(file.size>65536)throw new Error('文件超过 64 KB，不像本站的进度备份。');
        var imported=validateState(JSON.parse(await file.text()));
        Object.keys(imported.completed).forEach(function(id){if(!state.completed[id]||Date.parse(imported.completed[id])>Date.parse(state.completed[id]))state.completed[id]=imported.completed[id];});
        state.preferredTopic=imported.preferredTopic;save();render('已合并导入的本机打卡。历史学习证据未改变。');put('nl-data-status',storageOK?'导入成功。完成项已合并，优先方向已采用备份设置。':'已导入，但本机存储不可用；请保留备份。');
      }catch(error){put('nl-data-status',error instanceof SyntaxError?'无法读取 JSON，请选择本站导出的备份。':error.message||'导入失败，原有记录未改变。');}
      finally{input.value='';}
    });
    doc.getElementById('nl-reset').addEventListener('click',function(){if(!win.confirm('清空此浏览器的全部学习打卡和方向选择？历史讲解记录不会改变。需要保留时请先导出备份。'))return;state=emptyState();save();render('本机打卡已清空，回到历史起点推荐。');put('nl-data-status','已清空本机打卡。');});
    win.addEventListener('storage',function(event){if(event.key!==KEY&&event.key!==null)return;try{state=event.newValue?validateState(JSON.parse(event.newValue)):emptyState();storageOK=true;render('已读取此浏览器另一标签页更新的打卡。');notify();}catch(error){put('nl-status','另一标签页的记录无法读取，当前显示保持不变。');}});
    if(!initialized){initialized=true;render(startupNote);}
  };
  return API;
}));
