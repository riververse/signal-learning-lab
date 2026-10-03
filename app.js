'use strict';
const $=id=>document.getElementById(id);
const defs=[['sigma','噪声 σ / kPa',0,8,.1,2],['alpha','IIR · α',.01,1,.01,.15],['n','FIR · N / 点',1,60,1,15],['q','Kalman · Q / kPa²',0,3,.01,.08],['r','Kalman · R / kPa²',.1,64,.1,4]];
let seed=42,last;
const colors=['#d5e1ec','#8ca0b7','#71d6ac','#72b4ff','#f1c57a'];
const names=['真实压力','带噪测量','IIR','FIR 均值','Kalman'];
const visible=names.map(()=>true);
$('legend').innerHTML=names.map((s,i)=>`<label class="curve-toggle" style="--c:${colors[i]}"><input type="checkbox" data-curve="${i}" checked><span>${s}</span></label>`).join('');
$('legend').addEventListener('change',e=>{const i=Number(e.target.dataset.curve);if(!Number.isInteger(i))return;visible[i]=e.target.checked;draw(last);});
$('sliders').innerHTML=defs.map(([id,label,min,max,step,value])=>`<div class="control"><label for="${id}">${label}<output id="${id}out" for="${id}">${value}</output></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`).join('');
function params(){return Object.fromEntries(defs.map(([id])=>[id,Number($(id).value)]));}
function simulate(p,kind,noiseSeed){let state=noiseSeed>>>0; const random=()=>{state=(1664525*state+1013904223)>>>0;return (state+.5)/4294967296;};const rows=[];let iy=0,x=0,P=p.r,sum=0;let queue=[];for(let k=0;k<=1000;k++){const t=k/100;const truth=kind==='step'?(t<3?100:120):kind==='sine'?110+10*Math.sin(2*Math.PI*.3*t):kind==='ramp'?100+2*t:100;const gaussian=Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());const z=truth+p.sigma*gaussian;let gain=null;if(k===0){iy=z;x=z;}else{iy+=p.alpha*(z-iy);const pp=P+p.q;gain=pp/(pp+p.r);x+=gain*(z-x);P=(1-gain)*(1-gain)*pp+gain*gain*p.r;}queue.push(z);sum+=z;if(queue.length>p.n)sum-=queue.shift();rows.push([t,truth,z,iy,sum/queue.length,x,P,gain]);}return rows;}
function draw(rows){const canvas=$('plot');const rect=canvas.getBoundingClientRect();const ratio=window.devicePixelRatio||1;canvas.width=rect.width*ratio;canvas.height=rect.height*ratio;const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);const w=rect.width,h=rect.height,pad={l:48,r:12,t:18,b:32};const vals=rows.flatMap(r=>[r[1],r[2]]);let lo=Math.floor((Math.min(...vals)-2)/5)*5,hi=Math.ceil((Math.max(...vals)+2)/5)*5;const px=t=>pad.l+t/10*(w-pad.l-pad.r),py=v=>h-pad.b-(v-lo)/(hi-lo)*(h-pad.t-pad.b);ctx.font='12px system-ui';ctx.lineWidth=1;for(let i=0;i<=5;i++){const y=pad.t+i/5*(h-pad.t-pad.b);ctx.strokeStyle='#253548';ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillStyle='#a2b6c9';ctx.textAlign='right';ctx.fillText((hi-(hi-lo)*i/5).toFixed(0),pad.l-8,y+4);}for(let t=0;t<=10;t+=2){ctx.fillStyle='#a2b6c9';ctx.textAlign='center';ctx.fillText(String(t),px(t),h-10);}
for(const series of [2,1,3,4,5]){if(!visible[series-1])continue;ctx.strokeStyle=colors[series-1];ctx.lineWidth=series===2?1:2;ctx.globalAlpha=series===2?.55:1;ctx.setLineDash(series===1?[6,4]:[]);ctx.beginPath();rows.forEach((r,i)=>{if(i)ctx.lineTo(px(r[0]),py(r[series]));else ctx.moveTo(px(r[0]),py(r[series]));});ctx.stroke();}ctx.globalAlpha=1;ctx.setLineDash([]);if(!visible.some(Boolean)){ctx.fillStyle='#b8cbdc';ctx.font='16px system-ui';ctx.textAlign='center';ctx.fillText('勾选上方曲线名称即可显示',w/2,h/2);}}
function cCode(p){const f=v=>Number(v).toFixed(6)+'f';return `/* Pressure filter lab: C99, units kPa, sample rate 100 Hz.
 * Call filters_init() once, then filters_step(z_kpa) per sample.
 * ADC conversion, timer and UART are board-specific, not included.
 * Parameters below match the current simulation controls.
 * Re-initialize after changing parameters. */
#include <stddef.h>
#include <math.h>
#define FIR_N ${p.n}u
#define IIR_ALPHA ${f(p.alpha)}
#define KALMAN_Q ${f(p.q)} /* kPa^2 per sample */
#define KALMAN_R ${f(p.r)} /* kPa^2, must be > 0 */

typedef struct { float iir, fir, kalman; } FilterOutput;
static float iir_y, k_x, k_p;
static float samples[FIR_N];
static double fir_sum;
static size_t pos, count;
static int ready;

void filters_init(void)
{
    iir_y = k_x = 0.0f;
    k_p = KALMAN_R;
    fir_sum = 0.0;
    pos = count = 0u;
    ready = 0;
    /* Old array values are ignored until overwritten. */
}

FilterOutput filters_step(float z_kpa)
{
    FilterOutput out;
    if (!ready) {
        iir_y = k_x = z_kpa;
        k_p = KALMAN_R;
        ready = 1;
    } else {
        float p_pred, gain, a;
        iir_y += IIR_ALPHA * (z_kpa - iir_y);
        p_pred = k_p + KALMAN_Q;
        gain = p_pred / (p_pred + KALMAN_R);
        k_x += gain * (z_kpa - k_x);
        a = 1.0f - gain;
        /* Joseph covariance update. */
        k_p = a * a * p_pred + gain * gain * KALMAN_R;
    }
    if (count == FIR_N) fir_sum -= samples[pos];
    else ++count;
    samples[pos] = z_kpa;
    fir_sum += z_kpa;
    pos = (pos + 1u) % FIR_N;
    out.iir = iir_y;
    out.fir = (float)(fir_sum / (double)count);
    out.kalman = k_x;
    return out;
}

/* Checked entry: reject invalid input without changing state.
 * Rejected samples do not perform a Kalman prediction step.
 * Handle elapsed time / missing samples in your application. */
int filters_try_step(float z_kpa, FilterOutput *out)
{
    if (out == NULL || !isfinite(z_kpa)) return 0;
    *out = filters_step(z_kpa);
    return 1;
}

/* Example in your 10 ms sampling task:
 * float pressure_kpa = ...; // calibrated sensor measurement
 * FilterOutput y;
 * if (filters_try_step(pressure_kpa, &y)) {
 *     // Use y.iir, y.fir, or y.kalman.
 * } else {
 *     // Mark the measurement invalid; do not consume y.
 * }
 */
`;}
function update(){const p=params();defs.forEach(([id])=>$(id+'out').textContent=p[id]);last=simulate(p,$('signal').value,seed);draw(last);$('metrics').innerHTML=[2,3,4,5].map(j=>{const rmse=Math.sqrt(last.reduce((s,r)=>s+(r[j]-r[1])**2,0)/last.length);return `<div class="metric" style="--c:${colors[j-1]}"><span>${names[j-1]}</span><strong>${rmse.toFixed(2)}</strong><small>RMSE / kPa</small></div>`;}).join('');$('code').textContent=cCode(p);}
defs.forEach(([id])=>$(id).addEventListener('input',update));$('signal').addEventListener('change',update);$('noise').onclick=()=>{seed++;update();};$('match').onclick=()=>{$('r').value=Math.max(.1,params().sigma**2);update();};$('reset').onclick=()=>{defs.forEach(([id,a,b,c,v])=>$(id).value=v);$('signal').value='step';seed=42;update();};$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([cCode(params())],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='pressure_filters.c';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};window.addEventListener('resize',()=>draw(last));update();
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{defs.forEach(([id,a,c,d,v])=>$(id).value=v);$('signal').value='step';seed=42;if(b.dataset.preset==='iir')$('alpha').value=.05;if(b.dataset.preset==='fir')$('n').value=40;if(b.dataset.preset==='kalman')$('q').value=.8;update();document.querySelector('.workspace').scrollIntoView({behavior:'smooth',block:'start'});}));
