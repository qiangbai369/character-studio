const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../js/studio-model.js');

test('legacy versions get usable defaults and corrupted studio data stays bounded',()=>{
  assert.deepEqual(M.sanitize(),{...M.DEFAULTS});
  const s=M.sanitize({scene:'<script>',crop:'other',lightX:Infinity,lightY:-5,lightEnabled:false});
  assert.equal(s.scene,'studio');assert.equal(s.crop,'full');assert.equal(s.lightX,.22);assert.equal(s.lightY,.1);assert.equal(s.lightEnabled,false);
});
test('every response ends, replacement starts cleanly, saved poses are finite',()=>{
  for(const id of Object.keys(M.DURATIONS)){
    assert.equal(M.sample(10,{id,start:10},false).amount,0);
    assert.ok(M.sample(10.5,{id,start:10},false).amount>0);
    assert.equal(M.sample(20,{id,start:10},false).active,false);
  }
  const p=M.poseSnapshot({time:Infinity,amount:NaN,blink:7,id:'unsafe'});
  assert.ok(Number.isFinite(p.time));assert.equal(p.id,null);assert.equal(p.blink,1);
});
test('breathing and responses keep soles anchored without inverting row order',()=>{
  for(const character of ['sweet','cool','literary'])for(const id of Object.keys(M.DURATIONS))for(const t of [0,.3,1,2,4]){
    const pose=M.sample(t,{id,start:0},true);
    assert.deepEqual(M.rowMotion(1,600,1500,pose,character),{x:0,y:0});
    let previous=-Infinity;
    for(let y=0;y<=1500;y+=2){const d=M.rowMotion(y/1500,600,1500,pose,character);const v=y+d.y;assert.ok(v>previous);previous=v;}
  }
});
test('a cancelled or completed countdown cannot emit a later duplicate photograph',()=>{
  const c=new M.Countdown();c.start(100);assert.equal(c.tick(100).remaining,3);
  assert.equal(c.tick(1100).remaining,2);c.cancel();assert.equal(c.tick(4000).capture,false);
  c.start(5000);assert.equal(c.tick(8000).capture,true);assert.equal(c.tick(8001).capture,false);
});
test('all photo scenes have bounded image windows and space for caption outside the photograph',()=>{
  for(const scene of ['studio','magazine','polaroid']){
    const l=M.layout(1200,1500,scene);
    assert.ok(l.x>=0&&l.y>=0&&l.x+l.width<=1200&&l.y+l.height<=1500);
    if(scene==='polaroid')assert.ok(l.y+l.height<1500*.9);
  }
});

test('all photo formats and restored composition are bounded and retain safe captions',()=>{
  for(const ratio of ['portrait','square','wallpaper']){const size=M.photoSize(ratio);assert.ok(size.width>0&&size.height>0);assert.equal(M.sanitize({ratio}).ratio,ratio);}
  assert.deepEqual(M.photoSize('square'),{width:1200,height:1200});
  const state=M.sanitize({scale:Infinity,offsetX:999,offsetY:-999,ratio:'bad',caption:'a\n'.repeat(50),showDate:'true'});
  assert.equal(state.scale,1);assert.equal(state.offsetX,.15);assert.equal(state.offsetY,-.12);assert.equal(state.caption.length,26);assert.equal(state.showDate,false);
  assert.deepEqual(M.sanitize(JSON.parse(JSON.stringify(state))),state);
});
test('daily OOTD excludes the current look and handles random endpoints and single-look uploads',()=>{
  const looks=['a','b','c'];for(const random of [()=>0,()=>.5,()=>1,()=>NaN])assert.notEqual(M.pickDaily(looks,'b',random),'b');
  assert.equal(M.pickDaily(['a'],'a'),'a');
});
test('new cool and literary responses use pose assets without deforming the neck',()=>{
  for(const character of ['cool','literary'])for(const [id] of M.PROFILES[character].actions){
    const p=M.sample(.7,{id,start:0},false);assert.equal(p.amount,1);
    for(const y of [.1,.2,.3,.4,.9])assert.deepEqual(M.rowMotion(y,600,1500,p,character),{x:0,y:0});
    assert.equal(M.sample(4,{id,start:0},false).active,false);
  }
});
test('sweet finger-heart replaces greeting and keeps the head upright',()=>{
  assert.deepEqual(M.PROFILES.sweet.actions.map(a=>a[0]),['smile','puff','heart']);
  const pose=M.sample(.7,{id:'heart',start:0},false);
  assert.equal(pose.amount,1);
  for(const y of [.1,.2,.3,.4,.9])assert.deepEqual(M.rowMotion(y,600,1500,pose,'sweet'),{x:0,y:0});
  const old=M.poseSnapshot({id:'hello',amount:1,active:true});
  assert.equal(old.id,'heart','saved old greetings should restore as the approved finger-heart');
});

// A replacement must return the previous gesture to neutral instead of resetting it.
test('an interrupted response releases from its visible amount and ends at neutral',()=>{
  const action={id:'heart',start:0,releaseAt:1,releaseAmount:.8};
  assert.equal(M.sample(1,action,false).amount,.8);
  const middle=M.sample(1.12,action,false);
  assert.equal(middle.id,'heart');assert.ok(middle.amount>.25&&middle.amount<.55);
  const end=M.sample(1.25,action,false);assert.equal(end.active,false);assert.equal(end.amount,0);
});

test('gesture anticipation settles without moving planted feet or changing a frozen photograph',()=>{
  const pose={time:1,idle:true,id:'peace',amount:0,progress:.1};
  const neutral=M.rowMotion(.35,600,1500,pose,'cool');
  const moving=M.rowMotion(.35,600,1500,{...pose,amount:.5},'cool');
  assert.ok(Math.abs(moving.x-neutral.x)>.2,'gesture has no anticipatory motion');
  assert.deepEqual(M.rowMotion(.35,600,1500,{...pose,amount:1},'cool'),neutral);
  assert.deepEqual(M.rowMotion(1,600,1500,{...pose,amount:.5},'cool'),{x:0,y:0});
  assert.deepEqual(M.rowMotion(.35,600,1500,{...pose,idle:false,amount:.5},'cool'),{x:0,y:0});
});
