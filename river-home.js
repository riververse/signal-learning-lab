/* Signal decomposition: actual samples, user-driven updates only; no progress/storage changes. */
(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const M={signal:(t,a)=>a*Math.sin(4*Math.PI*t)+.35*Math.sin(12*Math.PI*t)+.18*Math.sin(28*Math.PI*t)};
const pal={blue:'#3361d8',violet:'#6c4fce',cyan:'#2d7391',ink:'#192c43',muted:'#586b82',rule:'#d9e1ec'};
const points=(arr)=>arr.map((p,i)=>(i?'L':'M')+p.map(v=>v.toFixed(2)).join(',')).join(' ');
const svgPath=(ps,color,width=2,extras='')=>`<path d="${points(ps)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" ${extras}/>`;
const text=(x,y,t,size=12,fill=pal.muted,extras='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extras}>${t}</text>`;
const line=(x1,y1,x2,y2,color=pal.rule,extras='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" ${extras}/>`;
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
if($('#river-signal-art')){
 let split=true;
 function draw(){
  const amplitude=Number($('#river-amplitude').value);$('#river-amplitude-output').textContent=amplitude.toFixed(2);
  let b='<title>2、6、14 Hz 的分量与合成波形；分量共用幅值比例，合成图独立缩放</title>';
  const mobile=window.innerWidth<=760;
  $('#river-signal-art').setAttribute('viewBox',mobile?'0 0 390 380':'0 0 800 610');
  if(mobile){
   [[14,.18,63,pal.cyan],[6,.35,128,pal.violet],[2,amplitude,193,pal.blue]].forEach(([f,a,base,col])=>{const y=split?base:128;const ps=Array.from({length:251},(_,i)=>[20+278*i/250,y-30*a*Math.sin(2*Math.PI*f*i/250)]);b+=line(20,y,298,y)+svgPath(ps,col,2);if(split)b+=text(316,y+4,f+' Hz',13,col,'font-weight="600"');});
   b+=text(20,257,split?'叠加成一条信号':'相同时刻，把分量相加',12)+line(20,310,298,310)+svgPath(Array.from({length:251},(_,i)=>[20+278*i/250,310-25*M.signal(i/250,amplitude)]),pal.ink,2.6)+text(316,314,'x(t)',16,pal.ink)+text(20,361,'0',11)+text(298,361,'1 秒',11,pal.muted,'text-anchor="end"');$('#river-signal-art').innerHTML=b;return;
  }
  const specs=[[14,.18,195,pal.cyan],[6,.35,288,pal.violet],[2,amplitude,380,pal.blue]];
  specs.forEach(([f,a,base,col])=>{
   const yy=split?base:288;
   const ps=Array.from({length:421},(_,j)=>[65+590*j/420,yy-(split?68*j/420:0)-66*a*Math.sin(2*Math.PI*f*j/420)]);
   const bas=[[655,yy-(split?68:0)],[65,yy],ps[0]];
   b+=`<path d="${points([...ps,...bas])}" fill="${col}" opacity=".10"/>`;
   b+=line(65,yy,655,yy-(split?68:0));b+=svgPath(ps,col,2.7);
   if(split)b+=text(676,yy-69,f+' Hz',19,col,'font-weight="600"')+text(676,yy-44,a.toFixed(2)+' A');
  });
  b+=text(65,442,split?'三种频率，组成同一条信号':'相同时刻，把三个分量相加',15);
  const sum=Array.from({length:421},(_,j)=>[65+590*j/420,520-42*M.signal(j/420,amplitude)]);
  b+=line(65,520,655,520)+`<path d="${points([...sum,[655,520],[65,520],sum[0]])}" fill="${pal.blue}" opacity=".07"/>`+svgPath(sum,pal.ink,3.5);
  b+=text(675,526,'x(t)',23,pal.ink,'font-family="serif"')+text(65,575,'0')+text(655,575,'1 秒',12,pal.muted,'text-anchor="end"');
  $('#river-signal-art').innerHTML=b;
 }
 $$('[data-river-view]').forEach(b=>b.addEventListener('click',()=>{split=b.dataset.riverView==='split';$$('[data-river-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));draw();}));
 $('#river-amplitude').addEventListener('input',draw);window.addEventListener('resize',draw);draw();
}

})();
