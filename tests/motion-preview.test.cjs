const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../previews/sweet-motion-v1/motion-model.js');

test('pausing freezes the action clock and resuming does not jump to the end',()=>{
  const c=new M.MotionClock();
  c.advance(0); c.advance(40);
  assert.equal(c.time,.04);
  c.advance(4000,true); c.advance(8000,true);
  assert.equal(c.time,.04);
  c.advance(8040);
  assert.equal(c.time,.08);
});

test('both shoes stay planted throughout idle and every gesture',()=>{
  for(const id of [null,'puff','wave','smile'])for(let time=0;time<6;time+=.13){
    const pose=M.sample(time,id?{id,start:0}:null,true);
    for(const x of [390,640])assert.deepEqual(M.point(x,1494,1024,1536,pose),{x,y:1494});
  }
});

test('gestures begin and end at the base pose and rapid replacements have independent timing',()=>{
  assert.equal(M.sample(10,{id:'puff',start:10}).amount,0);
  assert.equal(M.sample(10.4,{id:'puff',start:10}).amount,1);
  assert.equal(M.sample(14,{id:'puff',start:10}).active,false);
  assert.equal(M.sample(12.1,{id:'wave',start:12}).id,'wave');
  assert.equal(M.sample(20,{id:'unknown',start:0}).active,false);
});

test('switching the source across the girl reverses the projected shadow direction',()=>{
  assert.ok(M.lighting({...M.DEFAULT_LIGHT,x:.18}).shadowX>0);
  assert.ok(M.lighting({...M.DEFAULT_LIGHT,x:.83}).shadowX<0);
  const off=M.lighting({...M.DEFAULT_LIGHT,enabled:false});
  assert.equal(off.power,0); assert.equal(off.shadowX,0);
  assert.equal(M.lighting({...M.DEFAULT_LIGHT,intensity:0}).shadowX,0);
});

test('light input stays finite and inside the stage even with corrupt saved values',()=>{
  const l=M.sanitizeLight({color:'url(x)',x:Infinity,y:-20,intensity:NaN});
  assert.equal(l.color,M.DEFAULT_LIGHT.color);
  assert.equal(l.x,M.DEFAULT_LIGHT.x);
  assert.equal(l.y,.1);
  assert.equal(l.intensity,M.DEFAULT_LIGHT.intensity);
});

test('mesh triangles never invert across animation phases',()=>{
  const area=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  for(const id of ['puff','wave','smile'])for(let time=0;time<4;time+=.17){
    const pose=M.sample(time,{id,start:0},true);
    for(let iy=0;iy<24;iy++)for(let ix=0;ix<10;ix++){
      const p=(x,y)=>M.point(x*1024/10,y*1536/24,1024,1536,pose);
      const a=p(ix,iy),b=p(ix+1,iy),c=p(ix,iy+1),d=p(ix+1,iy+1);
      assert.ok(area(a,b,c)>0); assert.ok(area(b,d,c)>0);
    }
  }
});
