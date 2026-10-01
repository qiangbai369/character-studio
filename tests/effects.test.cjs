const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
let canvas;
try{canvas=require('@napi-rs/canvas');}catch{}
const root=path.resolve(__dirname,'..');
async function studio(overrides={}){
  class AssetImage extends canvas.Image{
    set src(value){const file=value.split('?')[0],original=file.replace(/\.webp$/,'.png');super.src=overrides[file]||overrides[original]||path.join(root,file);}
    get src(){return super.src;}
  }
  const window={StudioModel:require('../js/studio-model.js'),NieveModel:require('../js/model.js')};
  const context=vm.createContext({window,Image:AssetImage,document:{createElement:()=>canvas.createCanvas(1,1)}});
  for(const file of ['renderer','studio-effects'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),context);
  await window.StudioEffects.load();
  const W=require('../js/wardrobe.js');
  const look=async id=>{await window.StudioEffects.loadLook(id);return window.NieveRenderer.prepare(await canvas.loadImage(overrides[W.find(id).file]||path.join(root,W.find(id).file)),{frame:W.frameForOutfit(id)});};
  return {E:window.StudioEffects,R:window.NieveRenderer,look,image:id=>canvas.loadImage(path.join(root,W.find(id).file)),W};
}
function pixel(image,x,y){return Array.from(image.getContext('2d').getImageData(Math.round(x),Math.round(y),1,1).data);}
function rawPixel(data,texture,x,y){return pixel(texture.source,(x-data.left)*data.scale+(texture.offsetX||0),(y-data.top)*data.scale);}
test('seasonal gestures retain the approved lower outfit and shoes at entry, hold and release',{skip:!canvas},async()=>{
  const {E,look,W}=await studio();
  for(const id of ['sweet-summer','sweet-winter','cool-summer','cool-winter','literary-summer','literary-winter',...require('../previews/seasons-v2/generation.json').items.map(i=>i.id)]){
    const data=await look(id),character=W.find(id).characterId;
    for(const [action] of require('../js/studio-model.js').PROFILES[character].actions)for(const amount of [.25,.75,1]){
      const posed=E.texture(data,{id:action,amount,blink:0},character,id,true);
      assert.ok(posed.source,'missing action texture for '+id);
      if(amount===1)assert.notEqual(posed,data,id+' '+action+' never changed its pose');
      for(let y=1200;y<1470;y+=27)for(let x=330;x<710;x+=29)
        assert.deepEqual(rawPixel(data,posed,x,y),rawPixel(data,data,x,y),id+' '+action+' changed skirt/legs/shoes at '+x+','+y);
    }
  }
});
test('seasonal finger-hearts retain the face and bag instead of regenerating them',{skip:!canvas},async()=>{
  const {E,look}=await studio();
  for(const id of ['sweet-summer','sweet-winter','sweet-summer-2','sweet-autumn-2','sweet-winter-2']){
    const data=await look(id),posed=E.texture(data,{id:'heart',amount:1,blink:0},'sweet',id,true);
    for(const [x0,y0,x1,y1] of [[390,225,610,425],[230,990,400,1140]])
      for(let y=y0;y<y1;y+=17)for(let x=x0;x<x1;x+=17)
        assert.deepEqual(rawPixel(data,posed,x,y),rawPixel(data,data,x,y),id+' changed identity/accessory at '+x+','+y);
  }
});
test('sweet facial expressions do not import the scarf or change another outfit below the chin',{skip:!canvas},async()=>{
  const {E,look}=await studio();
  for(const id of ['blue','polo']){
    const data=await look(id),start=id==='blue'?450:500;
    for(const expression of ['puff','smile','blink'])for(const amount of [.25,.5,1]){
      const texture=E.texture(data,{id:expression,amount,blink:expression==='blink'?amount:0},'sweet',id,true);
      for(let y=start;y<800;y+=11)for(let x=410;x<620;x+=13){
        assert.deepEqual(rawPixel(data,texture,x,y),rawPixel(data,data,x,y),`${id} ${expression} changed clothing at ${x},${y}`);
      }
    }
  }
});
test('mid-transition features occupy one shared position instead of two translucent outlines',{skip:!canvas},async()=>{
  const fixture=(x,y,width,height)=>{const c=canvas.createCanvas(1024,1536),p=c.getContext('2d');p.fillStyle='rgb(200,160,140)';p.fillRect(0,0,1024,1536);p.fillStyle='#000';p.fillRect(x,y,width,height);return c.toBuffer('image/png');};
  for(const [id,baseBox,targetBox,inside,outside] of [
    ['smile',[395,283,76,26],[395,296,76,12],[430,300],[430,287]],
    ['blink',[395,283,76,26],[395,306,76,12],[430,303],[430,291]]
  ]){
    const {E,look}=await studio({'assets/outfits/sweet-autumn-v2.png':fixture(...baseBox),['assets/motion/sweet-autumn-v1/'+id+'.png']:fixture(...targetBox)});
    const data=await look('autumn'),texture=E.texture(data,{id,amount:.5,blink:id==='blink'?.5:0},'sweet','autumn',true);
    assert.ok(rawPixel(data,texture,...inside).slice(0,3).every(channel=>channel<10),`${id} retained two partial features`);
    assert.deepEqual(rawPixel(data,texture,...outside),[200,160,140,255],`${id} left a displaced feature outline`);
  }
});
test('moving eyelids keep a single opaque feature instead of mixing two eye textures',{skip:!canvas},async()=>{
  const fixture=(top,height,color)=>{const c=canvas.createCanvas(1024,1536),p=c.getContext('2d');p.fillStyle='rgb(200,160,140)';p.fillRect(0,0,1024,1536);p.fillStyle=color;p.fillRect(395,top,76,height);return c.toBuffer('image/png');};
  const {E,look}=await studio({'assets/outfits/sweet-autumn-v2.png':fixture(283,26,'rgb(80,40,20)'),'assets/motion/sweet-autumn-v1/smile.png':fixture(296,12,'#000')});
  const data=await look('autumn');
  for(const [amount,color] of [[.25,[80,40,20,255]],[.75,[0,0,0,255]]]){
    const texture=E.texture(data,{id:'smile',amount,blink:0},'sweet','autumn',true);
    assert.deepEqual(rawPixel(data,texture,430,300),color,'two eye textures were visible together');
  }
});
test('a sweet expression never opens transparent seams through the face',{skip:!canvas},async()=>{
  const {E,look}=await studio(),data=await look('autumn');
  for(const id of ['smile','puff','blink'])for(const amount of [.25,.5,.75,1]){
    const texture=E.texture(data,{id,amount,blink:id==='blink'?amount:0},'sweet','autumn',true);
    for(let y=330;y<365;y++)for(let x=470;x<525;x++){const alpha=rawPixel(data,texture,x,y)[3];assert.ok(alpha>=250,`${id} ${amount} has a mesh seam at ${x},${y} (alpha ${alpha})`);}
  }
});
test('smiles keep one original jawline instead of a second chin',{skip:!canvas},async()=>{
  const {E,look}=await studio();
  for(const [lookId,top] of [['autumn',433],['blue',425],['polo',465]]){
    const data=await look(lookId);
    for(const id of ['smile']){
      const texture=E.texture(data,{id,amount:1,blink:0},'sweet',lookId,true);
      for(let y=top;y<top+15;y+=3)for(let x=470;x<555;x+=5)assert.deepEqual(rawPixel(data,texture,x,y),rawPixel(data,data,x,y),`${lookId} ${id} changed the jawline`);
    }
  }
});
test('sweet finger-heart keeps the original face, bag, hem and shoes during the entire action',{skip:!canvas},async()=>{
  const {E,look}=await studio();
  for(const lookId of ['autumn','blue','polo']){
  const data=await look(lookId);
  for(const amount of [.25,.5,1]){
    const texture=E.texture(data,{id:'heart',amount,blink:0,progress:.3},'sweet',lookId,true);
    for(const [x0,y0,x1,y1] of [[380,210,660,440],[220,990,380,1190],[330,1250,700,1500]]){
      for(let y=y0;y<y1;y+=13)for(let x=x0;x<x1;x+=17){
        assert.deepEqual(rawPixel(data,texture,x,y),rawPixel(data,data,x,y),`greeting duplicated an invariant at ${x},${y}`);
      }
    }
  }
  }
});
test('finger-heart does not rotate the hair or coat texture against a stationary mask',{skip:!canvas},async()=>{
  const fixture=()=>{const c=canvas.createCanvas(1024,1536),p=c.getContext('2d');p.fillStyle='#bca18d';p.fillRect(0,0,1024,1536);
    for(let y=0;y<1536;y+=10){p.fillStyle=y%20?'#614534':'#bca18d';p.fillRect(0,y,1024,10);}return c.toBuffer('image/png');};
  const original=fixture(),{E,look}=await studio({'assets/outfits/sweet-autumn-v2.png':original,'assets/motion/sweet-actions-v2/autumn-heart.png':original}),data=await look('autumn');
  for(const progress of [.08,.25,.3,.7]){
    const texture=E.texture(data,{id:'heart',amount:1,blink:0,progress},'sweet','autumn',true);
    for(const [x,y] of [[760,335],[760,355],[730,910],[730,925]])assert.deepEqual(rawPixel(data,texture,x,y),rawPixel(data,data,x,y),'a stationary hair/coat texture moved at the mask boundary');
  }
});
test('half-body framing does not jump when a sweet action adds transparent padding',{skip:!canvas},async()=>{
  const {R,E,image,W}=await studio(),source=await image('autumn');await E.loadLook('autumn');R.prepare(source,{frame:W.frameForOutfit('autumn')});
  const M=require('../js/studio-model.js'),settings=require('../js/model.js').DEFAULTS;
  const draw=pose=>{const output=canvas.createCanvas(600,750);return {...R.draw(output,source,settings,{export:true,photograph:true,studio:{state:{...M.DEFAULTS,crop:'half'},pose,characterId:'sweet',outfitId:'autumn',useExpressions:true}}),output};};
  const neutral=draw({id:null,amount:0,blink:0,time:0,idle:false});
  for(const id of ['smile','puff','heart'])for(const amount of [.25,.5,1]){
    const result=draw({id,amount,blink:0,time:0,idle:false,progress:.3});
    assert.equal(result.factor,neutral.factor,`${id} resized the figure`);assert.equal(result.baseline,neutral.baseline);
    if(id==='heart')assert.deepEqual(result.output.getContext('2d').getImageData(595,0,5,750).data,neutral.output.getContext('2d').getImageData(595,0,5,750).data,'finger-heart hand touches the photo edge');
  }
});
test('puffed cheeks use the approved complete face, including cheek shape and pursed lips',{skip:!canvas},async()=>{
  const {E,look,R,W}=await studio(),data=await look('autumn'),approved=R.prepare(await canvas.loadImage(path.join(root,'assets/motion/sweet-actions-v2/autumn-puff.png')),{frame:W.frameForOutfit('autumn')});
  for(const amount of [.5,.75,1]){
    const texture=E.texture(data,{id:'puff',amount,blink:0},'sweet','autumn',true);
    for(const [x,y] of [[405,375],[420,400],[580,375],[570,400],[495,380],[490,420]]){
      const actual=rawPixel(data,texture,x,y),expected=rawPixel(approved,approved,x,y);
      assert.ok(actual.every((n,i)=>Math.abs(n-expected[i])<=1),`approved puff face was changed at ${x},${y}`);
    }
  }
});
test('a finger-heart removes the original hanging hand instead of leaving a second arm',{skip:!canvas},async()=>{
  const {E,look}=await studio();
  for(const [lookId,x,y] of [['blue',740,930],['polo',772,990]]){
    const data=await look(lookId),texture=E.texture(data,{id:'heart',amount:1,blink:0},'sweet',lookId,true);
    assert.ok(rawPixel(data,data,x,y)[3]>200,'fixture must cover the original hanging hand');
    assert.ok(rawPixel(data,texture,x,y)[3]<10,`${lookId} retained the old hanging hand`);
  }
});
test('finger-heart keeps the original skirt folds and silhouette below the old hand',{skip:!canvas},async()=>{
  const {E,look}=await studio();
  for(const lookId of ['blue','polo']){
    const data=await look(lookId),texture=E.texture(data,{id:'heart',amount:1,blink:0},'sweet',lookId,true);
    for(const [x,y] of [[690,1080],[750,1100],[760,1080],[800,1080]])assert.deepEqual(rawPixel(data,texture,x,y),rawPixel(data,data,x,y),`${lookId} changed an original skirt fold or edge`);
  }
});
test('finger-heart removes shaded skin along the entire old polo hand outline',{skip:!canvas},async()=>{
  const {E,look}=await studio(),data=await look('polo'),texture=E.texture(data,{id:'heart',amount:1,blink:0},'sweet','polo',true);
  let remaining=0;for(let y=900;y<1040;y++)for(let x=700;x<800;x++){
    const [r,g,b,a]=rawPixel(data,texture,x,y);if(a>40&&r>g+22&&g>b+8&&r>55)remaining++;
  }
  assert.equal(remaining,0,'shaded fingers or forearm fragments remain beside the skirt');
  assert.ok(rawPixel(data,texture,750,1000)[3]<10,'the reconstructed skirt extends into the old hand silhouette');
});

// Different hand positions must never be rendered as two translucent hands.
test('cool and literary gestures use one opaque silhouette during transitions',{skip:!canvas},async()=>{
  const fixture=target=>{const c=canvas.createCanvas(1024,1536),p=c.getContext('2d');p.fillStyle='rgb(200,160,140)';p.fillRect(0,0,1024,1536);p.fillStyle='#000';p.fillRect(target?780:700,500,35,35);return c.toBuffer('image/png');};
  for(const [lookId,character,action,base] of [['cool-original','cool','peace','assets/cool-girl-reference.png'],['literary-bookshop','literary','wave','assets/literary-girl-reference.png']]){
    const {E,look}=await studio({[base]:fixture(false),['assets/motion/responses-v2/'+lookId+'-'+action+'.png']:fixture(true)}),data=await look(lookId);
    for(const amount of [.5,.7,1]){
      const texture=E.texture(data,{id:action,amount,blink:0},character,lookId,true);
      assert.deepEqual(rawPixel(data,texture,795,515),[0,0,0,255],'raised hand remained translucent');
      assert.deepEqual(rawPixel(data,texture,715,515),[200,160,140,255],'old hand remained visible');
    }
  }
});
