(function () {
 'use strict';
 const titles = {'transforms':'三大变换','iir-fir':'IIR 与 FIR','kalman':'卡尔曼滤波','control':'自动控制','transfer':'传递函数','pll':'数字 PLL','spectrum':'频谱分析','filter-families':'巴特沃斯与切比雪夫'};
 const oldPressureIds = ['guide','guide-iir','guide-fir','guide-kalman','plot','legend','metrics','signal','sliders','noise','match','reset','download','code'];
 const file = location.pathname.split('/').pop() || 'index.html';
 function decodedHash() { try { return decodeURIComponent(location.hash.slice(1)); } catch (_) { return ''; } }
 const hash = decodedHash();
 if (file === 'index.html' && oldPressureIds.includes(hash)) {
  location.replace('pressure.html' + location.search + location.hash);
  return;
 }
 function render(moveFocus) {
  const params = new URLSearchParams(location.search);
  let topic = params.get('topic');
  const view = params.get('view') === 'notes' ? 'notes' : 'principles';
  const target = document.getElementById(decodedHash());
  if (!titles[topic] && target) topic = target.closest('[data-topic]')?.dataset.topic;
  const valid = Object.hasOwn(titles,topic);
  document.getElementById('knowledge-overview').hidden = valid;
  document.querySelectorAll('.topic-panel').forEach(function (panel) {
   const active = valid && panel.dataset.topic === topic;
   panel.hidden = !active;
   panel.querySelectorAll('[data-view]').forEach(el => { el.hidden = el.dataset.view !== view; });
   panel.querySelectorAll('[data-topic-view]').forEach(function(a) {
    if (a.dataset.topicView === view) a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
   });
  });
  document.body.dataset.learningTopic = valid ? topic : '';
  document.title = valid ? titles[topic] + ' · ' + (view === 'notes' ? '学习笔记' : '原理') + ' · RIVER 信号实验室' : '知识图谱 · RIVER 信号实验室';
  if (moveFocus) {
   const heading = document.querySelector(valid ? '#topic-' + topic + ' h1' : '#knowledge-overview h1');
   heading.tabIndex = -1; heading.focus({preventScroll:true});
   window.scrollTo(0,0);
  }
  if (target && !target.closest('[hidden]')) requestAnimationFrame(() => target.scrollIntoView());
  document.dispatchEvent(new CustomEvent('learning-topic-change',{detail:{topic:valid?topic:null}}));
 }
 document.addEventListener('click', function(event) {
  const link = event.target.closest('a[href]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target) return;
  const url = new URL(link.href,location.href);
  if (url.origin !== location.origin || !['knowledge.html','index.html'].includes(url.pathname.split('/').pop())) return;
  if (url.hash && oldPressureIds.includes(url.hash.slice(1))) return;
  event.preventDefault();history.pushState({},'',url.href);render(true);
 });
 window.addEventListener('popstate',() => render(false));
 window.addEventListener('hashchange',() => render(false));
 render(false);
})();
