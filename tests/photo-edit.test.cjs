const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../js/model.js'),W=require('../js/wardrobe.js'),SM=require('../js/studio-model.js');
// Run the shipped app and controller together. Only browser DOM/image decoding,
// persistent storage and canvas output are boundary fixtures; restoration is real.
class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.events={};this.attrs={};this.dataset={};this.style={setProperty(k,v){this[k]=v;}};this.className='';this.hidden=false;this.clientWidth=850;this.classList={toggle:(c,on)=>{const a=new Set(this.className.split(' '));on?a.add(c):a.delete(c);this.className=[...a].join(' ');},add:c=>this.classList.toggle(c,true),remove:c=>this.classList.toggle(c,false)};}
  append(...nodes){this.children.push(...nodes);} replaceChildren(...nodes){this.children=nodes;}
  setAttribute(k,v){this.attrs[k]=String(v);} getAttribute(k){return this.attrs[k]??null;}
  addEventListener(k,f){(this.events[k]??=[]).push(f);} async click(){if(this.disabled)return;for(const f of this.events.click||[])await f({target:this,currentTarget:this});}
  matches(s){if(s==='button')return this.tagName==='button';if(s.startsWith('#'))return this.id===s.slice(1);if(s.startsWith('.'))return this.className.split(' ').includes(s.slice(1));const a=/^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(s);if(a){const val=a[1].startsWith('data-')?this.dataset[a[1].slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]:this.attrs[a[1]];return val!==undefined&&(a[2]===undefined||val===a[2]);}return false;}
  querySelectorAll(s){const nodes=this.children.flatMap(c=>[c,...c.querySelectorAll('*')]);return s==='*'?nodes:nodes.filter(n=>s.split(',').some(x=>n.matches(x.trim())));} querySelector(s){return this.querySelectorAll(s)[0]||null;}
  getBoundingClientRect(){return {width:850,height:680,left:0,top:0};} focus(){} showModal(){this.open=true;} close(){this.open=false;}
  getContext(){return {drawImage(){}};} toDataURL(){return 'data:image/png;base64,fixture';} toBlob(f){f(new Blob(['new photograph']));}
}
const photo=()=>({id:'saved-photo',kind:'photo',name:'阿飒',characterId:'cool',outfitId:'cool-street',createdAt:1,thumbnail:'thumb',imageBlob:new Blob(['saved-source']),photoBlob:new Blob(['saved-photograph']),frame:{x:.2,y:.05,width:.6,height:.9},responseVersion:2,settings:{...M.DEFAULTS,headSize:.12,lightColor:'#c6d9ed',lightIntensity:.42},studio:{state:{...SM.DEFAULTS,scene:'magazine',ratio:'square',crop:'half',scale:.88,offsetX:.06,offsetY:-.04,caption:'周末',showDate:true,lightX:.82,lightY:.3},pose:{id:'peace',amount:.43,active:true,idle:false,time:2,blink:0,progress:.25}}});
async function page(records=[photo()],session=null,network={}){
  const requests=[],idleJobs=[],actionRequests=[];const nodes=new Map(),body=new Element('body'),frames=[],urls=new Map(),revoked=[];let serial=0,lastDraw,failed=false,assetGate=null;
  const get=id=>{if(!nodes.has(id)){const e=new Element();e.id=id;nodes.set(id,e);body.append(e);}return nodes.get(id);};
  const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
  for(const match of html.matchAll(/<([a-z]+)\b([^>]*)>/g)){
    const id=/\bid="([^"]+)"/.exec(match[2]);const ds=[...match[2].matchAll(/data-([a-z]+)="([^"]+)"/g)];if(!id&&!ds.length)continue;
    const e=id?get(id[1]):new Element(match[1]);e.tagName=match[1];e.hidden=/\bhidden\b/.test(match[2]);if(!id)body.append(e);for(const d of ds)e.dataset[d[1]]=d[2];
  }
  const document={body,hidden:false,getElementById:get,createElement:t=>new Element(t),createElementNS:(_,t)=>new Element(t),querySelectorAll:s=>body.querySelectorAll(s),addEventListener(){}};
  const effects={loadCharacter:async()=>{},loadLook:async id=>{actionRequests.push(id);if(failed)throw new Error('asset unavailable');if(assetGate){const gate=assetGate;assetGate=null;await gate;}},palette:()=>['#cbbba5','#d2c5b3','#e4dfd5']};
  const window={NieveModel:M,SweetWardrobe:W,StudioModel:SM,StudioEffects:effects,NieveStorage:{listVersions:async()=>records,saveVersion:async r=>records.push(r)},NieveRenderer:{prepare(im,o){im.frame=o.frame;},draw(c,im,settings,options){lastDraw={im,settings,options};return {x:0,y:0,width:400,height:600,baseline:600};}},devicePixelRatio:1,matchMedia:()=>({matches:true}),requestIdleCallback(f){idleJobs.push(f);return idleJobs.length;},cancelIdleCallback(id){idleJobs[id-1]=null;},addEventListener(){}};
  const savedSession={value:session};
  const context={window,document,StudioEffects:effects,StudioModel:SM,localStorage:{getItem:()=>savedSession.value?JSON.stringify(savedSession.value):null,setItem(k,v){savedSession.value=JSON.parse(v);}},navigator:{connection:network.connection},performance:{now:()=>0},matchMedia:window.matchMedia,requestAnimationFrame:f=>{frames.push(f);return frames.length;},ResizeObserver:class{observe(){}},setTimeout:()=>1,clearTimeout(){},crypto:{randomUUID:()=> 'new-id'},console,Intl,URL:{createObjectURL:b=>{const id='blob:'+(++serial);urls.set(id,b);return id;},revokeObjectURL:id=>revoked.push(id)},Image:class {naturalWidth=1024;naturalHeight=1536;set src(id){this.blob=urls.get(id);queueMicrotask(()=>this.onload());}},fetch:async url=>{requests.push(url);return network.fetch?network.fetch(url):{ok:true,blob:async()=>new Blob(['current-source'])};}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/studio-controller.js'),'utf8'),context);
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/app.js'),'utf8'),context);
  const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};await settle();
  const paint=(now=0)=>{const pending=frames.splice(0);for(const f of pending)f(now);return lastDraw;};paint();
  return {get,paint,settle,records,revoked,savedSession,requests,actionRequests,async warm(){const jobs=idleJobs.splice(0);for(const job of jobs)if(job)await job();await settle();},failAssets:(value=true)=>failed=value,gateAssets(){let resolve;assetGate=new Promise(r=>resolve=r);return resolve;},async view(){await get('libraryButton').click();await get('libraryList').children[0].children[0].click();await settle();},async chooseCool(){await get('characterPicker').children[1].click();await settle();paint();}};
}
test('viewing a saved photograph keeps the current studio untouched until continue-edit is chosen',async()=>{
  const p=await page();await p.view();const draw=p.paint();assert.equal(p.get('photoDialog').open,true);assert.equal(p.get('characterName').textContent,'甜橙','viewing a photo unexpectedly replaced the studio character');assert.equal(draw.options.studio.state.scene,'studio');
});

const chooseSeason=async(p,id)=>{const button=p.get('seasonPicker').querySelector('[data-season="'+id+'"]');assert.ok(button,'missing season control '+id);await button.click();await p.settle();};
test('season selection filters the wardrobe and stays selected when switching characters',async()=>{
  const p=await page();await chooseSeason(p,'summer');
  assert.deepEqual(p.get('outfitList').children.map(x=>x.dataset.outfit),['sweet-summer','sweet-summer-2']);
  assert.equal(p.get('outfitCounter').textContent,'01 / 02');
  await p.chooseCool();assert.equal(p.paint().options.studio.outfitId,'cool-summer');
  assert.deepEqual(p.get('outfitList').children.map(x=>x.dataset.outfit),['cool-summer','cool-summer-2']);
  assert.equal(p.get('outfitCounter').textContent,'01 / 02');
  await p.get('outfitButton').click();await p.settle();
  assert.equal(p.paint().options.studio.outfitId,'cool-summer-2','daily OOTD failed to choose the other summer look');
  assert.equal(p.savedSession.value.season,'summer');
});
test('spring wardrobe remembers its chosen look after visiting winter',async()=>{
  const p=await page();await chooseSeason(p,'spring');await p.get('outfitList').querySelector('[data-outfit="polo"]').click();await p.settle();
  await chooseSeason(p,'winter');assert.equal(p.paint().options.studio.outfitId,'sweet-winter');
  await chooseSeason(p,'spring');assert.equal(p.paint().options.studio.outfitId,'polo');
  const refreshed=await page([],p.savedSession.value);
  assert.equal(refreshed.paint().options.studio.outfitId,'polo');
  assert.equal(refreshed.get('seasonPicker').querySelector('[data-season="spring"]').getAttribute('aria-pressed'),'true');
});
test('a saved summer photo restores the season with its exact source and preserves it in a new work',async()=>{
  const r=photo();r.outfitId='cool-summer';r.season='summer';
  const p=await page([r]);await p.view();await p.get('retakePhoto').click();await p.settle();
  assert.equal(p.get('seasonPicker').querySelector('[data-season="summer"]').getAttribute('aria-pressed'),'true');
  assert.deepEqual(p.get('outfitList').children.map(x=>x.dataset.outfit),['cool-summer','cool-summer-2']);
  const d=p.paint();assert.equal(await d.im.blob.text(),'saved-source');assert.equal(d.options.studio.pose.id,'peace');
  await p.get('captureButton').click();p.paint(3100);await p.settle();p.paint(3100);await p.get('savePhoto').click();await p.settle();
  assert.equal(p.records[1].season,'summer');assert.equal(p.records[1].outfitId,'cool-summer');assert.equal(r.season,'summer');
});
test('continue-edit restores the saved source, pose, framing, room light and composition before camera opens',async()=>{
  const p=await page(),r=p.records[0];await p.view();await p.chooseCool();await p.get('retakePhoto').click();await p.settle();const d=p.paint();
  assert.equal(d.options.photograph,true);assert.equal(d.options.studio.outfitId,'cool-street');assert.equal(await d.im.blob.text(),'saved-source');assert.deepEqual(d.im.frame,{x:.2,y:.05,width:.6,height:.9});
  assert.equal(d.settings.headSize,.12);assert.equal(d.settings.lightColor,'#c6d9ed');assert.equal(d.options.studio.lighting.power,.42);assert.equal(d.options.studio.lighting.lightX,.82);
  assert.equal(d.options.studio.state.caption,'周末');assert.equal(d.options.studio.state.ratio,'square');assert.equal(d.options.studio.state.crop,'half');assert.equal(d.options.studio.state.offsetX,.06);assert.equal(d.options.studio.pose.id,'peace');assert.equal(d.options.studio.pose.amount,.43,'camera changed the saved expression amount');
  assert.equal(p.get('photoDialog').open,false);assert.equal(p.records.length,1,'editing overwrote or duplicated the saved photograph');assert.equal(r.studio.state.caption,'周末');
});
test('a saved photo without editable source stays viewable and downloadable without a broken editing entry',async()=>{
  const r=photo();delete r.imageBlob;const p=await page([r]);await p.view();assert.equal(p.get('photoDialog').open,true);assert.equal(p.get('retakePhoto').disabled,true);assert.equal(p.get('downloadPhoto').disabled,undefined);
});
test('a missing action asset leaves the current studio and photo preview intact for retry',async()=>{
  const p=await page();await p.view();p.failAssets();await p.get('retakePhoto').click();await p.settle();assert.equal(p.get('photoDialog').open,true);assert.equal(p.get('characterName').textContent,'甜橙');assert.equal(p.get('retakePhoto').disabled,false);assert.equal(p.records.length,1);p.failAssets(false);await p.get('retakePhoto').click();await p.settle();assert.equal(p.get('photoDialog').open,false);assert.equal(p.paint().options.studio.outfitId,'cool-street');
});
test('legacy photographs restore their saved blob and framing without applying newer action assets',async()=>{
  const r=photo();delete r.frame;delete r.responseVersion;delete r.studio;r.name='Nieve';r.outfitId='cool-olive';const p=await page([r]);await p.view();await p.get('retakePhoto').click();await p.settle();const d=p.paint();assert.equal(d.options.studio.outfitId,'cool-olive');assert.equal(d.options.studio.useExpressions,false);assert.deepEqual(d.im.frame,W.getCharacter('cool').legacyFrame);assert.equal(d.options.studio.state.ratio,'portrait');
});

test('closing a photo during restoration prevents late loading from replacing the studio',async()=>{
  const p=await page();await p.view();const release=p.gateAssets(),editing=p.get('retakePhoto').click();await p.settle();await p.get('closePhoto').click();release();await editing;await p.settle();p.paint();assert.equal(p.get('characterName').textContent,'甜橙');assert.notEqual(p.get('cameraControls').hidden,false);assert.ok(p.revoked.length>0,'discarded decoded image was leaked');
});
test('a newer character choice wins over a delayed photo restoration',async()=>{
  const p=await page();await p.view();const release=p.gateAssets(),editing=p.get('retakePhoto').click();await p.settle();await p.chooseCool();release();await editing;await p.settle();const d=p.paint();assert.equal(d.options.studio.outfitId,'cool-original');assert.equal(d.options.photograph,false);assert.equal(p.get('photoDialog').open,true);
});
test('editing and photographing creates a separate saved work and leaves the original photo intact',async()=>{
  const p=await page(),original=p.records[0];await p.view();await p.get('retakePhoto').click();await p.settle();p.paint();
  p.get('photoCaption').value='新的街头';for(const f of p.get('photoCaption').events.input)f({target:p.get('photoCaption')});
  await p.get('captureButton').click();p.paint(3100);await p.settle();p.paint(3100);assert.equal(p.get('photoDialog').open,true);assert.equal(p.get('savePhoto').disabled,false);await p.get('savePhoto').click();await p.settle();
  assert.equal(p.records.length,2);assert.equal(p.records[1].id,'new-id');assert.equal(p.records[1].studio.state.caption,'新的街头');assert.equal(p.records[1].outfitId,'cool-street');assert.equal(await p.records[1].imageBlob.text(),'saved-source');assert.equal(original.studio.state.caption,'周末');assert.equal(await original.photoBlob.text(),'saved-photograph');
});

// New seasonal slots use the existing app flow, including refresh and photo restoration.
test('a second seasonal look restores its own season after refresh and in a saved photograph',async()=>{
  const p=await page();await chooseSeason(p,'winter');
  await p.get('outfitList').querySelector('[data-outfit="sweet-winter-2"]').click();await p.settle();
  assert.equal(p.paint().options.studio.outfitId,'sweet-winter-2');assert.equal(p.get('outfitCounter').textContent,'02 / 02');
  const refreshed=await page([],p.savedSession.value);assert.equal(refreshed.paint().options.studio.outfitId,'sweet-winter-2');
  const r=photo();r.outfitId='literary-winter-2';r.season='winter';r.studio.pose.id='think';
  const restored=await page([r]);await restored.view();await restored.get('retakePhoto').click();await restored.settle();
  assert.equal(restored.paint().options.studio.outfitId,'literary-winter-2');assert.equal(restored.paint().options.studio.pose.id,'think');
  assert.equal(restored.get('seasonPicker').querySelector('[data-season="winter"]').getAttribute('aria-pressed'),'true');
  assert.equal(await restored.paint().im.blob.text(),'saved-source');
});

// Performance behavior: tiny UI imagery must not compete with the displayed PNG.
test('character and outfit cards use dedicated small images while the source remains original',async()=>{
 const p=await page();
 for(const holder of [p.get('characterPicker'),p.get('outfitList')])for(const im of holder.querySelectorAll('*').filter(n=>n.tagName==='img'))
   assert.ok(im.src.startsWith('assets/thumbnails/'),im.src+' still downloads a full portrait for a small card');
 assert.deepEqual(p.requests,[W.find('autumn').file]);assert.equal(await p.paint().im.blob.text(),'current-source');
});
test('base image cache releases older outfits and retries them without discarding the visible source',async()=>{
 const p=await page();
 for(const season of ['spring','summer','winter']){await chooseSeason(p,season);await p.get('outfitList').children[1].click();await p.settle();}
 await p.chooseCool();await p.get('characterPicker').children[2].click();await p.settle();
 assert.ok(p.revoked.length>0,'all decoded original PNGs are retained indefinitely');
 await p.get('characterPicker').children[0].click();await chooseSeason(p,'autumn');
 assert.equal(p.requests.filter(x=>x===W.find('autumn').file).length,2,'evicted original failed to reload');
 assert.equal(await p.paint().im.blob.text(),'current-source');
});
test('a failed or late outfit request keeps the visible character and the last choice wins',async()=>{
 let unblock;const delayed=new Promise(r=>unblock=r);let fail=true;
 const p=await page([],null,{fetch:async url=>{if(url===W.find('cool-original').file)await delayed;if(url===W.find('literary-bookshop').file&&fail)return{ok:false};return{ok:true,blob:async()=>new Blob([url])};}});
 const cool=p.get('characterPicker').children[1].click();await p.settle();
 assert.equal(p.get('characterName').textContent,'甜橙');
 await p.get('characterPicker').children[2].click();assert.equal(p.get('characterName').textContent,'甜橙');
 fail=false;await p.get('characterPicker').children[2].click();unblock();await cool;await p.settle();
 assert.equal(p.get('characterName').textContent,'知秋');assert.equal(p.paint().options.studio.outfitId,'literary-bookshop');
});
test('background preparation waits for current gestures and never loads another outfits gestures',async()=>{
 const p=await page();await chooseSeason(p,'summer');
 const release=p.gateAssets(),warming=p.warm();await p.settle();
 assert.ok(!p.requests.includes(W.find('sweet-summer-2').file),'another large PNG competed with pending current gestures');
 release();await warming;
 assert.ok(p.requests.includes(W.find('sweet-summer-2').file),'same-season original was not warmed');
 assert.ok(!p.requests.includes(W.find('sweet-winter').file),'background preparation leaked into other seasons');
 assert.ok(!p.actionRequests.includes('sweet-summer-2'),'unused gestures downloaded in the background');
});

test('data saving connections keep unused originals and gestures on demand',async()=>{
 const p=await page([],null,{connection:{saveData:true}});await p.warm();
 assert.deepEqual(p.requests,[W.find('autumn').file]);assert.ok(!p.actionRequests.includes('sweet-autumn-2'));
});
test('a pending gesture shows loading only on its button and clears after success or failure',async()=>{
 const p=await page(),puff=p.get('responseButtons').children[1],heart=p.get('responseButtons').children[2];
 const release=p.gateAssets(),request=puff.click();await p.settle();
 assert.equal(puff.getAttribute('aria-busy'),'true');assert.equal(heart.getAttribute('aria-busy'),'false');
 release();await request;assert.equal(puff.getAttribute('aria-busy'),'false');
 p.failAssets();await heart.click();assert.equal(heart.getAttribute('aria-busy'),'false');assert.equal(p.get('toast').hidden,false);
});
