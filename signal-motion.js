/* Decorative signal traces only. No experiment values, progress, storage or network.
   A single 30 fps clock, cached SVG geometry, viewport and visibility suspension.
   All existing diagrams remain complete when this enhancement is absent. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const body = document.body;
  const models = [];
  let frame = 0, last = 0, time = 0, paused = false, printing = false;
  const make = (tag, attrs = {}) => {
    const node = document.createElementNS(NS, tag);
    for (const [key,value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  };
  const line = (parent, d, color, width = 1.6, extras = {}) => {
    const path = make('path', {d, fill:'none', stroke:color, 'stroke-width':width, 'stroke-linecap':'round', 'stroke-linejoin':'round', ...extras});
    parent.append(path); return path;
  };
  const text = (parent, x, y, content, cls='') => {
    const node = make('text', {x,y,class:cls}); node.textContent=content; parent.append(node);
  };
  function traceModel(svg, definitions, speed=0.08) {
    const group = make('g', {class:'signal-particles','aria-hidden':'true'});
    svg.append(group);
    const trails = definitions.map(({path,color,count=2}) => {
      const length = path.getTotalLength();
      const points = Array.from({length:181}, (_,i) => path.getPointAtLength(length*i/180));
      const dots = Array.from({length:count}, (_,i) => {
        const dot=make('circle',{r:i===0?2.6:1.8,fill:color,opacity:i===0?0.95:0.5});
        group.append(dot); return dot;
      });
      return {points,dots};
    });
    const model={svg,visible:false,group,trails,speed};
    models.push(model); return model;
  }
  const intro = document.querySelector('.map-intro');
  if (intro) {
    const figure=document.createElement('figure');
    figure.className='signal-hero'; figure.setAttribute('aria-label','信号分解示意：连续波形、等间隔采样与两个频率分量。动画为示意，不是实时测量。');
    const svg=make('svg',{viewBox:'0 0 480 248',role:'img','aria-hidden':'true'});
    figure.append(svg); intro.append(figure);
    const grid=make('g',{stroke:'#253d4e','stroke-width':0.7,opacity:0.75}); svg.append(grid);
    for(let x=24;x<=456;x+=24) line(grid,`M${x} 48V215`,'#253d4e',0.6);
    for(let y=59;y<=215;y+=26) line(grid,`M24 ${y}H456`,'#253d4e',0.6);
    text(svg,24,28,'一段信号，两种视角','signal-legend');
    text(svg,24,232,'连续波形 / 等间隔采样'); text(svg,315,232,'频率分量 / 示意');
    text(svg,24,53,'x(t)  →  x[n]','signal-formula'); text(svg,315,53,'|X[k]|','signal-formula');
    line(svg,'M24 134H259M315 203H456','#4b667a',1);
    const wave = x => 130-35*Math.sin((x-24)/226*Math.PI*4)-15*Math.sin((x-24)/226*Math.PI*10);
    const d=Array.from({length:227},(_,i)=>`${i?'L':'M'}${24+i} ${wave(24+i).toFixed(2)}`).join(' ');
    const wavePath=line(svg,d,'#7ddbd1',2);
    for(let x=24;x<=250;x+=14) {
      line(svg,`M${x} 134V${wave(x)}`,'#7ddbd1',1,{opacity:0.18});
      svg.append(make('circle',{cx:x,cy:wave(x),r:2.1,fill:'#7ddbd1'}));
    }
    const bridge=line(svg,'M271 130H296','#8ca9bf',1.4);
    line(svg,'M290 124L296 130 290 136','#8ca9bf',1.4);
    const spectrum=make('g'); svg.append(spectrum);
    const a=line(spectrum,'M347 203V91','#8fbfff',4);
    const b=line(spectrum,'M413 203V155','#e5c080',4);
    line(spectrum,'M341 91H353M407 155H419','#d8e8f3',1.6);
    text(svg,341,219,'f₁');text(svg,407,219,'f₂');
    text(svg,332,77,'A₁');text(svg,398,143,'A₂');
    traceModel(svg,[{path:wavePath,color:'#e4fff9',count:3},{path:bridge,color:'#b5d8ff',count:1}],0.065);
  }

  // Trace only the existing illustrations, never SVG figures in lessons or live plots.
  document.querySelectorAll('.topic-diagram svg,.topic-heading-diagram svg').forEach(svg => {
    const card=svg.closest('.topic-card');
    const topic=card ? [...card.classList].find(name=>name.startsWith('topic-card--'))?.slice(12) : svg.closest('[data-topic]')?.dataset.topic;
    // Statistical distributions and response plots remain static: no suggestion of changing data.
    const routes={
      transforms:['M18 65Q30 17 43 65T68 65T93 65'],
      'iir-fir':['M22 38H154','M251 55V87H213V55'],
      control:['M18 47H71','M104 47H139','M197 47H266V94H85V64'],
      transfer:['M22 94H51V31H116','M201 94C211 57 228 34 244 32S281 31 298 31'],
      pll:[]
    };
    if (!Object.hasOwn(routes,topic)) return;
    let paths=[];
    if(topic==='pll') {
      paths=[...svg.querySelectorAll('g[stroke="#7bdacf"] > path')].slice(0,2);
    } else {
      const guides=make('g',{'aria-hidden':'true',opacity:0,class:'signal-motion-guides'});
      svg.append(guides);
      paths=routes[topic].map(d=>line(guides,d,'none'));
    }
    const definitions=paths.map((path,i)=>({path,color:i===1?'#f4d394':'#b9f6e8',count:2}));
    if(definitions.length) traceModel(svg,definitions,0.075);
  });
  if (!models.length) return;
  const header=document.querySelector('.architecture-bar');
  const toggle=document.createElement('button');
  toggle.type='button'; toggle.className='signal-motion-toggle';
  toggle.innerHTML='<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2h3v10H3zM8 2h3v10H8z"/></svg><span>暂停动效</span>';
  toggle.setAttribute('aria-label','暂停示意图动效'); toggle.setAttribute('aria-pressed','false');
  if(header) header.append(toggle);
  const label=toggle.querySelector('span');
  const icon=toggle.querySelector('path');
  function allowed() { return !paused && !reduce.matches && !document.hidden && !printing; }
  function active(model) { return model.visible && !model.svg.closest('[hidden]'); }
  function draw(model) {
    for(let j=0;j<model.trails.length;j++) {
      const {points,dots}=model.trails[j];
      dots.forEach((dot,i)=>{
        const progress=(time*model.speed+i/dots.length+j*.19)%1;
        const index=progress*180, low=Math.floor(index), fraction=index-low;
        const p=points[low], q=points[Math.min(low+1,180)];
        dot.setAttribute('cx',(p.x+(q.x-p.x)*fraction).toFixed(2));
        dot.setAttribute('cy',(p.y+(q.y-p.y)*fraction).toFixed(2));
      });
    }
  }
  function tick(now) {
    frame=0;
    if(!allowed()) {last=0;return;}
    const visible=models.filter(active);
    if(!visible.length) {last=0;return;}
    if(!last || now-last>=32) {
      time+=last?Math.min((now-last)/1000,.08):0;
      last=now; visible.forEach(draw);
    }
    frame=requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);frame=0;last=0;
    const state=reduce.matches?'reduced':paused?'paused':'playing';
    body.dataset.signalMotion=state;
    toggle.disabled=reduce.matches;
    toggle.setAttribute('aria-pressed',String(paused));
    toggle.setAttribute('aria-label',reduce.matches?'已遵循系统减少动态效果设置':paused?'播放示意图动效':'暂停示意图动效');
    label.textContent=reduce.matches?'静态模式':paused?'播放动效':'暂停动效';
    icon.setAttribute('d',paused?'M3 2l9 5-9 5z':'M3 2h3v10H3zM8 2h3v10H8z');
    if(allowed() && models.some(active)) frame=requestAnimationFrame(tick);
  }
  models.forEach(draw);
  if('IntersectionObserver' in window) {
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries) {
        const model=models.find(item=>item.svg===entry.target);
        if(model)model.visible=entry.isIntersecting;
      }
      sync();
    },{threshold:0});
    models.forEach(model=>observer.observe(model.svg));
  } else {
    // Old browsers receive static diagrams rather than an unbounded background loop.
    paused=true;
  }
  toggle.addEventListener('click',()=>{paused=!paused;sync();});
  document.addEventListener('visibilitychange',sync);
  document.addEventListener('learning-topic-change',sync);
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;last=0;});
  window.addEventListener('pageshow',sync);
  window.addEventListener('beforeprint',()=>{printing=true;sync();});
  window.addEventListener('afterprint',()=>{printing=false;sync();});
  if(reduce.addEventListener) reduce.addEventListener('change',sync); else reduce.addListener(sync);
  sync();
})();
