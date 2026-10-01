const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../js/wardrobe.js'),SM=require('../js/studio-model.js');

test('every season offers actual clothing for each character, without duplicating outfits',()=>{
  const visible=new Set();
  for(const character of W.CHARACTERS)for(const season of W.SEASONS){
    const looks=W.forSeason(character.id,season.id);
    assert.ok(looks.length>0,character.id+' has no '+season.id+' clothes');
    assert.equal(new Set(looks.map(x=>x.id)).size,looks.length);
    for(const look of looks){assert.equal(look.characterId,character.id);assert.ok(look.seasons.includes(season.id));visible.add(look.id);}
  }
  assert.equal(visible.size,24);
  assert.equal(W.find('cool-original').file,'assets/cool-girl-reference.png');
});

test('a character switch and daily OOTD choose only current-season clothes',()=>{
  assert.equal(W.selectForSeason('cool','summer','cool-original').id,'cool-summer');
  assert.equal(W.selectForSeason('sweet','summer','polo').id,'sweet-summer');
  assert.equal(W.selectForSeason('literary','winter','literary-campus').id,'literary-winter');
  for(const character of W.CHARACTERS)for(const season of W.SEASONS){
    const looks=W.forSeason(character.id,season.id).map(x=>x.id);
    const selected=SM.pickDaily(looks,looks[0]);
    assert.ok(looks.includes(selected));
    if(looks.length>1)assert.notEqual(selected,looks[0]);
    assert.ok(looks.includes(W.next(looks[0],character.id,season.id).id));
  }
});

test('old saved outfits infer a compatible season while new works retain their season',()=>{
  assert.equal(W.seasonForOutfit('blue','summer'),'spring');
  assert.equal(W.seasonForOutfit('cool-original','summer'),'autumn');
  assert.equal(W.seasonForOutfit('sweet-winter','autumn'),'winter');
  assert.equal(W.seasonForRecord({outfitId:'polo',season:'summer'}),'spring');
  assert.equal(W.seasonForRecord({outfitId:'cool-original'}),'autumn');
  assert.equal(W.seasonForRecord({name:'Sweet Girl'}),'autumn');
  assert.equal(W.seasonForRecord({outfitId:'literary-summer',season:'broken'}),'summer');
  assert.equal(W.seasonForRecord({name:'upload',outfitId:null},'winter'),'winter');
});
test('a new seasonal work without a frame snapshot cannot inherit a pre-season legacy crop',()=>{
  for(const id of ['sweet-summer','sweet-winter','cool-summer','cool-winter','literary-summer','literary-winter'])
    assert.deepEqual(W.frameForRecord({outfitId:id}),W.frameForOutfit(id));
  assert.deepEqual(W.frameForRecord({outfitId:'blue'}),W.getCharacter('sweet').legacyFrame);
});
