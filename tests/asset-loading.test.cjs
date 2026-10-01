const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Substitute the image network boundary, retaining the production loading/cache logic.
function effects(){const requests=[];class Image{set src(url){requests.push(url);queueMicrotask(()=>this.onload());}}
  const window={StudioModel:require('../js/studio-model.js')};vm.runInNewContext(fs.readFileSync(require.resolve('../js/studio-effects.js'),'utf8'),{window,Image});return {E:window.StudioEffects,requests};}
test('warming one character loads only its common expressions and shares repeated requests',async()=>{
  const {E,requests}=effects();assert.equal(typeof E.loadCharacter,'function','expressions cannot load per character');
  await Promise.all([E.loadCharacter('sweet'),E.loadCharacter('sweet')]);
  assert.equal(requests.length,2,'warming sweet downloaded unused actions or duplicated requests');
  assert.ok(requests.every(url=>url.includes('sweet-autumn-v1/')),'another character stole initial bandwidth');
  await E.loadCharacter('cool');assert.equal(requests.length,3);assert.ok(requests[2].includes('cool-blink'));
});
test('new seasonal looks load their own action assets once instead of old outfit sleeves',async()=>{
  const {E,requests}=effects();
  for(const look of ['sweet-summer','sweet-winter','cool-summer','cool-winter','literary-summer','literary-winter'])
    await Promise.all([E.loadLook(look),E.loadLook(look)]);
  assert.equal(requests.length,16);
  assert.ok(requests.every(url=>url.startsWith('assets/motion/seasons-v1/')));
  assert.equal(requests.filter(url=>url.includes('sweet-summer-')).length,2);
  assert.equal(requests.filter(url=>url.includes('cool-winter-')).length,3);
});
test('motion previews use lossless delivery images and fall back to original PNG on failure',async()=>{
 const requests=[];class Image{set src(url){requests.push(url);queueMicrotask(()=>url.endsWith('.webp')?this.onerror():this.onload());}}
 const browserStub={StudioModel:require('../js/studio-model.js')};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/studio-effects.js'),'utf8'),{window:browserStub,Image});
 await browserStub.StudioEffects.loadCharacter('cool');
 assert.ok(requests[0].endsWith('.webp'),'large PNG still loaded for an unchanged motion preview');
 assert.equal(requests[1],'assets/motion/responses-v1/cool-blink.png');
});
test('decoded gestures have a bounded cache that keeps the visible character and reloads evicted looks',async()=>{
 const {E,requests}=effects();assert.equal(typeof E.pinLook,'function');
 E.pinLook('autumn');await E.loadLook('autumn');
 for(const id of ['blue','polo','sweet-summer','sweet-winter','sweet-summer-2'])await E.loadLook(id);
 const count=requests.length;await E.loadLook('autumn');assert.equal(requests.length,count,'active gestures were discarded');
 await E.loadLook('blue');assert.equal(requests.length,count+2,'old decoded gestures accumulated without a bound');
});
