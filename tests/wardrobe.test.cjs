const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../js/wardrobe.js');

test('one-click outfit changes wrap through all eight looks and start cleanly after upload', () => {
  let id = 'autumn';
  const visited = [];
  for (let n = 0; n < 9; n++) { id = W.next(id).id; visited.push(id); }
  assert.deepEqual(visited, ['blue', 'polo', 'sweet-summer', 'sweet-winter', 'sweet-summer-2', 'sweet-autumn-2', 'sweet-winter-2', 'autumn', 'blue']);
  assert.equal(W.next(null).id, 'autumn');
  assert.equal(W.next('sweet-winter-2').id,'autumn');
  assert.equal(W.next('cool-winter-2').id,'cool-original');
  assert.equal(W.next('literary-winter-2').id,'literary-bookshop');
});

test('saved look selection remains compatible with old versions without changing uploaded characters', () => {
  assert.equal(W.fromRecord({ name: 'Sweet Girl', outfitId: 'polo' }), 'polo');
  assert.equal(W.fromRecord({ name: 'Sweet Girl' }), 'autumn');
  assert.equal(W.fromRecord({ name: 'Sweet Girl', outfitId: null }), null);
  assert.equal(W.fromRecord({ name: 'My upload' }), null);
  assert.equal(W.fromRecord({ name: 'Sweet Girl', outfitId: 'unknown' }), null);
});

test('OOTD stays within the selected character and wraps all wardrobes independently', () => {
  assert.equal(W.next('polo').id, 'sweet-summer');
  assert.equal(W.next('cool-original').id, 'cool-street');
  assert.equal(W.next('cool-street').id, 'cool-olive');
  assert.equal(W.next('cool-olive').id, 'cool-summer');
  assert.equal(W.next(null, 'cool').id, 'cool-original');
  assert.equal(W.forCharacter('sweet').length, 8);
  assert.equal(W.forCharacter('cool').length, 8);
  assert.equal(W.next('literary-bookshop').id, 'literary-campus');
  assert.equal(W.next('literary-campus').id, 'literary-weekend');
  assert.equal(W.next('literary-weekend').id, 'literary-summer');
  assert.equal(W.next(null, 'literary').id, 'literary-bookshop');
  assert.equal(W.forCharacter('literary').length, 8);
});

test('saved outfits restore their character and all built-in originals remain available', () => {
  for (const id of ['cool-original', 'cool-street', 'cool-olive']) {
    const look = W.fromRecord({ name: 'Nieve', characterId: 'cool', outfitId: id });
    assert.equal(look, id);
    assert.equal(W.characterForOutfit(look).id, 'cool');
  }
  assert.equal(W.getCharacter('cool').base, 'cool-original');
  assert.equal(W.getCharacter('sweet').base, 'autumn');
  for (const id of ['literary-bookshop', 'literary-campus', 'literary-weekend']) {
    const look = W.fromRecord({ name: 'Literary Girl', characterId: 'literary', outfitId: id });
    assert.equal(look, id);
    assert.equal(W.characterForOutfit(look).id, 'literary');
  }
  assert.equal(W.getCharacter('literary').base, 'literary-bookshop');
});

test('asset updates preserve old saved framing while new versions keep their own frame snapshot', () => {
  const legacy = W.getCharacter('sweet').legacyFrame;
  assert.deepEqual(W.frameForRecord({ name: 'Sweet Girl', outfitId: 'polo' }), legacy);
  assert.deepEqual(W.frameForRecord({ name: 'Sweet Girl' }), legacy);
  const current = W.frameForOutfit('polo');
  assert.notDeepEqual(current, legacy);
  assert.deepEqual(W.frameForRecord({ name: 'Sweet Girl', outfitId: 'polo', frame: current }), current);
  assert.deepEqual(W.frameForRecord({ name: 'Sweet Girl', outfitId: 'polo', frame: { x: 0, y: 0, width: Infinity, height: 1 } }), legacy);
  assert.equal(W.frameForRecord({ name: 'My upload', outfitId: null }), undefined);
  assert.deepEqual(W.frameForRecord({ name: 'Nieve', outfitId: 'cool-street' }), W.frameForOutfit('cool-street'));
  const coolLegacy = W.getCharacter('cool').legacyFrame;
  const coolCurrent = W.frameForOutfit('cool-olive');
  assert.notDeepEqual(coolCurrent, coolLegacy);
  assert.deepEqual(W.frameForRecord({ name: 'Nieve', outfitId: 'cool-olive' }), coolLegacy);
  assert.deepEqual(W.frameForRecord({ name: 'Nieve', outfitId: 'cool-olive', frame: coolCurrent }), coolCurrent);
});
