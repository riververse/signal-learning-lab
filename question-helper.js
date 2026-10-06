/* A local question composer, not a chatbot. It sends nothing and stores no question. */
(function (root,factory) {
  'use strict';var core=factory();
  if(typeof module==='object'&&module.exports)module.exports=core;
  if(!root||!root.document||root.RiverQuestion)return;
  try{if(root.self!==root.top)return;}catch(error){return;}
  root.RiverQuestion=core;
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',function(){core.init(root);});else core.init(root);
}(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var TOPICS={transforms:'三大变换','iir-fir':'IIR / FIR',kalman:'卡尔曼滤波',control:'自动控制',transfer:'传递函数',pll:'数字 PLL',spectrum:'频谱分析'};
  var GLOSSARY=[
    {topic:'transforms',keys:['傅里叶','fourier','c(3)','幅值','相位','实部','虚部'],title:'幅值与相位要带着约定看',text:'复系数同时保留两路比较的结果。系数模长怎样换算为实余弦峰值幅度，取决于归一化、正负频率配对，以及 DC / Nyquist 等边界；不要把实部直接当作幅度。',href:'notes-transforms.html#fourier-amplitude'},
    {topic:'iir-fir',keys:['fir','iir','系数','低通','高通','带通','窗口','滤波'],title:'先分清“响应类型”和“实现结构”',text:'低通、高通、带通描述哪些频率被保留；FIR / IIR 描述冲激响应是否在有限步后结束。递推代码不必然是 IIR，系数也不只是 α 或窗口长度。',href:'notes-iir-fir.html#filter-coefficients'},
    {topic:'kalman',keys:['卡尔曼','kalman','协方差','增益','残差','新息','方差'],title:'残差大小和增益不是同一个量',text:'当前线性模型的增益由预测不确定性和测量不确定性决定。新息是测量与预测的差；读数跳变可以增大修正量，但不会直接改写这一轮的增益公式。',href:'notes-kalman.html#kalman-next'},
    {topic:'spectrum',keys:['fft','dft','频谱','采样','混叠','泄漏','窗函数'],title:'先把采样条件说完整',text:'频率轴需要采样率 fs 和样本数 N：fk = kfs/N。有限观察长度、窗函数和幅值归一化都会影响读谱；非零频点不自动证明存在独立的物理振动源。',href:'future-learning.html#spectral-analysis'},
    {topic:'transfer',keys:['传递函数','拉普拉斯','z变换','z 变换','极点','零点','h(s)','h(z)'],title:'先说明连续还是离散、初始条件是什么',text:'传递函数把输入与输出的关系放进变换域。读公式时先确认系统假设、零初始条件与时间尺度，再把极点和实际响应联系起来。',href:'future-learning.html#transfer-functions'},
    {topic:'control',keys:['控制','闭环','反馈','pid','超调','稳态','阻尼'],title:'稳、准、快需要分别检查',text:'反馈把测量和目标比较，再通过控制器影响对象。增益变大不保证所有指标都更好；需要一起观察稳定性、稳态误差、响应时间和超调。',href:'future-learning.html#automatic-control'},
    {topic:'pll',keys:['pll','锁相','nco','鉴相','正交','atan2','相位展开'],title:'先确认单路还是正交双路输入',text:'数字 PLL 用相位误差调整内部参考。真实输入类型会改变鉴相方式；环路带宽影响噪声与动态跟踪的折中，相位展开也不能保证恢复已丢失的整周期。',href:'knowledge.html?topic=pll'}
  ];
  function validTopic(value){return Object.prototype.hasOwnProperty.call(TOPICS,value);}
  function inferTopic(path,search,hash,explicit){
    var query=new URLSearchParams(search||''),chosen=query.get('topic');if(validTopic(chosen))return chosen;
    if(validTopic(explicit))return explicit;
    var file=(path||'').split('/').pop();
    if(/kalman/.test(file))return 'kalman';if(/transforms/.test(file))return 'transforms';if(/iir-fir|frequency|pressure|engineering/.test(file))return 'iir-fir';if(/motion/.test(file))return 'control';
    if(file==='simulation.html'){var scenario=query.get('scenario');return scenario==='motion'?'control':scenario==='frequency'?'spectrum':'iir-fir';}
    if(/control|automatic/.test(hash||''))return 'control';if(/spectral|spectrum/.test(hash||''))return 'spectrum';if(/transfer/.test(hash||''))return 'transfer';
    return '';
  }
  function findGlossary(question,topic){
    var text=String(question||'').toLowerCase();var best=null,bestScore=0;
    GLOSSARY.forEach(function(item){var score=item.keys.reduce(function(sum,key){return sum+(text.includes(key)?key.length:0);},0);if(score>bestScore){best=item;bestScore=score;}});
    return best||GLOSSARY.find(function(item){return item.topic===topic;})||null;
  }
  function composePrompt(context,question,mode,selection){
    var modes={explain:'请用直观例子讲清，再逐步连接到公式。',check:'请先让我独立作答，再逐步检查推理；不要先给出完整答案。',apply:'请用一个具体工程例子，说明用途、输入条件、参数和限制。'};
    var result=['我在 RIVER 信号实验室学习。','当前主题：'+(TOPICS[context.topic]||'信号处理')+'。','当前页面：'+context.page+'。'];
    if(context.section)result.push('正在看的小节：'+context.section+'。');
    if(context.lesson)result.push('这次的学习目标：'+context.lesson+'。');
    if(selection)result.push('我选中的内容：'+selection);
    result.push('我的问题：'+(String(question||'').trim()||'请先问一个简短问题，确认我卡在哪里。'));
    result.push(modes[mode]||modes.explain);
    result.push('请明确公式约定、单位和适用边界，一次只推进一个关键连接。不把看过资料或网站打卡当成已经掌握；如缺采样率、通道类型等条件，先向我确认。');
    return result.join('\n\n');
  }
  var API={inferTopic:inferTopic,findGlossary:findGlossary,composePrompt:composePrompt};
  API.init=function(win){
    var doc=win.document;if(doc.getElementById('qh-dialog'))return;
    var host=doc.createElement('div');host.className='qh-host';
    host.innerHTML='<button class="qh-launcher" id="qh-launcher" type="button" aria-haspopup="dialog" aria-controls="qh-dialog" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-5 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M9.8 8a2.3 2.3 0 1 1 3.5 2c-.9.5-1.3 1-1.3 2M12 14.7v.2"/></svg><span>随时提问</span></button><dialog class="qh-dialog" id="qh-dialog" aria-labelledby="qh-title" aria-describedby="qh-description"><div class="qh-head"><div><p class="qh-eyebrow">本地提问准备器</p><h2 id="qh-title">把卡住的地方说清楚</h2></div><button type="button" class="qh-close" aria-label="关闭提问窗口">×</button></div><div class="qh-body"><p class="qh-description" id="qh-description">这里不是站内 AI。它只整理问题、提供固定知识提示；不会读取私人聊天，也不会自动发送或保存你的问题。</p><p class="qh-context" id="qh-context"></p><label class="qh-label" for="qh-question">你想问什么？</label><textarea id="qh-question" class="qh-question" rows="3" maxlength="3000" placeholder="例如：C(3) = 3 + 4i，为什么幅值不直接取 3？"></textarea><label class="qh-selection-label" id="qh-selection-label" hidden><input type="checkbox" id="qh-include-selection">把刚才选中的文字带上（最多 300 字）</label><label class="qh-label" for="qh-mode">这次怎样帮我</label><select id="qh-mode"><option value="explain">先解释概念，再连接公式</option><option value="check">检查我的理解，不先给答案</option><option value="apply">联系实际工程与应用边界</option></select><section class="qh-hint" id="qh-hint" aria-labelledby="qh-hint-title"><span class="qh-hint-label">固定知识提示 · 按关键词匹配</span><h3 id="qh-hint-title"></h3><p id="qh-hint-text"></p><a id="qh-hint-link" href="knowledge.html">回到对应知识</a></section><details class="qh-preview"><summary>查看将要复制的完整问题</summary><label class="qh-label" for="qh-prompt">可以检查后再复制</label><textarea id="qh-prompt" rows="9" readonly></textarea></details><div class="qh-actions"><button type="button" class="qh-copy">复制完整问题</button><a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" class="qh-open">打开 ChatGPT ↗</a></div><p class="qh-next">先复制，再打开 ChatGPT 粘贴。问题不会自动带过去，是否发送由你决定。</p><p class="qh-status" role="status" aria-live="polite"></p></div></dialog>';
    doc.body.appendChild(host);
    var launcher=host.querySelector('.qh-launcher'),dialog=host.querySelector('dialog'),question=host.querySelector('#qh-question'),mode=host.querySelector('#qh-mode'),prompt=host.querySelector('#qh-prompt'),status=host.querySelector('.qh-status'),selectionToggle=host.querySelector('#qh-include-selection');
    var opened=false,opener=null,selection='',context={},previousOverflow='',fallbackInert=[];
    function getContext(override){
      var data=doc.body.dataset.learningTopic||'';
      if(/next-learning\.html$/.test(win.location.pathname)&&win.RiverLearning&&win.RiverLearning.getCurrentTopic)data=win.RiverLearning.getCurrentTopic();
      var topic=inferTopic(win.location.pathname,win.location.search,win.location.hash,data);
      if(/next-learning\.html$/.test(win.location.pathname)&&validTopic(data))topic=data;
      if(override&&validTopic(override.topic))topic=override.topic;
      function visible(node){return !node.closest('[hidden]')&&node.getClientRects().length>0;}
      var heading=Array.from(doc.querySelectorAll('main h1,h1')).find(visible);
      var sections=Array.from(doc.querySelectorAll('main h2,main h3')).filter(function(node){return !host.contains(node)&&visible(node)&&node.getBoundingClientRect().top<=win.innerHeight*.55;});
      var section=sections.length?sections[sections.length-1].textContent.trim():'';
      var recommendation=/next-learning\.html$/.test(win.location.pathname)&&win.RiverLearning&&win.RiverLearning.getRecommendation?win.RiverLearning.getRecommendation():null;
      return {topic:topic,page:heading?heading.textContent.trim():doc.title,section:section,lesson:recommendation?recommendation.lesson.title:''};
    }
    function update(){
      prompt.value=composePrompt(context,question.value,mode.value,selectionToggle.checked?selection:'');
      var hint=findGlossary(question.value,context.topic);var hintBox=host.querySelector('#qh-hint');hintBox.hidden=!hint;
      if(hint){host.querySelector('#qh-hint-title').textContent=hint.title;host.querySelector('#qh-hint-text').textContent=hint.text;host.querySelector('#qh-hint-link').href=hint.href;}
    }
    function closeCleanup(){
      if(!opened)return;opened=false;doc.body.style.overflow=previousOverflow;launcher.setAttribute('aria-expanded','false');
      fallbackInert.forEach(function(item){item.node.inert=item.was;});fallbackInert=[];
      if(opener&&opener.isConnected)opener.focus();else launcher.focus();
    }
    function close(){if(!opened)return;if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');closeCleanup();}
    function open(options){
      options=options||{};
      if(opened){if(options.question){question.value=String(options.question).slice(0,3000);update();}question.focus();return;}
      opener=doc.activeElement;selection=String(win.getSelection?win.getSelection():'').trim().slice(0,300);context=getContext(options);
      selectionToggle.checked=false;host.querySelector('#qh-selection-label').hidden=!selection;
      if(options.question)question.value=String(options.question).slice(0,3000);
      host.querySelector('#qh-context').textContent=(TOPICS[context.topic]||'信号处理')+' · '+(context.section||context.page);
      status.textContent='';update();opened=true;previousOverflow=doc.body.style.overflow;doc.body.style.overflow='hidden';launcher.setAttribute('aria-expanded','true');
      if(typeof dialog.showModal==='function')dialog.showModal();
      else{dialog.setAttribute('open','');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');Array.from(doc.body.children).forEach(function(node){if(node!==host){fallbackInert.push({node:node,was:node.inert});node.inert=true;}});}
      question.focus();
    }
    launcher.addEventListener('click',function(){open();});host.querySelector('.qh-close').addEventListener('click',close);
    dialog.addEventListener('close',closeCleanup);dialog.addEventListener('cancel',function(event){event.preventDefault();close();});
    dialog.addEventListener('click',function(event){if(event.target!==dialog)return;var r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();});
    dialog.addEventListener('keydown',function(event){
      if(event.key==='Escape'){event.preventDefault();close();return;}if(event.key!=='Tab')return;
      var focusable=Array.from(dialog.querySelectorAll('button,a[href],textarea,select,input,summary')).filter(function(node){return !node.disabled&&node.getClientRects().length>0;});
      if(!focusable.length)return;var first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}
    });
    question.addEventListener('input',function(){status.textContent='';update();});mode.addEventListener('change',update);selectionToggle.addEventListener('change',update);
    host.querySelector('.qh-copy').addEventListener('click',async function(){
      update();try{if(!win.navigator.clipboard||!win.navigator.clipboard.writeText)throw new Error('clipboard unavailable');await win.navigator.clipboard.writeText(prompt.value);status.textContent='已复制。打开 ChatGPT 后粘贴，再自行发送。';}
      catch(error){host.querySelector('.qh-preview').open=true;prompt.focus();prompt.select();status.textContent='当前浏览器不允许自动复制。已选中完整问题，请使用系统复制或 Ctrl/Cmd+C。';}
    });
    doc.addEventListener('click',function(event){var target=event.target.closest&&event.target.closest('[data-ask-question]');if(!target)return;event.preventDefault();open({question:target.dataset.askQuestion,topic:target.dataset.askTopic});});
    API.open=open;API.close=close;
  };
  return API;
}));
