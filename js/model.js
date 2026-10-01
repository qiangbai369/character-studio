(function (root) {
  'use strict';

  const DEFAULTS = Object.freeze({
    headSize: 0, bodyShape: 0, height: 0, headBoundary: 0.34,
    headCenter: 0.5, lightColor: '', lightIntensity: 0.55,
    background: 'transparent', zoom: 1
  });
  const LIGHTS = Object.freeze([
    { value: '', name: 'Original light' },
    { value: '#ffd4a4', name: 'Warm white' },
    { value: '#ff973e', name: 'Orange' }, { value: '#f8d260', name: 'Yellow' },
    { value: '#ec5cac', name: 'Pink' }, { value: '#8854e9', name: 'Violet' },
    { value: '#398af2', name: 'Blue' }, { value: '#32c4a4', name: 'Mint' }
  ]);
  const BACKGROUNDS = Object.freeze([
    { value: 'transparent', name: 'Transparent' }, { value: '#ffffff', name: 'White' },
    { value: '#f3d66c', name: 'Yellow' }, { value: '#a6c9dc', name: 'Powder blue' },
    { value: '#27883e', name: 'Green' }, { value: 'sunset', name: 'Orange gradient' },
    { value: '#dfacca', name: 'Lilac' }, { value: 'sky', name: 'Blue gradient' }
  ]);

  function clamp(value, low, high, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(low, Math.min(high, n)) : fallback;
  }
  function smooth(a, b, x) {
    const t = clamp((x - a) / (b - a), 0, 1, 0);
    return t * t * (3 - 2 * t);
  }
  function validHex(value) { return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value); }
  function sanitizeSettings(input = {}) {
    const s = input && typeof input === 'object' ? input : {};
    return {
      headSize: clamp(s.headSize, -1, 1, DEFAULTS.headSize),
      bodyShape: clamp(s.bodyShape, -1, 1, DEFAULTS.bodyShape),
      height: clamp(s.height, -1, 1, DEFAULTS.height),
      headBoundary: clamp(s.headBoundary, 0.15, 0.58, DEFAULTS.headBoundary),
      headCenter: clamp(s.headCenter, 0.2, 0.8, DEFAULTS.headCenter),
      lightColor: validHex(s.lightColor) ? s.lightColor.toLowerCase() : '',
      lightIntensity: clamp(s.lightIntensity, 0, 1, DEFAULTS.lightIntensity),
      background: BACKGROUNDS.some(x => x.value === s.background) || validHex(s.background)
        ? s.background : DEFAULTS.background,
      zoom: clamp(s.zoom, 0.5, 2.5, DEFAULTS.zoom)
    };
  }

  function buildGeometry(width, height, settings = {}) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new RangeError('Image dimensions must be positive and finite.');
    }
    const s = sanitizeSettings(settings);
    const headEnd = s.headBoundary;
    const legsStart = Math.max(0.59, headEnd + 0.13);
    const headScale = 1 + s.headSize * 0.55;
    const torsoScale = 1 + s.bodyShape * 0.31;
    const legsScale = 1 + s.height * 0.52;
    const step = Math.max(1, Math.ceil(height / 650));
    let destinationY = 0;
    let maxWidth = width;
    const strips = [];
    for (let y = 0; y < height; y += step) {
      const h = Math.min(step, height - y);
      const p = (y + h / 2) / height;
      const headWeight = 1 - smooth(headEnd - 0.05, headEnd + 0.05, p);
      const legWeight = smooth(legsStart - 0.045, legsStart + 0.045, p);
      const horizontalScale = headWeight * headScale + (1 - headWeight) *
        (torsoScale * (1 - legWeight) + (1 + s.bodyShape * 0.12) * legWeight);
      const verticalScale = headWeight * headScale + (1 - headWeight) *
        ((1 + s.height * 0.055) * (1 - legWeight) + legsScale * legWeight);
      const dh = h * verticalScale;
      strips.push({ sy: y, sh: h, dy: destinationY, dh, horizontalScale,
        pivot: headWeight * s.headCenter + (1 - headWeight) * 0.5 });
      destinationY += dh;
      maxWidth = Math.max(maxWidth, width * horizontalScale);
    }
    return { strips, width, height: destinationY, maxWidth, settings: s };
  }

  const api = { DEFAULTS, LIGHTS, BACKGROUNDS, clamp, smooth, validHex, sanitizeSettings, buildGeometry };
  root.NieveModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
