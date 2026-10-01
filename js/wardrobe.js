(function (root) {
  'use strict';
  const CHARACTERS = Object.freeze([
    Object.freeze({ id: 'sweet', label: '甜橙', name: '甜橙', base: 'autumn', file: 'assets/outfits/sweet-autumn-v2.png',
      frame: Object.freeze({ x: 188 / 1024, y: 28 / 1536, width: 658 / 1024, height: 1472 / 1536 }),
      legacyFrame: Object.freeze({ x: 149 / 1024, y: 38 / 1536, width: 728 / 1024, height: 1483 / 1536 }) }),
    Object.freeze({ id: 'cool', label: '阿飒', name: '阿飒', base: 'cool-original', file: 'assets/cool-girl-reference.png',
      frame: Object.freeze({ x: 228 / 1024, y: 76 / 1536, width: 588 / 1024, height: 1400 / 1536 }),
      legacyFrame: Object.freeze({ x: 228 / 1024, y: 76 / 1536, width: 588 / 1024, height: 1400 / 1536 }) }),
    Object.freeze({ id: 'literary', label: '知秋', name: '知秋', base: 'literary-bookshop', file: 'assets/literary-girl-reference.png',
      frame: Object.freeze({ x: 180 / 1024, y: 13 / 1536, width: 651 / 1024, height: 1515 / 1536 }) })
  ]);
  const LOOKS = Object.freeze([
    Object.freeze({ id: 'autumn', seasons: Object.freeze(["autumn"]), characterId: 'sweet', label: '秋日款', name: 'Autumn layers', file: 'assets/outfits/sweet-autumn-v2.png' }),
    Object.freeze({ id: 'blue', seasons: Object.freeze(["spring"]), characterId: 'sweet', label: '清甜款', name: 'Blue day', file: 'assets/outfits/sweet-blue-v2.png',
      frame: Object.freeze({ x: 188 / 1024, y: 24 / 1536, width: 658 / 1024, height: 1476 / 1536 }) }),
    Object.freeze({ id: 'polo', seasons: Object.freeze(["spring"]), characterId: 'sweet', label: '学院款', name: 'Polo day', file: 'assets/outfits/sweet-polo-v2.png',
      frame: Object.freeze({ x: 188 / 1024, y: 35 / 1536, width: 658 / 1024, height: 1490 / 1536 }) }),
    Object.freeze({ id: 'cool-original', seasons: Object.freeze(["autumn"]), characterId: 'cool', label: '原版工装', name: 'Original cargo', file: 'assets/cool-girl-reference.png' }),
    Object.freeze({ id: 'cool-street', seasons: Object.freeze(["autumn"]), characterId: 'cool', label: '黑灰街头', name: 'Street grey', file: 'assets/outfits/cool-street-v2.png' }),
    Object.freeze({ id: 'cool-olive', seasons: Object.freeze(["spring"]), characterId: 'cool', label: '绿夹克', name: 'Olive denim', file: 'assets/outfits/cool-olive-v2.png',
      frame: Object.freeze({ x: 212 / 1024, y: 4 / 1536, width: 620 / 1024, height: 1472 / 1536 }) }),
    Object.freeze({ id: 'literary-bookshop', seasons: Object.freeze(["autumn"]), characterId: 'literary', label: '书店日常', name: 'Bookshop day', file: 'assets/literary-girl-reference.png' }),
    Object.freeze({ id: 'literary-campus', seasons: Object.freeze(["spring"]), characterId: 'literary', label: '学院通勤', name: 'Campus day', file: 'assets/outfits/literary-campus-v1.png' }),
    Object.freeze({ id: 'literary-weekend', seasons: Object.freeze(["autumn"]), characterId: 'literary', label: '周末散步', name: 'Weekend walk', file: 'assets/outfits/literary-weekend-v1.png' }),
    Object.freeze({ id: 'sweet-summer', characterId: 'sweet', seasons: Object.freeze(["summer"]), label: '薄荷夏日', name: 'Mint summer', file: 'assets/outfits/sweet-summer-v1.png',
      frame: Object.freeze({ x: 188/1024, y: 28/1536, width: 658/1024, height: 1484/1536 }) }),
    Object.freeze({ id: 'sweet-winter', characterId: 'sweet', seasons: Object.freeze(["winter"]), label: '暖粉冬日', name: 'Rose winter', file: 'assets/outfits/sweet-winter-v1.png',
      frame: Object.freeze({ x: 188/1024, y: 28/1536, width: 658/1024, height: 1484/1536 }) }),
    Object.freeze({ id: 'cool-summer', characterId: 'cool', seasons: Object.freeze(["summer"]), label: '轻装街头', name: 'Summer street', file: 'assets/outfits/cool-summer-v1.png',
      frame: Object.freeze({ x: 228/1024, y: 70/1536, width: 588/1024, height: 1415/1536 }) }),
    Object.freeze({ id: 'cool-winter', characterId: 'cool', seasons: Object.freeze(["winter"]), label: '冬日工装', name: 'Winter cargo', file: 'assets/outfits/cool-winter-v1.png',
      frame: Object.freeze({ x: 220/1024, y: 72/1536, width: 604/1024, height: 1425/1536 }) }),
    Object.freeze({ id: 'literary-summer', characterId: 'literary', seasons: Object.freeze(["summer"]), label: '亚麻清风', name: 'Linen breeze', file: 'assets/outfits/literary-summer-v1.png',
      frame: Object.freeze({ x: 185/1024, y: 24/1536, width: 680/1024, height: 1504/1536 }) }),
    Object.freeze({ id: 'literary-winter', characterId: 'literary', seasons: Object.freeze(["winter"]), label: '驼色冬日', name: 'Camel winter', file: 'assets/outfits/literary-winter-v1.png',
      frame: Object.freeze({ x: 180/1024, y: 24/1536, width: 651/1024, height: 1504/1536 }) }),
    Object.freeze({ id: "sweet-summer-2", characterId: "sweet", seasons: Object.freeze(["summer"]), label: "蜜桃晴日", name: "Peach sunshine", file: "assets/outfits/sweet-summer-2.png", frame: Object.freeze({"x": 0.18359375, "y": 0.018229166666666668, "width": 0.642578125, "height": 0.9661458333333334}) }),
    Object.freeze({ id: "sweet-autumn-2", characterId: "sweet", seasons: Object.freeze(["autumn"]), label: "莓色针织", name: "Berry knit", file: "assets/outfits/sweet-autumn-2.png", frame: Object.freeze({"x": 0.18359375, "y": 0.018229166666666668, "width": 0.642578125, "height": 0.9661458333333334}) }),
    Object.freeze({ id: "sweet-winter-2", characterId: "sweet", seasons: Object.freeze(["winter"]), label: "奶油冬信", name: "Cream winter", file: "assets/outfits/sweet-winter-2.png", frame: Object.freeze({"x": 0.18359375, "y": 0.018229166666666668, "width": 0.642578125, "height": 0.9661458333333334}) }),
    Object.freeze({ id: "cool-spring-2", characterId: "cool", seasons: Object.freeze(["spring"]), label: "牛仔轻行", name: "Denim stroll", file: "assets/outfits/cool-spring-2.png", frame: Object.freeze({"x": 0.21484375, "y": 0.045572916666666664, "width": 0.58984375, "height": 0.927734375}) }),
    Object.freeze({ id: "cool-summer-2", characterId: "cool", seasons: Object.freeze(["summer"]), label: "球场午后", name: "Courtside noon", file: "assets/outfits/cool-summer-2.png", frame: Object.freeze({"x": 0.21484375, "y": 0.045572916666666664, "width": 0.58984375, "height": 0.927734375}) }),
    Object.freeze({ id: "cool-winter-2", characterId: "cool", seasons: Object.freeze(["winter"]), label: "山野暖行", name: "Forest warmth", file: "assets/outfits/cool-winter-2.png", frame: Object.freeze({"x": 0.21484375, "y": 0.045572916666666664, "width": 0.58984375, "height": 0.927734375}) }),
    Object.freeze({ id: "literary-spring-2", characterId: "literary", seasons: Object.freeze(["spring"]), label: "青苔书页", name: "Sage pages", file: "assets/outfits/literary-spring-2.png", frame: Object.freeze({"x": 0.17578125, "y": 0.015625, "width": 0.6357421875, "height": 0.9791666666666666}) }),
    Object.freeze({ id: "literary-summer-2", characterId: "literary", seasons: Object.freeze(["summer"]), label: "蓝色夏笺", name: "Blue linen", file: "assets/outfits/literary-summer-2.png", frame: Object.freeze({"x": 0.17578125, "y": 0.015625, "width": 0.6357421875, "height": 0.9791666666666666}) }),
    Object.freeze({ id: "literary-winter-2", characterId: "literary", seasons: Object.freeze(["winter"]), label: "雾灰冬读", name: "Winter reading", file: "assets/outfits/literary-winter-2.png", frame: Object.freeze({"x": 0.17578125, "y": 0.015625, "width": 0.6357421875, "height": 0.9791666666666666}) })
  ]);
  // Common horizontal registration and small vertical corrections align regenerated looks.
  const FRAME = CHARACTERS[0].frame;
  const legacyOutfits = new Set(['autumn','blue','polo','cool-original','cool-street','cool-olive','literary-bookshop','literary-campus','literary-weekend']);
  const find = id => LOOKS.find(look => look.id === id);
  const getCharacter = id => CHARACTERS.find(character => character.id === id);
  const forCharacter = id => LOOKS.filter(look => look.characterId === id);
  const characterForOutfit = id => getCharacter(find(id)?.characterId);
  const frameForOutfit = id => find(id)?.frame || characterForOutfit(id)?.frame;
  const SEASONS = Object.freeze(['spring', 'summer', 'autumn', 'winter'].map((id, index) => Object.freeze({ id, label: ['春', '夏', '秋', '冬'][index] })));
  const validSeason = id => SEASONS.some(season => season.id === id);
  const forSeason = (characterId, season) => forCharacter(characterId).filter(look => look.seasons.includes(season));
  function selectForSeason(characterId, season, preferred) {
    const looks = forSeason(characterId, validSeason(season) ? season : 'autumn');
    return looks.find(look => look.id === preferred) || looks[0];
  }
  function seasonForOutfit(id, preferred = 'autumn') {
    const look = find(id);
    if (!look) return validSeason(preferred) ? preferred : 'autumn';
    return look.seasons.includes(preferred) ? preferred : look.seasons.includes('autumn') ? 'autumn' : look.seasons[0];
  }
  function seasonForRecord(record, preferred = 'autumn') {
    return seasonForOutfit(fromRecord(record), validSeason(record.season) ? record.season : preferred);
  }
  function next(id, characterId = 'sweet', season) {
    const character = find(id)?.characterId || getCharacter(characterId)?.id || 'sweet';
    const looks = season ? forSeason(character, season) : forCharacter(character);
    if (!looks.length) return undefined;
    return looks[(looks.findIndex(look => look.id === id) + 1) % looks.length];
  }
  function fromRecord(record) {
    if (find(record.outfitId)) return record.outfitId;
    // Versions saved before OOTD used this exact name for the built-in girl.
    return !Object.prototype.hasOwnProperty.call(record, 'outfitId') && record.name === 'Sweet Girl' ? 'autumn' : null;
  }
  function frameForRecord(record) {
    const id = fromRecord(record), character = characterForOutfit(id);
    if (!character) return undefined;
    const f = record.frame;
    if (f && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(f[key])) &&
      f.x >= 0 && f.y >= 0 && f.width > 0 && f.height > 0 && f.x + f.width <= 1 && f.y + f.height <= 1) {
      return { x: f.x, y: f.y, width: f.width, height: f.height };
    }
    // Older saved blobs must retain their original framing after catalogue assets change.
    return legacyOutfits.has(id) ? character.legacyFrame || frameForOutfit(id) : frameForOutfit(id);
  }
  const api = { CHARACTERS, LOOKS, FRAME, SEASONS, validSeason, forSeason, selectForSeason, seasonForOutfit, seasonForRecord,
    find, next, fromRecord, getCharacter, forCharacter, characterForOutfit, frameForOutfit, frameForRecord };
  root.SweetWardrobe = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
