const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const W=require('../js/wardrobe.js'),plan=require('../previews/seasons-v2/generation.json');

test('approved seasonal pairs provide exactly two unique outfits per character and season',()=>{
  const seen=new Set();
  for(const character of W.CHARACTERS){
    assert.equal(W.forCharacter(character.id).length,8);
    for(const season of W.SEASONS){
      const looks=W.forSeason(character.id,season.id);
      assert.equal(looks.length,2,character.id+' '+season.id);
      assert.deepEqual(looks.map(l=>l.id),plan.allocations[character.id][season.id]);
      for(const look of looks){assert.ok(!seen.has(look.id),'same outfit duplicated across seasons');seen.add(look.id);}
      assert.equal(W.next(looks[0].id,character.id,season.id).id,looks[1].id);
      assert.equal(W.next(looks[1].id,character.id,season.id).id,looks[0].id);
    }
  }
  assert.equal(seen.size,24);
});

test('approved standing images are copied byte-for-byte and every original outfit remains selectable',()=>{
  const old=require('../previews/seasons-v2/catalogue-baseline.json');
  for(const look of old){assert.equal(W.find(look.id).file,look.file);assert.deepEqual(W.frameForOutfit(look.id),look.frame);}
  for(const item of plan.items){const look=W.find(item.id);assert.ok(look,item.id);assert.ok(fs.readFileSync(require('node:path').resolve(__dirname,'..',look.file)).equals(fs.readFileSync(require('node:path').resolve(__dirname,'../previews/seasons-v2',item.id+'.png'))));}
});

test('new outfits load only their matching gestures and coalesce repeat action requests',async()=>{
  const requests=[];class Image{set src(path){requests.push(path);queueMicrotask(()=>this.onload());}}
  const window={StudioModel:require('../js/studio-model.js')};
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/studio-effects.js'),'utf8'),{window,Image});
  for(const item of plan.items)await Promise.all([window.StudioEffects.loadLook(item.id),window.StudioEffects.loadLook(item.id)]);
  assert.equal(requests.length,24);
  assert.ok(requests.every(path=>path.startsWith('assets/motion/seasons-v2/')));
  assert.equal(new Set(requests).size,24);
  for(const path of requests)assert.ok(fs.existsSync(require('node:path').resolve(__dirname,'..',path)),path);
});
