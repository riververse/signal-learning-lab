'use strict';
/* Offline palette-only release guard. No browser, network, downloads or package dependencies.
   The committed manifest records the pre-restyle baseline, not outputs regenerated from
   the changed engine. Run: node test-renderer-palettes.cjs
   Optional direct comparison: node test-renderer-palettes.cjs --baseline ../base */
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const ROOT=__dirname;
const FILES=['app.js','frequency.js','transforms.js','kalman.js','engineering.js','learning-visuals.js','notes-iir-fir.js','filter-families.js','hardware-filters.js','signal-motion.js'];
const digest=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const normalize=source=>source.replace(/#[\da-fA-F]{3,8}\b/g,'#PALETTE');
const read=(root,file)=>fs.readFileSync(path.join(root,file),'utf8');
function scripts(html){return [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match=>match[1]).filter(source=>source.trim());}
function cjs(source){const sandbox={module:{exports:{}}};vm.runInNewContext(source,sandbox,{timeout:10000});return sandbox.module.exports;}
function isolate(source,start,end,expression){const first=source.indexOf(start),last=source.indexOf(end,first);assert.ok(first>=0&&last>first,'Pure function extraction boundary exists');return vm.runInNewContext(source.slice(first,last)+'\n;('+expression+');',{}, {timeout:10000});}
function countNumbers(value){if(typeof value==='number')return 1;if(Array.isArray(value))return value.reduce((sum,x)=>sum+countNumbers(x),0);if(value&&typeof value==='object')return Object.values(value).reduce((sum,x)=>sum+countNumbers(x),0);return 0;}
function capture(root){
 const result={normalizedSources:{},immutableInlineScripts:{},numeric:{},numericScalars:0};
 for(const file of FILES)result.normalizedSources[file]=digest(normalize(read(root,file)));
 const inline=scripts(read(root,'motion.html'));
 const renderer=inline.find(source=>source.includes("const palette=[")&&source.includes('function chart('));
 assert.ok(renderer,'Motion renderer exists');result.normalizedSources['motion.html:renderer']=digest(normalize(renderer));
 const kernel=inline.find(source=>source.includes('root.FilterCore = api;'));
 const teaching=inline.find(source=>source.includes('root.Teaching = Teaching;'));
 const research=inline.find(source=>source.includes('window.Research ='));
 for(const [name,source] of Object.entries({kernel,teaching,research})){assert.ok(source,'Motion '+name+' exists');result.immutableInlineScripts[name]=digest(source);}
 function sample(name,value){result.numeric[name]=digest(value);result.numericScalars+=countNumbers(value);}
 const pressure=isolate(read(root,'app.js'),'function simulate(', 'function draw(', 'simulate');
 for(const kind of ['step','sine','ramp','constant'])for(const seed of [0,42,123456789])for(const sigma of [0,2,8])sample(`pressure:${kind}:${seed}:${sigma}`,pressure({sigma,alpha:.15,n:15,q:.08,r:4},kind,seed));
 const frequency=cjs(read(root,'frequency.js'));
 for(const type of ['low','high'])for(const fc of [.1,2,10,40]){
  const section=frequency.section(type,fc,100);sample(`section:${type}:${fc}`,section);
  for(const f of [0,1,3,10,25,49])sample(`frequency:${type}:${fc}:${f}`,frequency.response(section,f,100));
  sample(`emaAlpha:${type}:${fc}`,frequency.emaAlpha(fc,100));
 }
 sample('cascade',frequency.cascade({re:.2,im:-.3},{re:.5,im:.1}));
 const engineering=cjs(read(root,'engineering.js'));
 for(const length of [3,15,31,63])for(const fc of [2,10,25]){const b=engineering.firDesign(length,fc,100);sample(`fir:${length}:${fc}`,b);sample(`fir-magnitude:${length}:${fc}`,[0,1,10,25,49].map(f=>engineering.magnitude(b,[1],f,100)));}
 for(const order of [2,4,6])for(const fc of [1,10,30])sample(`butter:${order}:${fc}`,engineering.butterDesign(order,fc,100));
 for(const sigma of [.1,1,4])for(const q of [.01,.1,1])for(const R of [.1,4])sample(`tracking:${sigma}:${q}:${R}`,engineering.tracking(sigma,q,R));
 sample('kalmanStep',engineering.kalmanStep({x:[100,20],P:[4,0,0,100]},100.4,.01,.1,4));
 const variance=isolate(read(root,'kalman.js'),'function variance(', 'function draw(', 'variance');sample('variance',Array.from({length:101},(_,i)=>variance(i/100)));
 const complex=isolate(read(root,'transforms.js'),'function complex(', 'function fourier(', 'complex');sample('complex-format',[[0,0],[3,4],[-3,-4],[.001,-.002]].map(([r,i])=>complex(r,i)));
 const visuals=isolate(read(root,'learning-visuals.js'),'  const clean =', '  const line =', '({phaseValues,gainValues})');
 sample('phase-values',[0,30,45,60,90,120,180,270,360].map(visuals.phaseValues));sample('gain-values',[1,4,16,32,64,100,256].map(visuals.gainValues));
 const impulse=cjs(read(root,'notes-iir-fir.js')).impulse;
 for(const length of [1,4,8,16])for(const alpha of [.1,.25,.5,1])sample(`impulse:${length}:${alpha}`,impulse(length,alpha,64));
 const hardware=cjs(read(root,'hardware-filters.js'));
 for(const fc of [0,50,100,200])for(const kind of ['none','fir','iir'])sample(`alias:${fc}:${kind}`,hardware.calculate(fc,kind));
 for(const kind of ['fir','iir'])sample('hardware-impulse:'+kind,Array.from({length:32},(_,n)=>hardware.impulse(kind,n)));
 const families=cjs(read(root,'filter-families.js'));
 for(const family of ['butter','cheby1'])for(const order of [2,4,6])for(const ripple of [.5,1,3]){sample(`family:${family}:${order}:${ripple}`,[0,10,50,100,200,400,499].map(f=>families.response(family,f,order,ripple)));sample(`family-path:${family}:${order}:${ripple}`,families.path(family,order,ripple,400,-60));}
 const core=cjs(kernel),teach=cjs(teaching);
 for(const scenario of core.scenarios)for(const seed of [0,42,987654321]){
  const data=core.generate({scenario:scenario.id,fs:100,duration:2,noise:.12,spikes:.02,hum:.05,seed});
  sample(`motion-data:${scenario.id}:${seed}`,data);
  for(const id of Object.keys(teach.algorithms)){const output=core.run(id,data,{window:15,cutoff:5,notch:20,notchQ:10,q:.01,alpha:.35,beta:.03,euroBeta:.04,mu:.1,threshold:3,maxRate:60,deadband:.5,tau:.5});sample(`motion:${scenario.id}:${seed}:${id}`,output);sample(`motion-metrics:${scenario.id}:${seed}:${id}`,core.metrics(output,data));}
  sample(`motion-spectrum:${scenario.id}:${seed}`,core.spectrum(data.measured,100,{removeMean:true}));
 }
 return result;
}
function contrast(hex,background='#FFFFFF'){
 function lum(value){const rgb=value.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
 const a=lum(hex),b=lum(background);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
function main(){
 let checks=0;const manifest=JSON.parse(read(ROOT,'renderer-palette-baseline.json'));const actual=capture(ROOT);
 for(const [name,hash] of Object.entries(manifest.normalizedSources)){assert.equal(actual.normalizedSources[name],hash,'Only color literals may change: '+name);checks++;}
 for(const [name,hash] of Object.entries(manifest.immutableInlineScripts)){assert.equal(actual.immutableInlineScripts[name],hash,'Motion '+name+' must remain byte-identical');checks++;}
 for(const [name,hash] of Object.entries(manifest.numeric)){assert.equal(actual.numeric[name],hash,'Numerical baseline must remain exact: '+name);checks++;}
 assert.equal(actual.numericScalars,manifest.numericScalars);checks++;
 const compareIndex=process.argv.indexOf('--baseline');
 if(compareIndex>=0){const original=capture(path.resolve(ROOT,process.argv[compareIndex+1]));assert.deepEqual(actual,original,'Direct comparison to original source and numerical baseline');checks++;}
 // Text satisfies WCAG normal-text contrast on both supported light chart surfaces;
 // traces satisfy the graphical-object 3:1 threshold without depending on glow.
 for(const color of ['#202734','#606B7D'])for(const background of ['#FFFFFF','#F2F5FA']){assert.ok(contrast(color,background)>=4.5,`Readable labels: ${color} on ${background}`);checks++;}
 for(const color of ['#4B43E8','#087D70','#1D64B3','#9A5800','#8748A7','#B74167'])for(const background of ['#FFFFFF','#F2F5FA']){assert.ok(contrast(color,background)>=3,`Visible trace: ${color} on ${background}`);checks++;}
 const renderer=scripts(read(ROOT,'motion.html')).find(x=>x.includes('function chart('));
 assert.ok(renderer.includes("ctx.fillStyle='#FFFFFF'"),'Motion canvas has a white painted surface');checks++;
 assert.ok(read(ROOT,'learning-visuals.js').includes('fill="#FFFFFF"'),'Generated uncertainty SVG has a white surface');checks++;
 assert.ok(read(ROOT,'signal-motion.js').includes('g[stroke="#7bdacf"] > path'),'Existing PLL selector remains unchanged');checks++;
 const palette=vm.runInNewContext(renderer.slice(renderer.indexOf('const palette='),renderer.indexOf('const defaults='))+';palette');assert.equal(new Set(palette).size,4,'All four motion traces remain distinguishable');checks++;
 for(const file of FILES){new vm.Script(read(ROOT,file),{filename:file});checks++;}
 new vm.Script(renderer,{filename:'motion.html:renderer'});checks++;
 console.log(JSON.stringify({status:'PASS',checks,numericCases:Object.keys(actual.numeric).length,numericScalars:actual.numericScalars,scope:'Palette-only normalized-source equality; motion kernel/teaching/research byte equality; exact deterministic numeric baseline; light-surface text/trace contrast; script syntax. No browser visual QA.'},null,2));
}
if(require.main===module)main();
module.exports={capture,digest,contrast};
