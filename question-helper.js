/* A local question composer, not a chatbot. It sends nothing and stores no question. An optional conversation URL stays in this browser only. */
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
  var CHAT_KEY='river.question.chat-url.v1';
  function validateChatURL(value){
    if(typeof value!=='string')return '';
    var raw=value.trim();
    // Only a direct existing conversation. No userinfo, ports, queries, fragments, escapes or redirects.
    if(!/^https:\/\/chatgpt\.com\/c\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/?$/i.test(raw))return '';
    try{var url=new URL(raw);if(url.protocol!=='https:'||url.hostname!=='chatgpt.com'||url.pathname.slice(0,3)!=='/c/'||url.port||url.username||url.password||url.search||url.hash)return '';return 'https://chatgpt.com'+url.pathname.replace(/\/$/,'');}catch(error){return '';}
  }
  function composePrompt(context,question,mode,selection,includeContext){
    var modes={explain:'请用直观例子讲清，再逐步连接到公式。',check:'请先让我独立作答，再逐步检查推理；不要先给出完整答案。',apply:'请用一个具体工程例子，说明用途、输入条件、参数和限制。'};
    var result=['我在 RIVER 信号实验室学习。'];
    if(includeContext){
      result.push('当前主题：'+(TOPICS[context.topic]||'信号处理')+'。','当前页面：'+context.page+'。');
      if(context.section)result.push('正在看的小节：'+context.section+'。');
      if(context.lesson)result.push('这次的学习目标：'+context.lesson+'。');
    }
    if(selection)result.push('我选中的内容：'+selection);
    result.push('我的问题：'+(String(question||'').trim()||'请先问一个简短问题，确认我卡在哪里。'));
    result.push(modes[mode]||modes.explain);
    result.push('请明确公式约定、单位和适用边界，一次只推进一个关键连接。不把看过资料或网站打卡当成已经掌握；如缺采样率、通道类型等条件，先向我确认。');
    return result.join('\n\n');
  }
  var API={inferTopic:inferTopic,findGlossary:findGlossary,composePrompt:composePrompt,validateChatURL:validateChatURL,chatKey:CHAT_KEY};
  API.init=function(win){
    var doc=win.document;if(doc.getElementById('qh-dialog'))return;
    var host=doc.createElement('div');host.className='qh-host';
    host.innerHTML="<button class=\"qh-launcher\" id=\"qh-launcher\" type=\"button\" aria-haspopup=\"dialog\" aria-controls=\"qh-dialog\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-5 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z\"/><path d=\"M9.8 8a2.3 2.3 0 1 1 3.5 2c-.9.5-1.3 1-1.3 2M12 14.7v.2\"/></svg><span>随时提问</span></button><dialog class=\"qh-dialog\" id=\"qh-dialog\" aria-labelledby=\"qh-title\" aria-describedby=\"qh-description\"><div class=\"qh-head\"><div><p class=\"qh-eyebrow\">本地提问准备器</p><h2 id=\"qh-title\">把问题带到专用对话</h2></div><button type=\"button\" class=\"qh-close\" aria-label=\"关闭提问窗口\">×</button></div><div class=\"qh-body\"><p class=\"qh-description\" id=\"qh-description\">这里只整理问题，不是站内 AI。不会读取私人聊天、调用 API、自动发送或保存你的问题。你在 ChatGPT 中粘贴、发送并查看回复。</p><p class=\"qh-context\" id=\"qh-context\"></p><label class=\"qh-label\" for=\"qh-question\">你想问什么？</label><textarea id=\"qh-question\" class=\"qh-question\" rows=\"3\" maxlength=\"3000\" placeholder=\"例如：C(3) = 3 + 4i，为什么幅值不直接取 3？\"></textarea><label class=\"qh-selection-label\"><input type=\"checkbox\" id=\"qh-include-context\">带上当前主题、页面、小节与本次学习目标</label><label class=\"qh-selection-label\" id=\"qh-selection-label\" hidden><input type=\"checkbox\" id=\"qh-include-selection\">把刚才选中的文字带上（最多 300 字）</label><label class=\"qh-label\" for=\"qh-mode\">这次怎样帮我</label><select id=\"qh-mode\"><option value=\"explain\">先解释概念，再连接公式</option><option value=\"check\">检查我的理解，不先给答案</option><option value=\"apply\">联系实际工程与应用边界</option></select><section class=\"qh-hint\" id=\"qh-hint\" aria-labelledby=\"qh-hint-title\"><span class=\"qh-hint-label\">固定知识提示 · 按关键词匹配</span><h3 id=\"qh-hint-title\"></h3><p id=\"qh-hint-text\"></p><a id=\"qh-hint-link\" href=\"knowledge.html\">回到对应知识</a></section><details class=\"qh-preview\"><summary>查看将要复制的完整问题</summary><label class=\"qh-label\" for=\"qh-prompt\">可以检查后再复制</label><textarea id=\"qh-prompt\" rows=\"9\" readonly></textarea></details><details class=\"qh-settings\"><summary id=\"qh-chat-summary\">设置专用 ChatGPT 对话</summary><label class=\"qh-label\" for=\"qh-chat-url\">已有对话地址（仅此浏览器）</label><input id=\"qh-chat-url\" class=\"qh-chat-url\" type=\"url\" maxlength=\"256\" inputmode=\"url\" autocomplete=\"off\" autocapitalize=\"none\" spellcheck=\"false\" aria-describedby=\"qh-chat-help qh-chat-status\" placeholder=\"粘贴 ChatGPT 对话地址，不是分享链接\"><p class=\"qh-next\" id=\"qh-chat-help\">打开你已建好的专用对话，复制地址栏中的 chatgpt.com/c/… 地址。这里不创建或读取对话，也不检查你的访问权限。</p><div class=\"qh-setting-actions\"><button type=\"button\" class=\"qh-chat-save\">保存此浏览器设置</button><button type=\"button\" class=\"qh-chat-forget\">移除设置</button></div></details><p id=\"qh-chat-status\" class=\"qh-next\" role=\"status\" aria-live=\"polite\"></p><div class=\"qh-actions\"><button type=\"button\" class=\"qh-copy-open\">复制问题并打开 ChatGPT</button><button type=\"button\" class=\"qh-copy\">只复制完整问题</button><a href=\"https://chatgpt.com/\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"qh-open\">打开 ChatGPT 首页 ↗</a></div><p class=\"qh-next\">完整问题只包含你输入的内容、选定的讲解方式和主动勾选的上下文。本机打卡与专用对话地址不会自动带入；专用对话地址也不会随进度备份导出。问题不会自动发送。</p><p class=\"qh-status\" role=\"status\" aria-live=\"polite\"></p></div></dialog>";
    doc.body.appendChild(host);
    var launcher=host.querySelector('.qh-launcher'),dialog=host.querySelector('dialog'),question=host.querySelector('#qh-question'),mode=host.querySelector('#qh-mode'),prompt=host.querySelector('#qh-prompt'),status=host.querySelector('.qh-status'),selectionToggle=host.querySelector('#qh-include-selection'),contextToggle=host.querySelector('#qh-include-context');
    var settings=host.querySelector('.qh-settings'),chatInput=host.querySelector('#qh-chat-url'),chatStatus=host.querySelector('#qh-chat-status'),copyButton=host.querySelector('.qh-copy'),routeButton=host.querySelector('.qh-copy-open'),openLink=host.querySelector('.qh-open'),forgetButton=host.querySelector('.qh-chat-forget');
    var opened=false,opener=null,selection='',context={},previousOverflow='',fallbackInert=[],configuredURL='',hasStoredURL=false,copyEpoch=0,copyBusy=false;
    function syncDestination(){
      openLink.href=configuredURL||'https://chatgpt.com/';
      openLink.textContent=configuredURL?'仅打开专用对话 ↗':'打开 ChatGPT 首页 ↗';
      chatInput.value=configuredURL;
      forgetButton.disabled=!configuredURL&&!hasStoredURL;
      host.querySelector('#qh-chat-summary').textContent=configuredURL?'专用对话已设置 · 更换或移除':'设置专用 ChatGPT 对话';
    }
    function loadDestination(){
      try{
        var saved=win.localStorage.getItem(CHAT_KEY);hasStoredURL=saved!==null;configuredURL=validateChatURL(saved||'');
        chatStatus.textContent=saved&&!configuredURL?'本机保存的对话地址无效，已停用。请重新粘贴有效地址。':configuredURL?'地址只保存在此浏览器，不会放进问题或学习进度备份。':'尚未设置。粘贴已有专用对话的地址后，才能一键复制并打开。';
      }catch(error){configuredURL='';hasStoredURL=false;chatStatus.textContent='无法读取此浏览器的设置。仍可复制问题，或临时设置本页的专用对话。';}
      syncDestination();settings.open=!configuredURL;
    }
    // Invalidating a notice cannot cancel a native clipboard write. Keep its lock until it settles.
    function cancelCopy(){copyEpoch++;}
    function changed(){cancelCopy();status.textContent=copyBusy?'上一次复制仍在等待浏览器。内容已变化，请等它结束后重新复制。':'';update();}
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
      prompt.value=composePrompt(context,question.value,mode.value,selectionToggle.checked?selection:'',contextToggle.checked);
      var hint=findGlossary(question.value,context.topic);var hintBox=host.querySelector('#qh-hint');hintBox.hidden=!hint;
      if(hint){host.querySelector('#qh-hint-title').textContent=hint.title;host.querySelector('#qh-hint-text').textContent=hint.text;host.querySelector('#qh-hint-link').href=hint.href;}
    }
    function closeCleanup(){
      if(!opened)return;cancelCopy();opened=false;doc.body.style.overflow=previousOverflow;launcher.setAttribute('aria-expanded','false');
      fallbackInert.forEach(function(item){item.node.inert=item.was;});fallbackInert=[];
      if(opener&&opener.isConnected)opener.focus();else launcher.focus();
    }
    function close(){if(!opened)return;if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');closeCleanup();}
    function open(options){
      options=options||{};
      if(opened){if(options.question){question.value=String(options.question).slice(0,3000);changed();}question.focus();return;}
      opener=doc.activeElement;selection=String(win.getSelection?win.getSelection():'').trim().slice(0,300);context=getContext(options);
      selectionToggle.checked=false;contextToggle.checked=false;host.querySelector('#qh-selection-label').hidden=!selection;
      if(options.question)question.value=String(options.question).slice(0,3000);
      host.querySelector('#qh-context').textContent='本页参考（默认不带入）：'+(TOPICS[context.topic]||'信号处理')+' · '+(context.section||context.page);
      status.textContent=copyBusy?'上一次复制仍在等待浏览器，请稍后再复制当前问题。':'';update();opened=true;previousOverflow=doc.body.style.overflow;doc.body.style.overflow='hidden';launcher.setAttribute('aria-expanded','true');
      if(typeof dialog.showModal==='function')dialog.showModal();
      else{dialog.setAttribute('open','');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');Array.from(doc.body.children).forEach(function(node){if(node!==host){fallbackInert.push({node:node,was:node.inert});node.inert=true;}});}
      question.focus();
    }
    launcher.addEventListener('click',function(){open();});host.querySelector('.qh-close').addEventListener('click',close);
    dialog.addEventListener('close',function(){if(!dialog.open)closeCleanup();});dialog.addEventListener('cancel',function(event){event.preventDefault();close();});
    dialog.addEventListener('click',function(event){if(event.target!==dialog)return;var r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();});
    dialog.addEventListener('keydown',function(event){
      if(event.key==='Escape'){event.preventDefault();close();return;}if(event.key!=='Tab')return;
      var focusable=Array.from(dialog.querySelectorAll('button,a[href],textarea,select,input,summary')).filter(function(node){return !node.disabled&&node.getClientRects().length>0;});
      if(!focusable.length)return;var first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}
    });
    question.addEventListener('input',changed);mode.addEventListener('change',changed);selectionToggle.addEventListener('change',changed);contextToggle.addEventListener('change',changed);
    chatInput.addEventListener('input',function(){chatInput.removeAttribute('aria-invalid');});
    host.querySelector('.qh-chat-save').addEventListener('click',function(){
      var url=validateChatURL(chatInput.value);
      if(!url){settings.open=true;chatInput.setAttribute('aria-invalid','true');chatInput.focus();chatStatus.textContent='请粘贴地址栏中的 https://chatgpt.com/c/… 完整对话地址；不接受分享链接、其他网站、参数或片段。原设置未更改。';return;}
      cancelCopy();configuredURL=url;chatInput.removeAttribute('aria-invalid');
      try{win.localStorage.setItem(CHAT_KEY,url);hasStoredURL=true;chatStatus.textContent='已在此浏览器保存专用对话地址。它不会进入问题或学习进度备份。';}
      catch(error){chatStatus.textContent='浏览器不允许保存。此地址仅在本页临时有效，刷新或离开后需要重新设置。';}
      syncDestination();settings.open=false;if(copyBusy)openLink.focus();else routeButton.focus();status.textContent=copyBusy?'上一次复制仍在等待浏览器。设置已变化，请等它结束后重新复制。':'请检查完整问题，再复制并打开专用对话。';
    });
    forgetButton.addEventListener('click',function(){
      cancelCopy();configuredURL='';chatInput.removeAttribute('aria-invalid');
      try{win.localStorage.removeItem(CHAT_KEY);hasStoredURL=false;chatStatus.textContent='已移除此浏览器的专用对话地址。ChatGPT 中的对话和本机学习打卡未改变。';}
      catch(error){chatStatus.textContent='本页已停用专用对话，但浏览器未允许删除保存项；刷新后可能再次出现。可在浏览器中清除此站点的数据。';}
      syncDestination();settings.open=true;chatInput.focus();status.textContent='';
    });
    function manualCopy(){host.querySelector('.qh-preview').open=true;prompt.focus();prompt.select();}
    function copyQuestion(openChat){
      if(copyBusy)return;
      // Revalidate at use time; an unsaved edit is never an active destination.
      var destination=validateChatURL(configuredURL);
      if(openChat&&!destination){settings.open=true;chatInput.focus();chatStatus.textContent='先粘贴并保存已有专用对话的地址。也可以只复制问题，自行选择聊天。';return;}
      update();var text=prompt.value,epoch=++copyEpoch,writing,openError=false;
      copyBusy=true;copyButton.disabled=true;routeButton.disabled=true;
      // Start both operations synchronously in this click. Awaiting the clipboard first can lose popup permission.
      try{if(!win.navigator.clipboard||!win.navigator.clipboard.writeText)throw new Error('clipboard unavailable');writing=Promise.resolve(win.navigator.clipboard.writeText(text));}
      catch(error){writing=Promise.reject(error);}
      if(openChat){try{win.open(destination,'_blank','noopener,noreferrer');}catch(error){openError=true;}}
      status.textContent='正在复制完整问题…';
      return writing.then(function(){
        if(!opened||epoch!==copyEpoch)return;
        status.textContent=openChat?'已复制。请在专用对话中粘贴并自行发送，回复也在 ChatGPT 中查看。'+(openError?'浏览器未能打开页面，请点击「仅打开专用对话」。':'若没有新标签页，请点击「仅打开专用对话」。'):'已复制。打开 ChatGPT 后粘贴，再自行发送。';
      },function(){
        if(!opened||epoch!==copyEpoch)return;
        manualCopy();status.textContent='当前浏览器不允许自动复制。已选中完整问题，请使用系统复制或 Ctrl/Cmd+C。'+(openChat?'若已打开新标签页，请返回这里复制；再到专用对话中粘贴并自行发送。若未打开，可点击「仅打开专用对话」。':'');
      }).then(function(){copyBusy=false;copyButton.disabled=false;routeButton.disabled=false;if(opened&&epoch!==copyEpoch)status.textContent='内容或设置已变化。请重新复制当前完整问题。';});
    }
    copyButton.addEventListener('click',function(){return copyQuestion(false);});routeButton.addEventListener('click',function(){return copyQuestion(true);});
    win.addEventListener('storage',function(event){if(event.key!==CHAT_KEY&&event.key!==null)return;cancelCopy();loadDestination();status.textContent='已更新此浏览器的专用对话设置。';});
    doc.addEventListener('click',function(event){var target=event.target.closest&&event.target.closest('[data-ask-question]');if(!target)return;event.preventDefault();open({question:target.dataset.askQuestion,topic:target.dataset.askTopic});});
    loadDestination();API.open=open;API.close=close;
  };
  return API;
}));
