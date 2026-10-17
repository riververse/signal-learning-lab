'use strict';
// Offline routing tests only; does not initialize a browser or send any question.
const assert=require('node:assert/strict');
const helper=require('./question-helper.js');
let checks=0;
function equal(actual,expected,label){assert.equal(actual,expected,label);checks++;}
for(const path of ['/engineering-cases.html','/signal-learning-lab/engineering-cases.html','engineering-cases.html']){
 for(const hash of ['','#nxp-magnetic-calibration','#adi-vibration-chain','#ti-ultrasonic-level']){
  const topic=helper.inferTopic(path,'',hash,'');
  equal(topic,'',`${path}${hash} stays general`);
  equal(helper.findGlossary('',topic),null,'No unrelated default glossary');
 }
}
for(const query of ['','?case=nxp','?topic=unknown'])equal(helper.inferTopic('/engineering-cases.html',query,'',''),'','No implicit topic from case basename');
equal(helper.inferTopic('/engineering-cases.html','?topic=kalman','',''),'kalman','Explicit query still takes precedence');
equal(helper.inferTopic('/engineering-cases.html','','','spectrum'),'spectrum','Explicit page topic still takes precedence');
equal(helper.inferTopic('/engineering-cases.html','?topic=kalman','','spectrum'),'kalman','Query overrides explicit page topic as before');
for(const hash of ['','#fir','#iir','#kf'])equal(helper.inferTopic('/engineering.html','',hash,''),'iir-fir','Legacy engineering page unchanged');
const routes={
 '/hardware-filters.html':'iir-fir','/notes-iir-fir.html':'iir-fir','/frequency.html':'iir-fir',
 '/pressure.html':'iir-fir','/kalman.html':'kalman','/notes-kalman.html':'kalman',
 '/transforms.html':'transforms','/notes-transforms.html':'transforms','/motion.html':'control',
 '/knowledge.html':'','/exploration.html':'','/index.html':'','/next-learning.html':''
};
for(const [path,topic] of Object.entries(routes))equal(helper.inferTopic(path,'','',''),topic,path+' unchanged');
for(const [query,topic] of [['','iir-fir'],['?scenario=pressure','iir-fir'],['?scenario=motion','control'],['?scenario=frequency','spectrum']])equal(helper.inferTopic('/simulation.html',query,'',''),topic,'Simulation routing unchanged');
equal(helper.inferTopic('/future-learning.html','','#automatic-control',''),'control','Legacy control hash unchanged');
equal(helper.inferTopic('/future-learning.html','','#spectral-analysis',''),'spectrum','Legacy spectrum hash unchanged');
equal(helper.inferTopic('/future-learning.html','','#transfer-functions',''),'transfer','Legacy transfer hash unchanged');
equal(helper.findGlossary('NXP 磁校准',''),null,'NXP question does not get unrelated default');
equal(helper.findGlossary('TI 超声液位',''),null,'TI question does not get unrelated default');
equal(helper.findGlossary('FIR 窗口','').topic,'iir-fir','Question keyword matching retained');
equal(helper.findGlossary('FPGA 硬件滤波','').href,'hardware-filters.html','Hardware glossary retained');
const prompt=helper.composePrompt({topic:helper.inferTopic('/engineering-cases.html','','#nxp-magnetic-calibration',''),page:'企业工程案例'},'NXP 磁校准','explain','',true);
assert.match(prompt,/当前主题：信号处理。/);checks++;
assert.doesNotMatch(prompt,/当前主题：IIR \/ FIR/);checks++;
console.log(JSON.stringify({status:'PASS',checks,scope:'General engineering case context; explicit overrides, old routes, glossary and prompt preserved'},null,2));
