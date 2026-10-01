const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/model.js');

test('default geometry is an identity mapping with no missing image rows', () => {
  const g = M.buildGeometry(320, 565, M.DEFAULTS);
  assert.equal(g.height, 565);
  assert.equal(g.strips[0].dy, 0);
  assert.equal(g.strips.reduce((sum, row) => sum + row.sh, 0), 565);
  for (const row of g.strips) {
    assert.equal(row.horizontalScale, 1);
    assert.equal(row.sy, row.dy);
  }
});

test('head enlargement affects the head independently of the torso', () => {
  const g = M.buildGeometry(320, 565, { headSize: 1 });
  assert.ok(g.strips[10].horizontalScale > 1.5);
  const torso = g.strips.find(row => row.sy > 280);
  assert.equal(torso.horizontalScale, 1);
  assert.ok(g.height > 565);
});

test('sturdier body preserves the head, taller height expands legs', () => {
  const body = M.buildGeometry(320, 565, { bodyShape: 1 });
  assert.equal(body.strips[10].horizontalScale, 1);
  assert.ok(body.strips.find(row => row.sy > 280).horizontalScale > 1.2);
  const tall = M.buildGeometry(320, 565, { height: 1 });
  assert.equal(tall.strips[10].dh, tall.strips[10].sh);
  assert.ok(tall.strips.at(-1).dh > tall.strips.at(-1).sh * 1.5);
});

test('extreme combined settings remain monotonic and never flip any strip', () => {
  for (const n of [-1, 1]) {
    const g = M.buildGeometry(530, 1400, { headSize: n, bodyShape: n, height: n, headBoundary: 0.58 });
    assert.ok(Number.isFinite(g.height) && g.height > 0);
    for (let i = 0; i < g.strips.length; i++) {
      const row = g.strips[i];
      assert.ok(row.dh > 0 && row.horizontalScale > 0);
      if (i) assert.equal(row.dy, g.strips[i - 1].dy + g.strips[i - 1].dh);
    }
  }
});

test('corrupt storage input cannot inject a background or non-finite geometry', () => {
  const s = M.sanitizeSettings({ headSize: 'NaN', height: Infinity, bodyShape: -99,
    headBoundary: 4, lightColor: 'url(https://example.com)', background: '<script>', zoom: null });
  assert.equal(s.headSize, 0);
  assert.equal(s.height, 0);
  assert.equal(s.bodyShape, -1);
  assert.equal(s.headBoundary, 0.58);
  assert.equal(s.lightColor, '');
  assert.equal(s.background, 'transparent');
  assert.equal(s.zoom, 1);
  assert.ok(M.buildGeometry(320, 565, s).height > 0);
  assert.deepEqual(M.sanitizeSettings(null), { ...M.DEFAULTS });
});

test('invalid dimensions are rejected before canvas allocation', () => {
  for (const [w, h] of [[0, 500], [500, -1], [NaN, 500], [500, Infinity]]) {
    assert.throws(() => M.buildGeometry(w, h), RangeError);
  }
});
