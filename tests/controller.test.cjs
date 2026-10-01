const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const M=require('../js/studio-model.js');
// Only the asset-loader and UI boundary are substituted; timing and controller
// state transitions run through the production controller and model.
function controller(loader=()=>Promise.resolve()){
  let outfit='autumn',now=0,paints=0;const messages=[],frames=[];
  const window={StudioModel:M,StudioEffects:{loadLook:loader}};
  const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,{querySelectorAll:()=>[],setAttribute(){},focus(){}});return elements.get(id);};
  const document={hidden:false,getElementById:element,querySelectorAll:()=>[],body:{classList:{add(){},remove(){}}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/studio-controller.js'),'utf8'),{window,document,performance:{now:()=>now},requestAnimationFrame(callback){frames.push(callback);return frames.length;},matchMedia:()=>({matches:false})});
  const c=Object.create(window.StudioController.prototype);
  Object.assign(c,{api:{stage:{style:{setProperty(){}}},settings:()=>({lightColor:'#ffd4a4',lightIntensity:.55}),context:()=>({characterId:'sweet',outfitId:outfit,useExpressions:true}),render(){paints++;},resize(){},notify(message){messages.push(message);}},time:1,previous:null,action:{id:'heart',start:0},frozen:null,idle:true,ready:true,paused:false,camera:false,countdown:new M.Countdown(),lastPaint:0,state:{...M.DEFAULTS},pendingResponse:null,queuedResponse:null});
  c.sync=()=>{};
  return {c,messages,frames,setHidden(value){document.hidden=value;},setOutfit(id){outfit=id;},setNow(value){now=value;},paints:()=>paints};
}
test('choosing another response preserves the visible pose before returning to neutral',async()=>{
  const {c}=controller();const amount=c.pose().amount;
  await c.respond('puff');
  assert.equal(c.pose().id,'heart');assert.equal(c.pose().amount,amount);
  c.time=1.3;c.tick(1300);
  assert.equal(c.pose().id,'puff');assert.equal(c.pose().amount,0);
  c.time=2;assert.equal(c.pose().amount,1);
});
test('rapid response requests retain only the last choice after the current gesture releases',async()=>{
  const {c}=controller();await c.respond('puff');await c.respond('smile');
  c.time=1.3;c.tick(1300);assert.equal(c.pose().id,'smile');
});
test('pressing the current action again does not restart its visible pose',async()=>{
  const {c}=controller();await c.respond('heart');assert.equal(c.action.start,0);assert.equal(c.pose().amount,1);
});
test('a stale failed asset request cannot clear a newer requested response',async()=>{
  const jobs=[];const {c,messages}=controller(()=>new Promise((resolve,reject)=>jobs.push({resolve,reject})));
  c.action=null;const first=c.respond('puff'),last=c.respond('heart');
  jobs[0].reject(new Error('old asset failed'));await first;jobs[1].resolve();await last;
  assert.equal(c.pose().id,'heart');assert.deepEqual(messages,[]);
});
test('camera choices still freeze the complete approved pose immediately',async()=>{
  const {c}=controller();c.camera=true;await c.respond('puff');assert.equal(c.pose().id,'puff');assert.equal(c.pose().amount,1);assert.equal(c.paused,true);
});

test('leaving the camera returns a running character to idle',async()=>{
  const {c}=controller();c.enterCamera();await c.respond('puff');c.exitCamera();
  assert.equal(c.paused,false);assert.equal(c.pose().active,false);assert.equal(c.pose().id,null);
});
test('leaving the camera respects a character that the user had already paused',async()=>{
  const {c}=controller();c.paused=true;c.enterCamera();await c.respond('puff');c.exitCamera();assert.equal(c.paused,true);
});

test('lighting continues to fade while a character is paused without advancing its pose',()=>{
  const {c,setNow,paints}=controller();c.paused=true;c.lightTransition=new M.LightTransition(M.lightTarget(c.api.settings(),c.state));
  c.setState({lightEnabled:false});const before=paints();setNow(140);c.tick(140);
  assert.ok(paints()>before,'pausing the character also stopped the lamp fade');assert.equal(c.time,1);
  assert.ok(c.options().lighting.power>0&&c.options().lighting.power<.55,'renderer did not receive the intermediate light');
  const last=paints();setNow(400);c.tick(400);assert.ok(paints()>last,'the last fade frame was never painted');assert.equal(c.options().lighting.power,0);
});

test('restoring a photograph immediately restores its saved light instead of an old fade',()=>{
  const {c}=controller();c.lightTransition=new M.LightTransition(M.lightTarget(c.api.settings(),c.state));
  c.restore({state:{...M.DEFAULTS,lightEnabled:false,lightX:.82},pose:{id:'heart',amount:1,active:true}});
  assert.equal(c.options().lighting.power,0);assert.equal(c.options().lighting.lightX,.82);
});

test('a paused settled studio stops requesting animation frames',()=>{
  const {c,frames,paints}=controller();c.paused=true;c.action=null;
  c.tick(100);assert.equal(frames.length,0,'paused studio still spins the frame loop');assert.equal(paints(),0);
});
test('a hidden page stops its loop and visible lighting changes wake a paused studio',()=>{
  const {c,frames,setHidden}=controller();c.lightTransition=new M.LightTransition(M.lightTarget(c.api.settings(),c.state));setHidden(true);c.tick(100);
  assert.equal(frames.length,0,'hidden page keeps scheduling work');
  setHidden(false);c.paused=true;c.action=null;c.setState({lightEnabled:false});
  assert.equal(frames.length,1,'changing light after idle did not restart rendering');
});
