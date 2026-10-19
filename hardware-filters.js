/* Pure numerical helpers plus a local-only lesson UI. No persistence, network or shared-engine changes. */
(function(root,factory){'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root&&root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',function(){api.init(root);});else api.init(root);}})(typeof window!=='undefined'?window:null,function(){
'use strict';
const FS=1000,TARGET=40,INTERFERENCE=960;
function mul(a,b){return {re:a.re*b.re-a.im*b.im,im:a.re*b.im+a.im*b.re};}
function magnitude(z){return Math.hypot(z.re,z.im);}
function analog(f,fc){if(!fc)return {re:1,im:0};const r=f/fc,d=1+r*r;return {re:1/d,im:-r/d};}
function digital(f,kind){const w=2*Math.PI*f/FS;if(kind==='fir'){let re=0,im=0;for(let k=0;k<8;k++){re+=Math.cos(w*k)/8;im-=Math.sin(w*k)/8;}return {re,im};}if(kind==='iir'){const re=1-.8*Math.cos(w),im=.8*Math.sin(w),d=re*re+im*im;return {re:.2*re/d,im:-.2*im/d};}return {re:1,im:0};}
function calculate(fc,kind){const a=mul(analog(TARGET,fc),digital(TARGET,kind)),b=mul(analog(INTERFERENCE,fc),digital(INTERFERENCE,kind));const targetAmp=magnitude(a),noiseAmp=.6*magnitude(b);const samples=Array.from({length:51},(_,n)=>{const desired=a.re*Math.cos(2*Math.PI*TARGET*n/FS)-a.im*Math.sin(2*Math.PI*TARGET*n/FS);const noise=.6*(b.re*Math.cos(2*Math.PI*INTERFERENCE*n/FS)-b.im*Math.sin(2*Math.PI*INTERFERENCE*n/FS));return {n,desired,actual:desired+noise};});return {targetAmp,noiseAmp,ratio:noiseAmp/targetAmp,samples};}
function impulse(kind,n){if(n<0)return 0;return kind==='fir'?(n<4?.25:0):.25*Math.pow(.75,n);}
function init(win){const doc=win.document;if(!doc.getElementById('alias-chart'))return;const byId=id=>doc.getElementById(id);const NS='http://www.w3.org/2000/svg';
function el(tag,attrs,text){const n=doc.createElementNS(NS,tag);Object.entries(attrs||{}).forEach(([k,v])=>n.setAttribute(k,v));if(text!==undefined)n.textContent=text;return n;}
function canvas(svg,height,title,desc){const width=Math.max(280,Math.round(svg.getBoundingClientRect().width)||840);svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.replaceChildren(el('title',{id:svg.id+'-title'},title),el('desc',{id:svg.id+'-desc'},desc));return width;}
const analogControl=byId('analog-filter'),digitalControl=byId('digital-filter'),aliasChart=byId('alias-chart');
function drawAlias(){const fc=Number(analogControl.value)||0,kind=digitalControl.value,r=calculate(fc,kind),w=canvas(aliasChart,260,'采样后的输出对比',`采样率 1000 samples/s。960 Hz 干扰重合到 40 Hz。有效幅度 ${r.targetAmp.toFixed(3)}，干扰幅度 ${r.noiseAmp.toFixed(3)}，两者比值 ${(r.ratio*100).toFixed(2)}%。`);const x=n=>47+n/50*(w-66),y=v=>125-v/1.8*88;
[-1.5,0,1.5].forEach(v=>{aliasChart.append(el('line',{x1:47,y1:y(v),x2:w-19,y2:y(v),stroke:'#DEE4ED'}),el('text',{x:38,y:y(v)+4,'text-anchor':'end'},v.toFixed(1)));});
[0,10,20,30,40,50].forEach(n=>{aliasChart.append(el('line',{x1:x(n),y1:37,x2:x(n),y2:213,stroke:'#EDF0F6'}),el('text',{x:x(n),y:234,'text-anchor':'middle'},n));});
aliasChart.append(el('text',{x:12,y:19,class:'hw-axis-label'},'归一化幅度'),el('text',{x:w-18,y:253,'text-anchor':'end',class:'hw-axis-label'},'时间 / ms'));
[['desired','#4B43E8','5 4'],['actual','#9A5800',null]].forEach(([key,color,dash])=>{const attrs={d:r.samples.map((s,i)=>(i?'L':'M')+x(s.n).toFixed(2)+' '+y(s[key]).toFixed(2)).join(' '),fill:'none',stroke:color,'stroke-width':2};if(dash)attrs['stroke-dasharray']=dash;aliasChart.append(el('path',attrs));r.samples.forEach(s=>aliasChart.append(el('circle',{cx:x(s.n),cy:y(s[key]),r:key==='actual'?2.3:1.8,fill:color})));});
byId('alias-metrics').innerHTML=`<div><span>960 Hz 混叠后</span><strong>40 Hz</strong></div><div><span>干扰 / 有效幅度</span><strong>${(r.ratio*100).toFixed(2)}%</strong></div><div><span>有效信号剩余幅度</span><strong>${r.targetAmp.toFixed(3)}</strong></div>`;
const post=kind==='none'?'此时尚未加数字滤波。':kind==='fir'?'8 点平均把两者一起衰减；线性相位群延迟为 3.5 ms。':'一阶 IIR 把两者一起衰减；其群延迟随频率变化，不能用一个固定时间概括。';
byId('alias-result').textContent=(fc?`ADC 前 RC 先把干扰/有效幅度比从 60% 降到 ${(r.ratio*100).toFixed(2)}%，仍有残余。`:'缺少模拟限带：960 Hz 已折叠到有效信号的 40 Hz，干扰/有效幅度比仍为 60%。')+post+' 数字低通无法只去掉这个已重合的干扰分量。';
}
let step=-1;const kindControl=byId('impulse-kind'),implementation=byId('implementation'),stepButton=byId('impulse-step'),impulseChart=byId('impulse-chart');
function drawImpulse(){const kind=kindControl.value,fpga=implementation.value==='fpga',value=impulse(kind,step),previous=impulse(kind,step-1),current=step===0?1:0;const equation=kind==='fir'?'y[n] = 0.25 × (x[n] + x[n−1] + x[n−2] + x[n−3])':'y[n] = 0.25 × x[n] + 0.75 × y[n−1]';byId('impulse-equation').textContent=equation;
const values=kind==='fir'?Array.from({length:4},(_,i)=>({label:i?'x[n−'+i+']':'x[n]',value:step>=0&&step-i===0?1:0})): [{label:'本拍 x[n]',value:current},{label:'旧状态 y[n−1]',value:previous},{label:'写回 y[n]',value}];const state=byId('impulse-state');state.dataset.kind=kind;state.replaceChildren();values.forEach(item=>{const d=doc.createElement('div');d.className='hw-state'+(item.value?' is-active':'');const label=doc.createElement('span'),v=doc.createElement('strong');label.textContent=item.label;v.textContent=Number(item.value.toFixed(5)).toString();d.append(label,v);state.append(d);});
byId('impulse-readout').textContent=step<0?'初始状态为 0；输入仅在第 0 拍为 1。':`第 ${step} 拍：x = ${current}，y = ${value.toFixed(6)}${kind==='fir'&&step>=4?'；这次冲激的影响已结束。':kind==='iir'&&step>=4?'；尾巴继续衰减。':'。'}`;
stepButton.disabled=step>=11;stepButton.textContent=step>=11?'已计算 12 拍':'计算下一拍';
byId('implementation-note').textContent=fpga?(kind==='fir'?'FPGA：寄存器 / RAM 保存历史样本，数字乘加逻辑求加权和。可并行或复用 MAC；这张图不限定硬件资源数量。':'FPGA：寄存器保存上一拍输出，数字乘加逻辑算出新输出后写回。反馈状态与时序需要配合设计。'):(kind==='fir'?'MCU：数组 / 环形缓冲保存历史样本，CPU 执行乘加指令。换成 FPGA，理想方程和这一拍的输出保持相同。':'MCU：变量保存上一拍输出，CPU 做乘法、加法并更新变量。换成 FPGA，理想方程和这一拍的输出保持相同。');
state.setAttribute('aria-label',(fpga?'数字寄存器或存储器':'软件变量或数组')+'中的状态');
const w=canvas(impulseChart,230,'一拍输入留下的影响',step<0?'尚未计算。':`已计算到第 ${step} 拍，${kind.toUpperCase()} 输出为 ${value.toFixed(6)}。`),x=n=>47+n/11*(w-66),y=v=>180-v/.3*132;
[0,.1,.2,.3].forEach(v=>impulseChart.append(el('line',{x1:47,y1:y(v),x2:w-19,y2:y(v),stroke:'#DEE4ED'}),el('text',{x:38,y:y(v)+4,'text-anchor':'end'},v.toFixed(1))));
for(let n=0;n<12;n++){impulseChart.append(el('text',{x:x(n),y:204,'text-anchor':'middle'},n));if(n<=step){const v=impulse(kind,n);impulseChart.append(el('line',{x1:x(n),y1:y(0),x2:x(n),y2:y(v),stroke:n===step?'#9A5800':'#4B43E8','stroke-width':3}),el('circle',{cx:x(n),cy:y(v),r:n===step?4.5:3,fill:n===step?'#9A5800':'#4B43E8'}));}}
impulseChart.append(el('text',{x:12,y:20,class:'hw-axis-label'},'输出幅度'),el('text',{x:w-18,y:223,'text-anchor':'end',class:'hw-axis-label'},'采样编号 n'));
}
[analogControl,digitalControl,kindControl,implementation,byId('alias-reset'),stepButton,byId('impulse-reset')].forEach(c=>c.disabled=false);
analogControl.addEventListener('change',drawAlias);digitalControl.addEventListener('change',drawAlias);byId('alias-reset').addEventListener('click',()=>{analogControl.value='off';digitalControl.value='none';drawAlias();});kindControl.addEventListener('change',()=>{step=-1;drawImpulse();});implementation.addEventListener('change',drawImpulse);stepButton.addEventListener('click',()=>{step=Math.min(11,step+1);drawImpulse();});byId('impulse-reset').addEventListener('click',()=>{step=-1;drawImpulse();});
drawAlias();drawImpulse();let lastWidth=0;function resize(){const width=doc.documentElement.clientWidth;if(width!==lastWidth){lastWidth=width;drawAlias();drawImpulse();}}if(win.ResizeObserver){const observer=new win.ResizeObserver(resize);observer.observe(byId('main'));}else win.addEventListener('resize',resize);
}
return {analog,digital,calculate,impulse,init,FS,TARGET,INTERFERENCE};
});
