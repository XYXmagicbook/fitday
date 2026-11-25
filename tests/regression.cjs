const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
function boot(saved) {
  const elements = new Map(), events = {}, timers = new Map();
  let serial = 0, stored = saved ? JSON.stringify(saved) : null;
  const element = key => {
    if (!elements.has(key)) elements.set(key, {innerHTML:'',textContent:'',value:'',classList:{toggle(){},add(){},remove(){}},setAttribute(){},removeAttribute(){}});
    return elements.get(key);
  };
  const ctx = {console:{error(){},warn(){}},Date,URL,
    navigator:{},location:{protocol:'http:',hostname:'test.invalid'},
    document:{querySelector:element,querySelectorAll:()=>[],documentElement:element('html'),addEventListener:(name,fn)=>events[name]=fn},
    localStorage:{getItem:()=>stored,setItem:(key,value)=>stored=value},
    setInterval:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},clearInterval:id=>timers.delete(id),
    setTimeout:()=>0,clearTimeout(){}};
  ctx.window = ctx; vm.createContext(ctx);
  for (const file of ['data-foods','data-exercises','data-courses','data-videos','ex-anim','engine','achievements','views','app']) vm.runInContext(read(`js/${file}.js`),ctx,{filename:`js/${file}.js`});
  return {ctx,element,getSaved:()=>JSON.parse(stored),click(action){events.click({target:{closest:sel=>sel==='[data-action]'?{dataset:{action}}:null},preventDefault(){}});},finish(){for(let i=0;i<7;i++) for(const timer of [...timers.values()]) if(timer.ms===700)timer.fn();}};
}
const profile = {name:'Regression',age:25,height:170,weight:65,sex:'female',goal:'recomp',days:'1,3,5',level:'beginner',activity:'mid',timePref:'evening',equip:'dumbbell',dayTimes:{},dayTimesExact:{}};
const env = boot();
let count = 0;
for(const goal of ['fatloss','muscle','keep','recomp']) for(const equip of ['none','dumbbell','gym']) for(const sex of ['female','male']) for(let mask=1;mask<127;mask++) {
 const days = Array.from({length:7},(_,i)=>i).filter(i=>mask&(1<<i));
 if(days.length<2||days.length>6)continue;
 const plan = env.ctx.FitEngine.buildPlan({...profile,goal,equip,sex,days:days.join(',')});
 assert.equal(plan.week.length,7);assert.equal(plan.week.filter(d=>d.type==='strength').length,days.length);
 assert.equal(plan.meals.length,4);assert.ok(Math.abs(plan.meals.reduce((s,m)=>s+m.pct,0)-1)<1e-10);
 assert.ok(plan.meals.every(m=>Number.isFinite(m.kcal)));count++;
}
Object.assign(env.ctx.App.S.ui,{obStep:3,obData:{...profile}});
env.click('obGen');assert.equal(env.ctx.App.S.ui.obStep,3.5);env.finish();
assert.equal(env.ctx.App.S.ui.obStep,4);assert.match(env.element('#app').innerHTML,/你的计划已就绪/);
const completed = env.getSaved();
env.click('obFinish');assert.equal(env.ctx.App.S.obDone,true);assert.ok(env.element('#app').innerHTML.length>100);
assert.equal(boot(env.getSaved()).ctx.App.S.plan.goal,'recomp');
const fail = boot();Object.assign(fail.ctx.App.S.ui,{obStep:3,obData:{...profile}});
const build = fail.ctx.FitEngine.buildPlan;fail.ctx.FitEngine.buildPlan=()=>{throw Error('injected failure');};
fail.click('obGen');fail.finish();assert.equal(fail.ctx.App.S.ui.obStep,3);assert.equal(fail.ctx.App.S.profile,null);
assert.match(fail.element('#toast').textContent,/重试/);assert.equal(fail.getSaved().ui.obData.name,profile.name);
fail.ctx.FitEngine.buildPlan=build;fail.click('obGen');fail.finish();assert.equal(fail.ctx.App.S.ui.obStep,4);
const savedSpinner=JSON.parse(JSON.stringify(completed));savedSpinner.profile=null;savedSpinner.plan=null;savedSpinner.ui.obStep=3.5;
assert.equal(boot(savedSpinner).ctx.App.S.ui.obStep,3);
const partial=JSON.parse(JSON.stringify(completed));partial.plan=null;partial.logs={'2026-11-01':{water:[{ml:300}]}};
const recovered=boot(partial);assert.equal(recovered.ctx.App.S.obDone,true);assert.equal(recovered.ctx.App.S.logs['2026-11-01'].water[0].ml,300);
for(const file of fs.readdirSync(path.join(root,'js')).filter(f=>f.endsWith('.js')))new vm.Script(read('js/'+file),{filename:file});
async function checkSW(){
 const events={},deleted=[],puts=[];let cacheName,assets,networkFail=false,networkStatus=200;
 const scope='https://example.test/fitday/';
 const cache={addAll:async a=>{assets=a;},put:async(req,res)=>puts.push(req.url),match:async req=>String(req).endsWith('index.html')?new Response('cached app'):undefined};
 const ctx={URL,Response,self:{registration:{scope},addEventListener:(n,fn)=>events[n]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async name=>{cacheName=name;return cache;},keys:async()=>['fitday-cache-%2Ffitday%2F-v24','fitday-cache-%2Ffitday-pro%2F-v25','unrelated'],delete:async key=>deleted.push(key)},fetch:async()=>{if(networkFail)throw Error('offline');return new Response('online',{status:networkStatus});}};
 vm.createContext(ctx);vm.runInContext(read('sw.js'),ctx);
 let pending;events.install({waitUntil:p=>pending=p});await pending;
 const index=read('index.html');for(const match of index.matchAll(/(?:src|href)="((?:js|css)\/[^\"]+)"/g))assert.ok(assets.includes('./'+match[1]),match[1]);
 events.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,['fitday-cache-%2Ffitday%2F-v24']);
 async function request(url,mode='cors'){let response;const work=[];events.fetch({request:{url,method:'GET',mode},waitUntil:p=>work.push(p),respondWith:p=>response=p});if(!response)return;const result=await response;await Promise.all(work);return result;}
 assert.equal(await(await request(scope+'js/app.js?v=25')).text(),'online');assert.equal(puts.length,1);
 networkStatus=404;await request(scope+'missing.js');assert.equal(puts.length,1);
 networkFail=true;assert.equal(await(await request(scope+'deep','navigate')).text(),'cached app');assert.equal((await request(scope+'missing.js')).type,'error');
 assert.equal(await request('https://example.test/fitday-pro/'),undefined);
 assert.equal(cacheName,'fitday-cache-%2Ffitday%2F-v25');
}
checkSW().then(()=>console.log(`PASS: ${count} plan combinations; onboarding, reload, injected failure/retry, history preservation; SW assets, cache isolation, offline fallback.`)).catch(error=>{console.error(error);process.exitCode=1;});
