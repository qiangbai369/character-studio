const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('@napi-rs/canvas'),M=require('../js/studio-model.js'),N=require('../js/model.js');
function renderer(){const window={StudioModel:M,NieveModel:N};const context=vm.createContext({window,document:{createElement:()=>C.createCanvas(1,1)}});for(const file of ['renderer','studio-effects'])vm.runInContext(fs.readFileSync(require.resolve('../js/'+file+'.js'),'utf8'),context);return window.NieveRenderer;}
const settings={...N.DEFAULTS,lightColor:'#ffd4a4',lightIntensity:.55};
function frame(w,h,state,exported=true){const source=C.createCanvas(600,1400);source.getContext('2d').fillStyle='#c97a63';source.getContext('2d').fillRect(0,0,600,1400);const out=C.createCanvas(w,h);return renderer().draw(out,source,settings,{export:exported,photograph:true,studio:{state:{...M.DEFAULTS,...state},characterId:'cool',pose:null}});}

// A photograph must have the same crop as the preview, regardless of the export flag.
test('studio photograph framing matches its camera preview at the same aspect ratio',()=>{
  for(const scene of ['studio','magazine','polaroid'])for(const crop of ['full','half']){
    const a=frame(600,750,{scene,crop},false),b=frame(1200,1500,{scene,crop},true);
    for(const key of ['x','y','width','height','baseline','factor'])assert.ok(Math.abs(a[key]*2-b[key])<.01,`${scene}/${crop}: ${key} changed on capture`);
  }
});
// Reproduces oversize/dragged full-body compositions that lose the head or shoes.
test('full-body composition keeps the complete figure inside the picture for every output ratio',()=>{
  for(const [w,h] of [[1200,1500],[1200,1200],[1080,1920]])for(const scene of ['studio','magazine','polaroid']){
    const b=frame(w,h,{scene,scale:1.2,offsetX:.15,offsetY:-.12});
    const view=M.layout(w,h,scene);
    assert.ok(b.y>=view.y,`${scene} cropped the head`);
    assert.ok(b.baseline<=view.y+view.height,`${scene} cropped the shoes`);
    assert.ok(b.x>=view.x&&b.x+b.width<=view.x+view.width,`${scene} cropped the side`);
    if(scene==='magazine')assert.ok(b.y>=Math.min(w,h)*.23,'figure enters the magazine masthead');
  }
});
test('square polaroid retains equal top and side paper borders',()=>{
  const v=M.layout(1200,1200,'polaroid');
  assert.ok(Math.abs(v.x-v.y)<.01,'top and side borders have different thickness');
  assert.ok(1200-(v.y+v.height)>v.x*1.7,'no room for the caption on the paper');
});
test('a half-body figure cannot paint over the magazine caption area',()=>{
  const window={StudioModel:M,NieveModel:N},context=vm.createContext({window,document:{createElement:()=>C.createCanvas(1,1)}});
  for(const file of ['renderer','studio-effects'])vm.runInContext(fs.readFileSync(require.resolve('../js/'+file+'.js'),'utf8'),context);
  const source=C.createCanvas(600,1400);source.getContext('2d').fillStyle='#c97a63';source.getContext('2d').fillRect(0,0,600,1400);
  const state={...M.DEFAULTS,scene:'magazine',crop:'half',ratio:'wallpaper'},out=C.createCanvas(540,960),room=C.createCanvas(540,960);
  window.NieveRenderer.draw(out,source,settings,{export:true,photograph:true,studio:{state,characterId:'cool',pose:null}});
  window.StudioEffects.room(room.getContext('2d'),540,960,settings,state);
  assert.deepEqual(Array.from(out.getContext('2d').getImageData(270,920,1,1).data),Array.from(room.getContext('2d').getImageData(270,920,1,1).data),'figure overlaps footer');
});
