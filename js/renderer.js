(function (root) {
  'use strict';
  const M = root.NieveModel;
  const cache = new WeakMap();

  function makeCanvas(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    return canvas;
  }

  function prepare(image, { frame } = {}) {
    if (cache.has(image)) return cache.get(image);
    const original = makeCanvas(image.naturalWidth || image.width, image.naturalHeight || image.height);
    const ctx = original.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const { width: w, height: h } = original;
    const pixels = ctx.getImageData(0, 0, w, h).data;
    let left = w, top = h, right = 0, bottom = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (pixels[(y * w + x) * 4 + 3] > 18) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    if (left > right || top > bottom) throw new Error('This image has no visible pixels.');
    left = Math.max(0, left - 3); top = Math.max(0, top - 3);
    right = Math.min(w - 1, right + 3); bottom = Math.min(h - 1, bottom + 3);
    if (frame) {
      left = Math.max(0, Math.floor(frame.x * w)); top = Math.max(0, Math.floor(frame.y * h));
      right = Math.min(w - 1, Math.ceil((frame.x + frame.width) * w) - 1);
      bottom = Math.min(h - 1, Math.ceil((frame.y + frame.height) * h) - 1);
    }
    const scale = Math.min(1, 1500 / (bottom - top + 1), 1500 / (right - left + 1));
    const source = makeCanvas(Math.round((right - left + 1) * scale), Math.round((bottom - top + 1) * scale));
    source.getContext('2d').drawImage(original, left, top, right - left + 1, bottom - top + 1,
      0, 0, source.width, source.height);
    const data = { source, left, top, scale, tinted: null, tintKey: '' };
    cache.set(image, data);
    return data;
  }

  function tint(data, s, light) {
    if (!light && (!s.lightColor || s.lightIntensity === 0)) return data.source;
    const color=light?.color||s.lightColor,power=light?light.power:s.lightIntensity;
    const key = [color, power, light?.lightX, light?.lightY].join(':');
    if (data.tintKey === key && data.tinted) return data.tinted;
    const canvas = makeCanvas(data.source.width, data.source.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(data.source, 0, 0);
    ctx.globalCompositeOperation = 'color';
    ctx.globalAlpha = power * (light ? .035 : 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = light ? 1 : power * 0.18;
    if (light) {
      ctx.fillStyle=`rgba(37,35,33,${.12*(1-power)})`;ctx.fillRect(0,0,canvas.width,canvas.height);
      const g=ctx.createLinearGradient(0,0,canvas.width,0),n=parseInt(color.slice(1),16);
      const glow=direction=>`rgba(${n>>16&255},${n>>8&255},${n&255},${power*(.04+Math.max(0,direction)*.48)})`;
      g.addColorStop(0,glow(light.direction));g.addColorStop(.5,glow(0));g.addColorStop(1,glow(-light.direction));
      ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
      const shade=ctx.createLinearGradient(0,0,canvas.width,0);
      shade.addColorStop(0,`rgba(37,35,33,${Math.max(0,-light.direction)*power*.32})`);
      shade.addColorStop(1,`rgba(37,35,33,${Math.max(0,light.direction)*power*.32})`);
      ctx.fillStyle=shade;
    } else ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.globalAlpha = 1;
    ctx.drawImage(data.source, 0, 0);
    data.tintKey = key; data.tinted = canvas;
    return canvas;
  }

  function background(ctx, w, h, value) {
    if (value === 'transparent') return;
    let fill = value;
    if (value === 'sunset' || value === 'sky') {
      fill = ctx.createLinearGradient(0, 0, w * 0.65, h);
      if (value === 'sunset') { fill.addColorStop(0, '#f7bc57'); fill.addColorStop(1, '#e47833'); }
      else { fill.addColorStop(0, '#dcecf1'); fill.addColorStop(1, '#91c1dc'); }
    }
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, w, h);
  }

  function draw(canvas, image, settings, options = {}) {
    const s = M.sanitizeSettings(settings);
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!image) return null;
    const data = prepare(image);
    const E = root.StudioEffects, SM = root.StudioModel;
    const studio = options.studio, state = SM?.sanitize(studio?.state);
    const illumination=studio&&E?E.light(s,state,studio.lighting):null;
    const photo = Boolean(options.photograph), scene = studio && !options.original && (!options.export || photo);
    let art = { x: 0, y: 0, width: w, height: h };
    if (scene && !photo && state.scene !== 'studio') {
      const size=SM.photoSize(state.ratio),ratio=size.width/size.height;
      art.width = Math.min(w * .82, h * .86*ratio); art.height = art.width/ratio;
      art.x = (w - art.width) / 2; art.y = (h - art.height) / 2;
      E.room(ctx, w, h, s, { ...state, scene: 'studio' },illumination);
    }
    ctx.save(); ctx.translate(art.x, art.y);
    if (scene && state.scene === 'polaroid') { ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, art.width, art.height); }
    const view = scene ? SM.layout(art.width, art.height, state.scene) : { x: 0, y: 0, width: w, height: h };
    ctx.save(); ctx.translate(view.x, view.y);
    ctx.beginPath(); ctx.rect(0, 0, view.width, view.height); ctx.clip();
    if (scene) E.room(ctx, view.width, view.height, s, state,illumination);
    else if (options.export) background(ctx, w, h, s.background);
    const pose = options.original ? null : studio?.pose;
    const texture = pose && E ? E.texture(data, pose, studio.characterId, studio.outfitId, studio.useExpressions) : data;
    const source = options.original ? data.source : tint(texture, s, illumination);
    const active = options.original ? { ...M.DEFAULTS, zoom: s.zoom } : s;
    const geometryKey = [active.headSize, active.bodyShape, active.height, active.headBoundary, active.headCenter].join(':');
    if (data.geometryKey !== geometryKey) { data.geometry = M.buildGeometry(data.source.width, data.source.height, active); data.geometryKey = geometryKey; }
    const geometry = data.geometry;
    const vw = view.width, vh = view.height, composed=photo||scene&&state.scene!=='studio',half = composed && state.crop === 'half';
    let factor = Math.min(vh * .85 / data.source.height, vh * .88 / geometry.height,
      vw * (options.export || scene && state.scene !== 'studio' ? .78 : .64) / geometry.maxWidth) * active.zoom;
    let centerX = vw * (options.export || scene && state.scene !== 'studio' ? .5 : .53);
    let baseline = vh * (options.export ? .92 : .91), top,photoFrame;
    top = baseline - geometry.height * factor;
    if(composed){
      const padding=studio?.useExpressions===false?0:studio?.characterId==='sweet'?70*data.scale:['cool','literary'].includes(studio?.characterId)?120*data.scale:0;
      photoFrame=SM.photoFrame(vw,vh,state,geometry,padding);
      ({factor,centerX,baseline,top}=photoFrame);
    }
    if (scene && !half) E.shadow(ctx, vw, vh, illumination, centerX, baseline, Math.min(vw*.12,data.source.width*factor*.34));
    else if (!options.export) {
      ctx.save();
      ctx.translate(centerX, baseline + h * 0.008);
      ctx.scale(1, 0.18);
      const radius = Math.max(10, data.source.width * factor * 0.57);
      const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      shadow.addColorStop(0, 'rgba(67,49,33,.24)'); shadow.addColorStop(1, 'rgba(67,49,33,0)');
      ctx.fillStyle = shadow; ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if(composed&&half){ctx.beginPath();ctx.rect(0,0,vw,photoFrame.safe.y+photoFrame.safe.height);ctx.clip();}
    for (const row of geometry.strips) {
      const rowWidth = data.source.width * row.horizontalScale * factor;
      const shift = (row.pivot - 0.5) * data.source.width * (1 - row.horizontalScale) * factor;
      const motion = pose && SM ? SM.rowMotion(row.sy / data.source.height, data.source.width, data.source.height, pose, studio.characterId) : { x: 0, y: 0 };
      const pad = texture.offsetX || 0;
      const x = centerX - rowWidth / 2 + shift + motion.x * factor - pad * row.horizontalScale * factor;
      const nextMotion = pose && SM ? SM.rowMotion((row.sy + row.sh) / data.source.height,
        data.source.width, data.source.height, pose, studio.characterId) : { x: 0, y: 0 };
      const y0 = top + (row.dy + motion.y) * factor;
      const y1 = top + (row.dy + row.dh + nextMotion.y) * factor;
      const scaleY = (y1 - y0) / row.sh;
      // Sample the full texture, then clip on device-pixel boundaries. Cropping tiny
      // source strips clamps interpolation at every edge; overlapping alpha then
      // produces horizontal bands, especially in an enlarged half-body photograph.
      const translateY = ctx.getTransform().f;
      const clipTop = Math.round(y0 + translateY) - translateY;
      const clipBottom = Math.round(y1 + translateY) - translateY;
      if (clipBottom > clipTop) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, clipTop, vw, clipBottom - clipTop); ctx.clip();
        ctx.drawImage(source, x, y0 - row.sy * scaleY,
          source.width * row.horizontalScale * factor, source.height * scaleY);
        ctx.restore();
      }
    }
    ctx.restore();
    if (scene) E.decoration(ctx, art.width, art.height, state, studio.info);
    ctx.restore();
    const headY = geometry.strips.find(row => row.sy >= data.source.height * active.headBoundary)?.dy || 0;
    const ox = art.x + view.x, oy = art.y + view.y;
    return { x: ox + centerX - data.source.width * factor / 2, y: oy + top,
      width: data.source.width * factor, height: geometry.height * factor,
      centerX: ox + centerX, baseline: oy + baseline, headBottom: oy + top + headY * factor, factor,
      sourceWidth: data.source.width, sourceHeight: data.source.height };
  }

  root.NieveRenderer = { draw, prepare, background };
})(window);
