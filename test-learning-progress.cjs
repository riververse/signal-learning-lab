'use strict';
// Offline rule, DOM-contract, storage and build regression tests. No browser/network.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const api=require('./learning-progress.js');
const profile=JSON.parse(fs.readFileSync(path.join(__dirname,'learning-profile.json'),'utf8'));
const clone=value=>JSON.parse(JSON.stringify(value));
let checks=0;
function eq(actual,expected,label){assert.deepEqual(actual,expected,label);checks++;}
function ok(value,label){assert.ok(value,label);checks++;}
function throws(fn,label){assert.throws(fn,undefined,label);checks++;}
function match(actual,pattern,label){assert.match(actual,pattern,label);checks++;}
const oldIds=['fourier-amplitude','fourier-overview','kalman-14','filters-impulse','filters-coefficients','filters-specification','sampling','spectrum-axis','spectrum-window','transfer-first-order','transfer-z','control-feedback','control-poles','pll-input','pll-loop','kalman-15','kalman-16'];
const stamp='2026-10-07T10:12:13.456Z';
const newer='2099-10-18T01:02:03.000Z'; // Deliberately later than runtime-created self-report fixtures.
const first='sampling-position-report', second='filters-frequency-delay';
const lesson=id=>api.lessons.find(item=>item.id===id);

class Element {
  constructor(tag,owner){this.tagName=tag.toUpperCase();this.owner=owner;this.children=[];this.dataset={};this.events={};this.attributes={};this.disabled=false;this.hidden=false;this.value='';this._text='';}
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  appendChild(node){node.parent=this;this.children.push(node);return node;}
  replaceChildren(...nodes){this.children=[];this._text='';nodes.forEach(node=>this.appendChild(node));}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
  setAttribute(key,value){this.attributes[key]=String(value);}
  addEventListener(type,callback){(this.events[type]??=[]).push(callback);}
  async fire(type,extra={}){for(const callback of this.events[type]||[])await callback({target:this,detail:1,...extra});}
  click(){this.clicked=true;return this.fire('click');}
  focus(){this.owner.activeElement=this;}
  querySelector(selector){
    if(selector==='[data-current="true"] a'){
      const row=this.children.find(x=>x.dataset.current==='true');return row?.walk().find(x=>x.tagName==='A')||null;
    }
    return null;
  }
  walk(){return this.children.flatMap(x=>[x,...x.walk()]);}
}
function mount(options={}){
  const model=api.createModel(options.profile||profile);
  const template=fs.readFileSync(path.join(__dirname,options.home?'index.html':options.preview?'preview-next-learning.template.html':'next-learning.template.html'),'utf8');
  const elements=new Map();const document={events:[],getElementById(id){return elements.get(id)||null;},createElement(tag){return new Element(tag,document);},dispatchEvent(event){this.events.push(event);}};
  document.body=new Element('body',document);
  if(!options.noPage)for(const [,id] of template.matchAll(/\bid="([^"]+)"/g)){const node=new Element('div',document);node.id=id;elements.set(id,node);}
  const store=new Map(options.saved===undefined?[]:[[api.key,options.saved]]), writes=[];
  const win={document,location:{search:options.search||'',pathname:options.pathname||(options.home?'/index.html':options.preview?'/preview-next-learning.html':'/next-learning.html')},events:{},exported:[],confirmValue:true,
    localStorage:{getItem(key){if(options.readError)throw Error('blocked');return store.get(key)||null;},setItem(key,value){if(options.writeError)throw Error('quota');writes.push([key,value]);store.set(key,value);}},
    addEventListener(type,callback){(this.events[type]??=[]).push(callback);},
    emit(type,event){for(const callback of this.events[type]||[])callback(event);},
    CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},
    Blob:class{constructor(parts,metadata){this.parts=parts;this.type=metadata.type;}},
    setTimeout(fn){fn();},confirm(){return this.confirmValue;}};
  win.URL={createObjectURL(blob){win.exported.push(blob);return 'blob:local-test';},revokeObjectURL(url){win.revoked=url;}};
  model.init(win);
  return {model,win,document,elements,store,writes,node:id=>elements.get(id),async import(raw,{size=0,text}={}){const node=elements.get('nl-import');node.files=[{size,text:text||(()=>Promise.resolve(typeof raw==='string'?raw:JSON.stringify(raw)))}];node.value='chosen.json';await node.fire('change');}};
}

async function main(){
  eq(profile.evidence[first].status,'pending','New independent question remains unverified');
  eq(profile.evidence[first].observedAt,'2026-10-21','Substantive question date is explicit');
  match(lesson(first).frontier,/不是傅里叶或卡尔曼课程的新进度/,'Sources remain distinct');
  eq([0,1,2].map(i=>i*.004*750),[0,3,6],'Synthetic position arithmetic');
  eq(1/.004,250,'Spatial increment condition is not asserted as tracking speed');
  eq(api.key,'river.learning.progress.v1','Storage key is unchanged');
  eq(api.emptyState(),{version:1,preferredTopic:'auto',completed:{}},'v1 shape is unchanged');
  eq(api.lessons.slice(0,17).map(x=>x.id),oldIds,'All original IDs and their base order remain');
  eq(api.lessons.length,21,'Preserve 20 prior steps and append one targeted step');
  eq(api.profile,profile,'Embedded data matches the curated JSON');
  ok(Object.isFrozen(api.profile)&&Object.isFrozen(api.lessons)&&Object.isFrozen(api.lessons[0]),'Profile and lessons cannot be mutated in place');
  eq(Object.values(profile.evidence).filter(x=>x.status==='independent-correct').length,0,'This review introduces no unsupported independent-correct evidence');
  for(const id of oldIds){
    const state=api.emptyState();state.completed[id]=stamp;
    eq(api.validateState(state),state,id+' import preserves timestamp');
    eq(api.validateState(JSON.parse(JSON.stringify(state))),state,id+' export round trip');
  }
  const allOld=api.emptyState();allOld.preferredTopic='kalman';oldIds.forEach((id,i)=>allOld.completed[id]=`2026-10-${String(i+1).padStart(2,'0')}T10:12:13.456Z`);
  const oldMount=mount({saved:JSON.stringify(allOld)});
  eq(oldMount.model.getState(),allOld,'Existing 17-item storage migrates without rewriting data');
  eq(oldMount.writes.length,0,'Initialization never rewrites old localStorage');
  eq(oldMount.store.get(api.key),JSON.stringify(allOld),'Original stored bytes are untouched');
  const state=api.emptyState();const before=clone(state);let recommendation=api.recommend(state);
  eq(recommendation.lesson.id,first,'Default recommendation targets the recent independent sampling question');
  eq(state,before,'Recommendations do not mark anything complete');
  for(const field of ['reason','prerequisiteText','frontier','verificationQuestion','evidenceStatus','evidenceLabel','evidenceSummary','estimatedMinutes','afterCheck','reviewedAt'])ok(recommendation[field],field+' is exposed');
  eq(recommendation.isPrerequisite,false,'Current filter question does not force stale prerequisites');
  eq(api.recommend(state,'transforms').lesson.id,'fourier-bin-check','Fourier priority uses latest unanswered check');
  eq(api.recommend(state,'kalman').lesson.id,'kalman-14','Kalman stays at lesson 14 verification');
  eq(api.recommend(state,'bogus').lesson.id,first,'Unknown direction falls back to current preference');
  state.preferredTopic='kalman';eq(api.recommend(state).lesson.id,'kalman-14','Saved direction is respected');
  eq(api.recommend(state,'iir-fir').lesson.id,second,'Explicit direction takes precedence');
  state.preferredTopic='auto';state.completed[first]=stamp;
  eq(api.recommend(state).lesson.id,second,'Completion returns to the older filter question');
  state.completed[second]=stamp;eq(api.recommend(state).lesson.id,'filters-design-families','Filter family question remains'); state.completed['filters-design-families']=stamp;eq(api.recommend(state).lesson.id,'fourier-bin-check','After filter questions, next parallel frontier is Fourier');
  delete state.completed[first];eq(api.recommend(state).lesson.id,first,'Undo restores missing prerequisite');
  eq(state.completed[second],stamp,'Undo preserves descendant completion history');
  delete state.completed[second];ok(!api.prerequisitesDone(lesson('filters-design-families'),state),'Undone filter prerequisite blocks dependent completion');
  const all=api.emptyState();api.lessons.forEach(x=>all.completed[x.id]=stamp);
  eq(api.recommend(all),null,'Finite list terminates');
  for(const topic of ['auto',...Object.keys(api.topics)])eq(api.recommend(all,topic),null,'Completed '+topic+' ends cleanly');
  const changed=clone(profile);changed.preferredPriority=['kalman-14',...changed.preferredPriority.filter(x=>x!=='kalman-14')];
  eq(api.createModel(changed).recommend(api.emptyState()).lesson.id,'kalman-14','Curated priority changes the default');
  eq(api.recommend(api.emptyState()).lesson.id,first,'Alternate profiles cannot mutate the original');
  const verified=clone(profile);verified.evidence[first]={status:'independent-correct',summary:'Synthetic test evidence only.'};
  const verifiedApi=api.createModel(verified);eq(verifiedApi.recommend(verifiedApi.emptyState()).lesson.id,second,'Independent evidence can satisfy a prerequisite');
  eq(verifiedApi.emptyState().completed,{},'Independent evidence does not become a local completion');
  const explained=clone(profile);explained.evidence[first].status='explained';eq(api.createModel(explained).recommend(api.emptyState()).lesson.id,first,'Explanation alone never satisfies a step');
  const deeper=clone(profile);deeper.evidence['fourier-overview']={status:'independent-correct',summary:'Synthetic test evidence only.'};
  const deeperApi=api.createModel(deeper);eq(deeperApi.recommend(api.emptyState(),'spectrum').lesson.id,'sampling','Verified prerequisite does not force earlier unrelated tasks');
  const dependency=clone(profile);dependency.preferredPriority=['filters-design-families',second,first];eq(api.createModel(dependency).recommend(api.emptyState()).isPrerequisite,true,'Priority still obeys explicit minimal prerequisite');

  const malformed=[null,[],{}, {version:2,preferredTopic:'auto',completed:{}},{version:1,preferredTopic:'unknown',completed:{}},{version:1,preferredTopic:'auto',completed:[]},{version:1,preferredTopic:'auto',completed:{},extra:true}];
  for(const value of malformed)throws(()=>api.validateState(value),'Malformed state rejected');
  for(const value of ['',false,1,null,'not-a-date','2026-02-30T00:00:00Z','2026-10-01T25:00:00Z','2026-10-01T00:61:00Z','2026-10-01T00:00:61Z','2026-10-01T00:00:00Z-extra'])throws(()=>api.validateState({version:1,preferredTopic:'auto',completed:{[first]:value}}),'Invalid timestamp rejected');
  for(const value of [stamp,'2026-10-01T00:00:00Z','2026-10-01T12:10:15+08:00'])eq(api.validateState({version:1,preferredTopic:'auto',completed:{[first]:value}}).completed[first],value,'Valid original timestamp preserved byte-for-byte');
  for(const key of ['__proto__','prototype','constructor','unknown-id']){
    const payload=JSON.parse('{"version":1,"preferredTopic":"auto","completed":{"'+key+'":"'+stamp+'"}}');
    throws(()=>api.validateState(payload),'Unsafe/unknown completion key rejected');
  }
  throws(()=>api.validateState(Object.assign(Object.create({polluted:true}),api.emptyState())),'Inherited state prototype rejected');
  eq({}.polluted,undefined,'Object prototype remains clean');
  for(const mutation of [p=>p.schemaVersion=2,p=>p.reviewedAt='2026-02-30',p=>p.lessonAdditions.push(clone(p.lessonAdditions[0])),p=>p.preferredPriority.push('missing'),p=>p.preferredPriority.push(first),p=>p.lessonOverrides.missing={title:'x'},p=>p.lessonOverrides['kalman-14'].id='changed',p=>p.lessonAdditions[0].prerequisites=['missing'],p=>p.lessonAdditions[0].prerequisites=[second],p=>p.evidence[first].status='mastered',p=>p.topicSummaries.push(clone(p.topicSummaries[0]))]){const p=clone(profile);mutation(p);throws(()=>api.createModel(p),'Invalid profile rejected');}
  for(const id of ['constructor','prototype','__proto__']){const p=clone(profile);p.lessonAdditions[0].id=id;throws(()=>api.createModel(p),'Reserved lesson ID cannot become an unsaveable completion');}
  for(const url of ['javascript:alert(1)','https://example.com/a.html','//example.com/a.html','../a.html','/a.html','a.html\n','a.html" onclick="x','data:text/html,x','a.html#x<script>','a.html?x=<script>','a.html?x=1#']){
    eq(api.safeLink(url),false,'Unsafe URL rejected: '+url);
    const p=clone(profile);p.lessonAdditions[0].href=url;throws(()=>api.createModel(p),'Bad lesson link prevents profile activation');
  }
  for(const item of [...api.lessons.flatMap(x=>[x.href,x.experiment]),...profile.topicSummaries.map(x=>x.href)]){
    ok(api.safeLink(item),'Safe local link: '+item);
    const [fileQuery,anchor]=item.split('#'),file=fileQuery.split('?')[0];ok(fs.existsSync(path.join(__dirname,file)),'Target exists: '+file);
    if(anchor)ok(fs.readFileSync(path.join(__dirname,file),'utf8').includes('id="'+anchor+'"'),'Anchor exists: '+item);
  }

  const fresh=mount();eq(fresh.model.getState().completed,{},'Opening page never marks completion');eq(fresh.writes.length,0,'Opening page never writes');
  eq(fresh.node('nl-lesson-title').textContent,lesson(first).title,'Live title uses current recommendation');
  eq(fresh.node('nl-evidence-status').textContent,'待独立作答','Live status distinguishes pending evidence');
  eq(fresh.node('nl-check-text').textContent,lesson(first).check,'Live check uses profile data');
  eq(fresh.model.getCurrentTopic(),'control','Existing question-helper topic API remains current');
  eq(fresh.model.setCompleted('filters-design-families',true),false,'UI blocks dependency completion');
  eq(fresh.model.setCompleted('__proto__',true),false,'UI rejects prototype key');
  await fresh.node('nl-complete').fire('click');
  eq(fresh.model.getRecommendation().lesson.id,second,'Explicit completion advances live card');
  const completedStamp=fresh.model.getState().completed[first];ok(completedStamp,'Explicit completion records timestamp');
  const writesAfter=fresh.writes.length;eq(fresh.model.setCompleted(first,true),true,'Repeated completion is idempotent');eq(fresh.writes.length,writesAfter,'Repeated completion does not rewrite time');eq(fresh.model.getState().completed[first],completedStamp,'Repeated completion preserves timestamp');
  await fresh.node('nl-complete').fire('click',{detail:2});eq(Object.keys(fresh.model.getState().completed).length,1,'Double click cannot complete the next lesson');
  await fresh.node('nl-complete').fire('click',{detail:1});eq(Object.keys(fresh.model.getState().completed).length,1,'Rapid repeated click cannot complete the next lesson');
  fresh.model.setCompleted(second,true);fresh.model.setCompleted(first,false);eq(fresh.model.getRecommendation().lesson.id,first,'Live undo updates recommendation');ok(fresh.model.getState().completed[second],'Live undo retains dependent history');
  fresh.node('nl-topic-select').value='kalman';await fresh.node('nl-topic-select').fire('change');eq(fresh.model.getRecommendation().lesson.id,'kalman-14','Direction changes recompute live card');eq(JSON.parse(fresh.store.get(api.key)).preferredTopic,'kalman','Direction persists in v1 format');
  const snapshot=fresh.model.getState();snapshot.completed['kalman-14']=stamp;eq(fresh.model.getState().completed['kalman-14'],undefined,'getState returns a defensive copy');
  await fresh.node('nl-export').fire('click');eq(JSON.parse(fresh.win.exported[0].parts[0]),fresh.model.getState(),'Export contains only v1 local state');eq(fresh.win.revoked,'blob:local-test','Export object URL is released');
  await fresh.import({version:1,preferredTopic:'transforms',completed:{'fourier-amplitude':stamp,[second]:newer}});eq(fresh.model.getState().completed[second],newer,'Import merges the latest timestamp');eq(fresh.model.getState().preferredTopic,'transforms','Import adopts saved preference');eq(fresh.model.getRecommendation().lesson.id,'fourier-bin-check','Imported old progress does not block newest Fourier frontier');
  await fresh.import({version:1,preferredTopic:'auto',completed:{[second]:stamp}});eq(fresh.model.getState().completed[second],newer,'Older import does not regress completion time');
  for(const raw of ['{broken',JSON.stringify({version:2}),'{"version":1,"preferredTopic":"auto","completed":{"__proto__":"'+stamp+'"}}']){const before=fresh.model.getState(),writes=fresh.writes.length;await fresh.import(raw);eq(fresh.model.getState(),before,'Invalid import leaves current state intact');eq(fresh.writes.length,writes,'Invalid import is never persisted');eq(fresh.node('nl-import').value,'','Import picker clears after invalid input');}
  const beforeBig=fresh.model.getState();await fresh.import(api.emptyState(),{size:65537});eq(fresh.model.getState(),beforeBig,'Oversized import is rejected');
  fresh.win.confirmValue=false;await fresh.node('nl-reset').fire('click');eq(fresh.model.getState(),beforeBig,'Cancel reset preserves records');
  fresh.win.confirmValue=true;await fresh.node('nl-reset').fire('click');eq(fresh.model.getState(),api.emptyState(),'Confirm reset clears only local state');eq(fresh.model.getRecommendation().lesson.id,first,'Reset returns to current profile');eq(fresh.model.profile,profile,'Reset never rewrites historical evidence');
  const importedState={version:1,preferredTopic:'kalman',completed:{'kalman-14':stamp}};
  fresh.win.emit('storage',{key:api.key,newValue:JSON.stringify(importedState),storageArea:fresh.win.localStorage});eq(fresh.model.getState(),importedState,'Cross-tab update is adopted');eq(fresh.model.getRecommendation().lesson.id,'kalman-15','Cross-tab update recomputes recommendation');
  fresh.win.emit('storage',{key:api.key,newValue:'{invalid'});eq(fresh.model.getState(),importedState,'Malformed cross-tab data leaves current view intact');
  fresh.win.emit('storage',{key:'unrelated',newValue:null});eq(fresh.model.getState(),importedState,'Other keys ignored');
  fresh.win.emit('storage',{key:api.key,newValue:null,storageArea:{}});eq(fresh.model.getState(),importedState,'Other storage areas ignored');
  fresh.win.emit('storage',{key:null,newValue:null});eq(fresh.model.getState(),api.emptyState(),'Cross-tab clear resets view');ok(fresh.document.events.some(x=>x.type==='river:progress'),'Existing progress notification remains available');
  const noStorage=mount({readError:true,writeError:true});noStorage.model.setCompleted(first,true);ok(noStorage.model.getState().completed[first],'Blocked storage still permits session-local progress');match(noStorage.node('nl-storage-note').textContent,/无法写入/,'Blocked storage warning shown');await noStorage.node('nl-export').fire('click');ok(noStorage.win.exported.length,'Blocked storage can still export backup');
  const corrupt=mount({saved:'{invalid'});eq(corrupt.store.get(api.key),'{invalid','Bad original data is not overwritten at startup');match(corrupt.node('nl-status').textContent,/无法读取/,'Corrupt storage is disclosed');
  for(const preview of [false,true]){const selected=mount({preview,search:'?topic=transforms'});eq(selected.model.getRecommendation().lesson.id,'fourier-bin-check','Query topic works for '+(preview?'preview':'formal')+' page');eq(selected.writes.length,0,'Query override does not auto-save');}
  eq(mount({search:'?topic=__proto__'}).model.getRecommendation().lesson.id,first,'Bad query topic ignored');
  const noPage=mount({noPage:true,saved:JSON.stringify(allOld)});eq(noPage.model.getState(),allOld,'Existing API works on pages without learning UI');
  const verifiedMount=mount({profile:verified});eq(verifiedMount.model.getState().completed,{},'Rendering verified evidence does not create local completion');eq(verifiedMount.writes.length,0,'Rendering evidence does not write storage');eq(verifiedMount.model.setCompleted(first,true),false,'No redundant manual mark is injected for verified task');const verifiedRow=verifiedMount.node('nl-lesson-list').children.find(x=>x.dataset.evidence==='independent-correct');match(verifiedRow.textContent,/已独立答对/,'Verified row has distinct status');match(verifiedRow.textContent,/没有写入本机打卡/,'Verified row explains storage separation');
  const historical=mount({profile:verified,saved:JSON.stringify({version:1,preferredTopic:'auto',completed:{[first]:stamp}})});eq(historical.model.getState().completed[first],stamp,'Later verification preserves historical manual timestamp');historical.model.setCompleted(first,false);eq(historical.model.getRecommendation().lesson.id,second,'Undoing self-report does not erase verified evidence');
  const done=mount({saved:JSON.stringify(all)});eq(done.node('nl-complete').hidden,true,'Finished route hides complete button');eq(done.node('nl-ask').hidden,true,'Finished route hides lesson-specific question');match(done.node('nl-lesson-title').textContent,/暂无待完成/,'Finished route does not imply universal mastery');
  let resolveOld,resolveNew;const race=mount();const oldImport=race.import({},{text:()=>new Promise(resolve=>resolveOld=resolve)});const newImport=race.import({},{text:()=>new Promise(resolve=>resolveNew=resolve)});resolveNew(JSON.stringify(importedState));await newImport;resolveOld(JSON.stringify(api.emptyState()));await oldImport;eq(race.model.getState(),importedState,'A delayed older import cannot replace newer choice');
  let resolvePending;const interrupted=race.import({},{text:()=>new Promise(resolve=>resolvePending=resolve)});await race.node('nl-reset').fire('click');resolvePending(JSON.stringify(importedState));await interrupted;eq(race.model.getState(),api.emptyState(),'Reset cancels an in-flight import');

  const home=mount({home:true});
  eq(home.node('rh-title').textContent,lesson(first).title,'Homepage uses the same current recommendation');
  eq(home.node('rh-link').href,lesson(first).href,'Homepage entry uses its current deep link');
  eq(home.node('rh-check').textContent,'小目标：'+lesson(first).check,'Homepage goal is independently verifiable');
  match(home.node('rh-evidence').textContent,/待独立作答/,'Homepage does not claim mastery');
  eq(home.writes.length,0,'Opening homepage never writes manual state');
  const chosen={version:1,preferredTopic:'kalman',completed:{'kalman-14':stamp}};
  const chosenHome=mount({home:true,saved:JSON.stringify(chosen)});
  eq(chosenHome.node('rh-title').textContent,lesson('kalman-15').title,'Homepage respects stored direction and self-report');
  eq(chosenHome.store.get(api.key),JSON.stringify(chosen),'Stored timestamps and preference are byte-preserved');
  eq(chosenHome.writes.length,0,'Home rendering does not rewrite existing progress');
  chosenHome.win.emit('storage',{key:api.key,newValue:JSON.stringify(api.emptyState()),storageArea:chosenHome.win.localStorage});
  eq(chosenHome.node('rh-title').textContent,lesson(first).title,'Home responds to cross-tab reset');
  chosenHome.win.emit('storage',{key:api.key,newValue:JSON.stringify(chosen),storageArea:chosenHome.win.localStorage});
  eq(chosenHome.node('rh-title').textContent,lesson('kalman-15').title,'Home responds to cross-tab completion');
  chosenHome.win.emit('storage',{key:api.key,newValue:'{broken'});
  eq(chosenHome.node('rh-title').textContent,lesson('kalman-15').title,'Malformed cross-tab state keeps home recommendation');
  chosenHome.store.set(api.key,JSON.stringify(api.emptyState()));
  chosenHome.win.emit('pageshow',{persisted:true});
  eq(chosenHome.node('rh-title').textContent,lesson(first).title,'Back-forward cache restores current home recommendation');
  chosenHome.store.set(api.key,JSON.stringify(chosen));
  chosenHome.win.emit('pageshow',{persisted:true});
  eq(chosenHome.node('rh-link').href,lesson('kalman-15').href,'Repeated Back reads current selection rather than stale link');
  eq(chosenHome.writes.length,0,'Storage and pageshow refreshes never write');
  const badHome=mount({home:true,saved:'{invalid'});
  eq(badHome.store.get(api.key),'{invalid','Homepage leaves corrupt local record recoverable');
  match(badHome.node('rh-storage').textContent,/无法读取/,'Homepage discloses unreadable state');
  const blockedHome=mount({home:true,readError:true});
  eq(blockedHome.node('rh-title').textContent,lesson(first).title,'Blocked storage uses curated fallback');
  eq(blockedHome.writes.length,0,'Blocked storage never triggers reset');
  const doneHome=mount({home:true,saved:JSON.stringify(all)});
  match(doneHome.node('rh-title').textContent,/暂无待完成/,'Home shows bounded completion, not mastery');
  eq(doneHome.node('rh-link').href,'next-learning.html','Completed home still has a valid next-action entry');
  const homeHTML=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  match(homeHTML,/轻量复习备选/,'Old filter diagram is explicitly a review alternative');
  match(homeHTML,/notes-iir-fir.html#filter-average/,'Existing filter review remains reachable');

  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'river-learning-tests-'));
  try{
    for(const file of ['learning-profile.json','learning-progress.js','next-learning.template.html','preview-next-learning.template.html','index.html'])fs.copyFileSync(path.join(__dirname,file),path.join(directory,file));
    const run=(...args)=>spawnSync('python',[path.join(__dirname,'build-next-learning.py'),'--directory',directory,...args],{encoding:'utf8'});
    let result=run();eq(result.status,0,'Offline generator succeeds: '+result.stderr);
    const generated=['learning-progress.js','next-learning.html','preview-next-learning.html','index.html'];const firstBuild=generated.map(file=>fs.readFileSync(path.join(directory,file),'utf8'));
    result=run();eq(result.status,0,'Second generation succeeds');eq(generated.map(file=>fs.readFileSync(path.join(directory,file),'utf8')),firstBuild,'Generation is byte-for-byte deterministic');eq(run('--check').status,0,'Check mode confirms generated files');
    for(const name of ['next-learning.html','preview-next-learning.html']){const html=fs.readFileSync(path.join(directory,name),'utf8');ok(html.includes(lesson(first).title),'Fallback title agrees with live default');ok(html.includes(lesson(first).check),'Fallback check agrees with live default');ok(html.includes('待独立作答'),'Fallback evidence status agrees with live default');ok(!html.includes('{{'),'All fallback tokens resolved');}
    match(fs.readFileSync(path.join(directory,'index.html'),'utf8'),/id="rh-title">位置报得准/,'No-script homepage fallback matches recommendation');
    fs.appendFileSync(path.join(directory,'next-learning.html'),'stale');ok(run('--check').status!==0,'Check mode detects stale output');
    const future=clone(profile);future.preferredPriority=['kalman-14',...future.preferredPriority.filter(x=>x!=='kalman-14')];fs.writeFileSync(path.join(directory,'learning-profile.json'),JSON.stringify(future));eq(run().status,0,'New curated priority regenerates output');match(fs.readFileSync(path.join(directory,'next-learning.html'),'utf8'),/<h2 id="nl-lesson-title">第 14 讲/,'Fallback follows updated priority, not hard-coded first task');
    match(fs.readFileSync(path.join(directory,'index.html'),'utf8'),/id="rh-title">第 14 讲/,'Homepage fallback follows future curated priority');
    const unsafe=clone(profile);unsafe.lessonAdditions.find(x=>x.id===first).title='</script><img src=x onerror="alert(1)"> & "';unsafe.topicSummaries[0].summary='<script>alert(2)</script>';fs.writeFileSync(path.join(directory,'learning-profile.json'),JSON.stringify(unsafe));eq(run().status,0,'Ordinary text with HTML characters is safely escaped');const escaped=fs.readFileSync(path.join(directory,'next-learning.html'),'utf8');ok(escaped.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'),'HTML markup in text is escaped');ok(!escaped.includes('<script>alert(2)</script>'),'Evidence text cannot inject executable markup');ok(!fs.readFileSync(path.join(directory,'learning-progress.js'),'utf8').includes('</script>'),'Embedded JSON is safe if script is inlined');
    const escapedHome=fs.readFileSync(path.join(directory,'index.html'),'utf8');ok(escapedHome.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'),'Homepage fallback escapes unsafe text');ok(!escapedHome.includes('</script><img src=x'),'Homepage title cannot inject markup');
    const safeOutputs=generated.map(file=>fs.readFileSync(path.join(directory,file),'utf8'));unsafe.lessonAdditions[0].href='javascript:alert(1)';fs.writeFileSync(path.join(directory,'learning-profile.json'),JSON.stringify(unsafe));ok(run().status!==0,'Unsafe profile link fails generation');eq(generated.map(file=>fs.readFileSync(path.join(directory,file),'utf8')),safeOutputs,'Invalid profile does not partially overwrite outputs');
    const savedHome=fs.readFileSync(path.join(directory,'index.html'),'utf8');fs.writeFileSync(path.join(directory,'index.html'),savedHome.replace('<!-- END GENERATED HOME RECOMMENDATION -->',''));ok(run().status!==0,'Missing homepage marker fails safely');fs.writeFileSync(path.join(directory,'index.html'),savedHome);
    fs.writeFileSync(path.join(directory,'learning-profile.json'),JSON.stringify(profile));fs.appendFileSync(path.join(directory,'next-learning.template.html'),'{{UNKNOWN_TOKEN}}');ok(run().status!==0,'Unknown tokens fail instead of leaking into generated UI');
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
  console.log(JSON.stringify({status:'PASS',checks,scope:'Homepage same-model recommendations, storage and back/forward refresh; 21-step evidence-aware engine; all 17 v1 IDs; storage/import/export/undo/cross-tab; priorities and verified prerequisites; safe links; deterministic formal + preview generation. Offline DOM-contract tests, not visual browser QA.'},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
