const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('@napi-rs/canvas'),M=require('../js/studio-model.js'),N=require('../js/model.js');
function renderer(){
  const window={StudioModel:M,NieveModel:N};
  const context=vm.createContext({window,document:{createElement:()=>C.createCanvas(1,1)}});
  for(const file of ['renderer','studio-effects'])vm.runInContext(fs.readFileSync(require.resolve('../js/'+file+'.js'),'utf8'),context);
  return {R:window.NieveRenderer,E:window.StudioEffects};
}
const settings={...N.DEFAULTS,lightColor:'#fff1d8',lightIntensity:.55};
function rgb(canvas,x,y){return Array.from(canvas.getContext('2d').getImageData(x,y,1,1).data).slice(0,3);}
function luminance(rgb){return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}

// Catches a room that only lights a small patch, leaving the rest of the space unchanged.
test('switching the light changes both distant wall and floor while retaining ambient visibility',()=>{
  const {E}=renderer(),on=C.createCanvas(800,1000),off=C.createCanvas(800,1000);
  E.room(on.getContext('2d'),800,1000,settings,M.DEFAULTS);
  E.room(off.getContext('2d'),800,1000,settings,{...M.DEFAULTS,lightEnabled:false});
  for(const [x,y] of [[720,280],[720,920]]){
    const unlit=luminance(rgb(off,x,y));assert.ok(unlit>110,'ambient light must keep the scene visible');
    assert.ok(luminance(rgb(on,x,y))-unlit>15,'distant wall/floor did not respond to the lamp');
  }
});

// A side switch must reverse the illumination, rather than abruptly choosing one of two gradients.
test('moving the lamp reverses wall and character highlights continuously across the centre',()=>{
  const {E,R}=renderer(),source=C.createCanvas(400,800);source.getContext('2d').fillStyle='#b6a38f';source.getContext('2d').fillRect(0,0,400,800);
  const draw=x=>{const canvas=C.createCanvas(800,1000);R.draw(canvas,source,settings,{studio:{state:{...M.DEFAULTS,lightX:x},pose:null}});return canvas;};
  const left=draw(.18),right=draw(.86);
  assert.ok(luminance(rgb(left,200,420))-luminance(rgb(right,200,420))>18,'wall highlights did not move');
  assert.ok(luminance(rgb(left,290,500))-luminance(rgb(right,290,500))>12,'character highlights did not move');
  assert.ok(luminance(rgb(right,560,500))-luminance(rgb(left,560,500))>12,'character shadow side did not reverse');
  const a=draw(.529),b=draw(.531);
  assert.ok(Math.abs(luminance(rgb(a,290,500))-luminance(rgb(b,290,500)))<2,'centre crossing caused a lighting jump');
});

// Catches a ground shadow that ignores source height, or detaches its contact from the feet.
test('lower lamps cast longer opposite shadows while the contact remains under the feet',()=>{
  const {E}=renderer();
  const shadow=(x,y)=>{const c=C.createCanvas(800,1000);E.shadow(c.getContext('2d'),800,1000,E.light(settings,{...M.DEFAULTS,lightX:x,lightY:y}),424,910);return c;};
  const far=shadow(.18,.6),high=shadow(.18,.1),opposite=shadow(.86,.6);
  const centroid=c=>{const p=c.getContext('2d').getImageData(0,0,800,1000).data;let sum=0,weight=0;for(let y=870;y<1000;y++)for(let x=0;x<800;x++){const a=p[(y*800+x)*4+3];sum+=x*a;weight+=a;}return sum/weight;};
  assert.ok(centroid(far)>centroid(high)+8,'shadow length did not respond to source height');
  assert.ok(centroid(far)>424&&centroid(opposite)<424,'shadow points toward the lamp');
  for(const c of [far,opposite])assert.ok(c.getContext('2d').getImageData(424,910,1,1).data[3]>35,'contact shadow detached from soles');
});

test('rendered light overrides keep a captured frame in the same lighting as its visible preview',()=>{
  const {E}=renderer(),a=C.createCanvas(800,1000),b=C.createCanvas(800,1000);
  const visible={color:'#c6d9ed',power:.3,lightX:.8,lightY:.2};
  E.room(a.getContext('2d'),800,1000,settings,M.DEFAULTS,visible);
  E.room(b.getContext('2d'),800,1000,{...settings,lightColor:visible.color,lightIntensity:visible.power},{...M.DEFAULTS,lightX:.8,lightY:.2});
  assert.deepEqual(rgb(a,200,300),rgb(b,200,300),'room discarded the visible light snapshot');
});

test('light transitions retain the visible frame when interrupted and settle at the last requested state',()=>{
  assert.equal(typeof M.LightTransition,'function','smooth lamp transitions are missing');
  const off={color:'#ffd4a4',power:0,lightX:.22,lightY:.22},warm={...off,power:.55};
  const fade=new M.LightTransition(off);fade.set(warm,100);
  assert.deepEqual(fade.sample(100),off);
  const middle=fade.sample(240);assert.ok(middle.power>0&&middle.power<.55);
  fade.set({...warm,color:'#c6d9ed',lightX:.78},240);
  assert.deepEqual(fade.sample(240),middle,'rapid requests caused a snap');
  const end=fade.sample(600);assert.equal(end.power,.55);assert.equal(end.lightX,.78);assert.equal(end.color,'#c6d9ed');assert.equal(fade.active(600),false);
});

test('reduced motion and restored sessions apply the target light immediately',()=>{
  assert.equal(typeof M.LightTransition,'function','smooth lamp transitions are missing');
  const fade=new M.LightTransition({color:'#ffd4a4',power:.55,lightX:.22,lightY:.22});
  fade.set({color:'#c6d9ed',power:.42,lightX:.78,lightY:.18},100,true);
  assert.equal(fade.sample(100).lightX,.78);assert.equal(fade.sample(100).color,'#c6d9ed');assert.equal(fade.active(100),false);
});

test('all preset lights preserve natural neutral clothing without a solid colour wash',()=>{
  const {R}=renderer(),source=C.createCanvas(400,800);source.getContext('2d').fillStyle='#e0d8c9';source.getContext('2d').fillRect(0,0,400,800);
  for(const l of Object.values(M.LIGHT_PRESETS)){
    const c=C.createCanvas(800,1000);R.draw(c,source,{...settings,lightColor:l.color,lightIntensity:l.intensity},{studio:{state:{...M.DEFAULTS,lightX:l.x,lightY:l.y},pose:null}});
    const color=rgb(c,424,500);assert.ok(Math.min(...color)>155&&Math.max(...color)-Math.min(...color)<55,'neutral garment was repainted by the lamp');
  }
});

test('daylight opens up the whole room more than the cosy warm preset',()=>{
  const {E}=renderer(),levels=[];
  for(const id of ['day','warm']){
    const l=M.LIGHT_PRESETS[id],c=C.createCanvas(800,1000);E.room(c.getContext('2d'),800,1000,{...settings,lightColor:l.color,lightIntensity:l.intensity},{...M.DEFAULTS,lightX:l.x,lightY:l.y});
    levels.push([[100,100],[700,350],[700,900]].reduce((sum,[x,y])=>sum+luminance(rgb(c,x,y)),0)/3);
  }
  assert.ok(levels[0]>levels[1]+3,'daylight left the room darker than the warm preset');
});

test('a switched-off or zero-power lamp cannot move the room shadows',()=>{
  const {E}=renderer();
  for(const [zero,enabled] of [[settings,false],[{...settings,lightIntensity:0},true]]){
    const a=C.createCanvas(800,1000),b=C.createCanvas(800,1000);
    for(const [c,x,y] of [[a,.18,.1],[b,.86,.6]])E.shadow(c.getContext('2d'),800,1000,E.light(zero,{...M.DEFAULTS,lightEnabled:enabled,lightX:x,lightY:y}),424,910);
    assert.ok(a.toBuffer('image/png').equals(b.toBuffer('image/png')),'an unlit lamp still changed the ambient shadow');
  }
});
