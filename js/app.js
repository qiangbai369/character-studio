(function () {
  'use strict';
  const M = window.NieveModel;
  const R = window.NieveRenderer;
  const S = window.NieveStorage;
  const W = window.SweetWardrobe;
  const $ = id => document.getElementById(id);
  const canvas = $('previewCanvas');
  const stage = $('stage');
  const ranges = ['headSize', 'bodyShape', 'height', 'lightIntensity'];
  let settings = { ...M.DEFAULTS, lightColor: '#ffd4a4' };
  let image, sourceBlob;
  let sourceObjectURL, sourceFrame;
  let name = '甜橙';
  let currentId = 'original';
  let activeOutfitId = 'autumn', outfitRequest = 0, pendingOutfitId = null;
  let activeCharacterId = 'sweet', renderedCharacterId;
  const outfitSelection = new Map(W.CHARACTERS.map(character => [character.id, character.base]));
  const outfitCache = new Map();
  let bounds, ready = false, comparing = false, framePending = false;
  let useResponseAssets = true, paintFrame = 0, photoURL, lastPhoto;
  let versions = [], toastTimer, uploadSequence = 0, libraryView='photos';
  let sessionData={};try{sessionData=JSON.parse(localStorage.getItem('studio-session-v2')||'{}')||{};}catch(e){}
  if(typeof sessionData!=='object'||Array.isArray(sessionData))sessionData={};
  for(const [character,id] of Object.entries(sessionData.outfits||{}))if(W.find(id)?.characterId===character)outfitSelection.set(character,id);
  let activeSeason = W.validSeason(sessionData.season) ? sessionData.season : W.seasonForOutfit(sessionData.outfit, 'autumn');
  const seasonalSelection = new Map();
  for(const [key,id] of Object.entries(sessionData.seasonOutfits||{})){
    const [character,season]=key.split(':');
    if(W.forSeason(character,season).some(look=>look.id===id))seasonalSelection.set(key,id);
  }
  const selectedLook = (character,season=activeSeason) => W.selectForSeason(character,season,seasonalSelection.get(character+':'+season)||outfitSelection.get(character));
  function persist(){
    if(!ready||!activeCharacterId)return;
    const value={outfit:activeOutfitId,outfits:Object.fromEntries(outfitSelection),season:activeSeason,seasonOutfits:Object.fromEntries(seasonalSelection),settings,studio:studio.state};
    try{localStorage.setItem('studio-session-v2',JSON.stringify(value));}catch(e){}
  }
  function displayName(record){return W.characterForOutfit(W.fromRecord(record))?.name||record.name;}
  const editableButtons = ['downloadButton', 'saveButton', 'demoButton', 'compareButton', 'resetButton', 'headRegionButton'];
  editableButtons.forEach(id => { $(id).disabled = true; });

  const studio = new window.StudioController({
    canvas, stage, render, resize, update, notify, persist, capture: capturePhoto,
    settings: () => settings, bounds: () => bounds,
    context: () => ({ characterId: activeCharacterId, outfitId: activeOutfitId, useExpressions: useResponseAssets,
      label: W.getCharacter(activeCharacterId)?.label || name, outfit: W.find(activeOutfitId)?.label || name })
  });

  for (const character of W.CHARACTERS) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'character-choice'; button.dataset.character = character.id;
    button.setAttribute('aria-label', '切换角色：' + character.label); button.setAttribute('aria-pressed', 'false'); button.disabled = true;
    const thumbnail = document.createElement('img'); thumbnail.src = W.thumbnailFor?.(character.base) || 'assets/thumbnails/' + character.base + '.webp'; thumbnail.decoding = 'async'; thumbnail.fetchPriority = 'low'; thumbnail.width = 192; thumbnail.height = 288; thumbnail.alt = '';
    thumbnail.onerror = () => { thumbnail.onerror = null; thumbnail.src = character.file; };
    const label = document.createElement('span'); label.textContent = character.label;
    button.append(framedThumbnail(thumbnail, character.base, 'character-thumbnail'), label);
    button.addEventListener('click', () => changeOutfit(selectedLook(character.id).id));
    $('characterPicker').append(button);
  }

  for(const season of W.SEASONS){
    const button=document.createElement('button');
    button.type='button';button.dataset.season=season.id;button.textContent=season.label;
    button.setAttribute('aria-label','选择季节：'+season.label);button.setAttribute('aria-pressed','false');
    button.addEventListener('click',()=>changeOutfit(selectedLook(activeCharacterId||'sweet',season.id).id,season.id));
    $('seasonPicker').append(button);
  }

  function framedThumbnail(image, outfitId, className) {
    const frame = W.frameForOutfit(outfitId), holder = document.createElement('span');
    holder.className = className; holder.setAttribute('aria-hidden', 'true');
    // Thumbnails retain the original 2:3 canvas; use the approved source framing.
    holder.style.aspectRatio = String(frame.width * 1024 / (frame.height * 1536));
    image.style.width = 100 / frame.width + '%'; image.style.height = 100 / frame.height + '%';
    image.style.left = -100 * frame.x / frame.width + '%'; image.style.top = -100 * frame.y / frame.height + '%';
    holder.append(image); return holder;
  }

  function populateOutfits(characterId) {
    const catalogueKey=characterId+':'+activeSeason;
    if (renderedCharacterId === catalogueKey) return;
    renderedCharacterId = catalogueKey; $('outfitList').replaceChildren();
    const looks=W.forSeason(characterId,activeSeason);
    $('outfitList').style.gridTemplateColumns='repeat('+Math.min(looks.length,3)+', minmax(0, 1fr))';
    for (const look of looks) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'outfit-card'; button.dataset.outfit = look.id;
    button.setAttribute('aria-label', '换装：' + look.label); button.setAttribute('aria-pressed', 'false');
    button.disabled = true;
    const thumbnail = document.createElement('img'); thumbnail.src = W.thumbnailFor?.(look.id) || 'assets/thumbnails/' + look.id + '.webp'; thumbnail.decoding = 'async'; thumbnail.fetchPriority = 'low'; thumbnail.alt = ''; thumbnail.width = 44; thumbnail.height = 54;
    thumbnail.onerror = () => { thumbnail.onerror = null; thumbnail.src = look.file; };
    const label = document.createElement('span'); label.textContent = look.label;
    button.append(framedThumbnail(thumbnail, look.id, 'outfit-thumbnail'), label); button.addEventListener('click', () => changeOutfit(look.id));
    $('outfitList').append(button);
    }
  }

  function syncWardrobe() {
    const busy = Boolean(outfitRequest);
    populateOutfits(activeCharacterId || 'sweet');
    $('seasonPicker').querySelectorAll('button').forEach(button=>{
      button.disabled=!ready||!activeCharacterId;
      button.setAttribute('aria-pressed',String(button.dataset.season===activeSeason));
    });
    $('characterPicker').querySelectorAll('button').forEach(button => {
      button.disabled = !ready;
      button.setAttribute('aria-pressed', String(button.dataset.character === activeCharacterId));
      button.setAttribute('aria-busy', String(busy && W.find(pendingOutfitId)?.characterId === button.dataset.character));
    });
    $('wardrobe').setAttribute('aria-busy', String(busy));
    $('outfitButton').disabled = !ready || !activeCharacterId;
    $('outfitButton').title = '搭配今日穿搭、场景与灯光';
    $('outfitList').querySelectorAll('button').forEach(button => {
      button.disabled = !ready;
      button.setAttribute('aria-pressed', String(button.dataset.outfit === activeOutfitId));
      button.setAttribute('aria-busy', String(busy && button.dataset.outfit === pendingOutfitId));
    });
    const look = W.find(activeOutfitId);
    const looks=W.forSeason(activeCharacterId||'sweet',activeSeason);
    $('outfitCounter').textContent = (look ? String(looks.indexOf(look)+1).padStart(2,'0') : '—')+' / '+String(looks.length).padStart(2,'0');
    $('outfitStatus').textContent = busy ? '正在准备穿搭…' : look ? look.label + ' · ' + look.name : '选择角色及穿搭';
  }

  function trimOutfitCache(protectedId) {
    // Keep six decoded originals, plus any in-flight selections. Visible/export
    // sources remain pinned until the next successful character change.
    for (const [id] of outfitCache) {
      if (outfitImages.size <= 6) break;
      const cached = outfitImages.get(id);
      if (!cached || cached === image || id === pendingOutfitId || id === protectedId) continue;
      outfitCache.get(id).then(data => URL.revokeObjectURL(data.url), () => {});
      outfitCache.delete(id); outfitImages.delete(id);
    }
  }
  async function loadOutfit(id) {
    if (!outfitCache.has(id)) {
      const promise = (async () => {
        const response = await fetch(W.find(id).file);
        if (!response.ok) throw new Error('这套穿搭暂时无法载入，请重试。');
        const blob = await response.blob();
        const decoded = await decode(blob, W.frameForOutfit(id));
        outfitImages.set(id, decoded.image);
        trimOutfitCache(id);
        return { ...decoded, blob };
      })();
      outfitCache.set(id, promise);
      promise.catch(() => { outfitCache.delete(id); });
    }
    const promise = outfitCache.get(id);
    outfitCache.delete(id); outfitCache.set(id, promise);
    return promise;
  }

  async function changeOutfit(id, season = activeSeason) {
    if (!ready || !W.find(id)) return;
    const nextSeason=W.seasonForOutfit(id,season);
    if(id===activeOutfitId&&!outfitRequest){
      if(activeSeason!==nextSeason){
        ++uploadSequence;activeSeason=nextSeason;
        seasonalSelection.set(activeCharacterId+':'+activeSeason,id);
        syncWardrobe();warmWardrobe(activeCharacterId);persist();
      }
      return true;
    }
    const sequence = ++uploadSequence;
    outfitRequest = sequence; pendingOutfitId=id; syncWardrobe();
    try {
      const loaded = await loadOutfit(id);
      // A newer upload or saved-version selection takes precedence over a late outfit load.
      if (sequence !== uploadSequence) return;
      activeSeason=nextSeason;
      setCharacter(loaded, loaded.blob, W.characterForOutfit(id).name, 'outfit:' + id, settings, id);
      trimOutfitCache(id);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const thumbnail=$('outfitList').querySelector('[data-outfit="'+id+'"] img');
        thumbnail?.animate([{ opacity: .65 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
      }
      warmWardrobe(W.find(id).characterId);persist();return true;
    } catch (error) {
      if (sequence === uploadSequence) notify(error.message || '换装失败，请重试。', true);
    } finally {
      if (outfitRequest === sequence) { outfitRequest = 0; pendingOutfitId=null; syncWardrobe(); }
    }
  }
  let warmRequest=0, warmHandle;
  function warmWardrobe(characterId){
    const token=++warmRequest, season=activeSeason, outfit=activeOutfitId;
    if(warmHandle!==undefined){
      if(window.cancelIdleCallback)window.cancelIdleCallback(warmHandle);else clearTimeout(warmHandle);
    }
    const current=()=>token===warmRequest&&characterId===activeCharacterId&&season===activeSeason&&outfit===activeOutfitId;
    const warm=async()=>{
      if(!current()||document.hidden)return;
      // Finish the visible character before warming another large original.
      try{await Promise.all([StudioEffects.loadCharacter(characterId),StudioEffects.loadLook(outfit)]);}catch{return;}
      if(!current()||document.hidden)return;
      const connection=navigator.connection;
      if(connection?.saveData||['slow-2g','2g'].includes(connection?.effectiveType))return;
      for(const look of W.forSeason(characterId,season)){
        if(!current()||document.hidden)return;
        if(look.id===outfit)continue;
        try{await loadOutfit(look.id);}catch{/* Foreground choices retry failures. */}
        // Other looks' gestures stay on demand instead of competing with the main scene.
      }
    };
    warmHandle=window.requestIdleCallback?window.requestIdleCallback(warm,{timeout:1200}):setTimeout(warm,600);
  }
  $('outfitButton').addEventListener('click', async () => {
    if(!ready||!activeCharacterId)return;
    const character=activeCharacterId,season=activeSeason;
    const looks=W.forSeason(activeCharacterId,season);
    const current=W.find(pendingOutfitId)?.characterId===character?pendingOutfitId:activeOutfitId;
    const id=$('lockOutfit').checked?activeOutfitId:StudioModel.pickDaily(looks.map(x=>x.id),current);
    if((id!==activeOutfitId||outfitRequest)&&!await changeOutfit(id))return;
    const selection=uploadSequence;
    if(activeCharacterId!==character||activeOutfitId!==id||activeSeason!==season)return;
    const index=looks.findIndex(x=>x.id===id);
    const arrangements=[{scene:'studio',background:'transparent',light:'day'},{scene:'magazine',background:'transparent',light:'cool'},{scene:'polaroid',background:'transparent',light:'warm'}];
    const selectedScene=$('lockOutfit').checked||looks.length===1?StudioModel.pickDaily(arrangements.map(x=>x.scene),studio.state.scene):arrangements[index%arrangements.length].scene;
    const a=arrangements.find(x=>x.scene===selectedScene);
    if(!$('lockScene').checked){const l=StudioModel.LIGHT_PRESETS[a.light];studio.setState({scene:a.scene,lightEnabled:true,lightX:l.x,lightY:l.y,crop:'full',scale:1,offsetX:0,offsetY:0,caption:''});update({background:a.background,lightColor:l.color,lightIntensity:l.intensity});}
    const actions=StudioModel.PROFILES[activeCharacterId].actions;
    await studio.respond(actions[$('lockOutfit').checked||looks.length===1?Math.floor(Math.random()*actions.length):index%actions.length][0]);
    if(selection===uploadSequence)persist();
  });
  $('outfitCompare').addEventListener('click',async()=>{
    if(!ready||!activeCharacterId)return;
    const character=activeCharacterId,season=activeSeason,options=studio.options();
    const list=$('outfitCompareList');list.replaceChildren();$('compareTitle').textContent=name;$('outfitCompareDialog').showModal();
    try{for(const look of W.forSeason(character,season)){
      const data=await loadOutfit(look.id);await StudioEffects.loadLook(look.id);
      if(!$('outfitCompareDialog').open||activeCharacterId!==character||activeSeason!==season)return;
      const preview=document.createElement('canvas');preview.width=400;preview.height=500;
      R.draw(preview,data.image,{...settings,zoom:1},{export:true,photograph:true,studio:{...options,outfitId:look.id,state:{...options.state,scene:'studio',crop:'full',scale:1,offsetX:0,offsetY:0}}});
      const b=document.createElement('button');b.type='button';const im=document.createElement('img');im.src=preview.toDataURL();im.alt=look.label;const label=document.createElement('span');label.textContent=look.label;b.append(im,label);b.addEventListener('click',()=>{changeOutfit(look.id);$('outfitCompareDialog').close();});list.append(b);
    }}catch(e){$('outfitCompareDialog').close();notify('对比图片未能载入，请重试。',true);}
  });
  $('closeOutfitCompare').addEventListener('click',()=>$('outfitCompareDialog').close());

  function releaseSource() {
    if (!sourceObjectURL) return;
    // Cached looks stay decoded for instant subsequent changes.
    if (!W.LOOKS.some(look => image === outfitImages.get(look.id))) URL.revokeObjectURL(sourceObjectURL);
  }
  const outfitImages = new Map();

  function notify(message, error = false) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.toggle('is-error', error);
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, error ? 6500 : 3200);
  }

  function icon(id) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-' + id); svg.append(use);
    return svg;
  }

  function makePalette(container, options, key) {
    for (const option of options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'swatch';
      button.dataset.value = option.value;
      button.title = option.name;
      button.setAttribute('aria-label', option.value === '' ? 'Original lighting' : option.name + (key === 'lightColor' ? ' lighting' : ' background'));
      button.setAttribute('aria-pressed', 'false');
      if (option.value === '' || option.value === 'transparent') button.classList.add('is-transparent');
      else if (option.value === 'sunset') button.style.setProperty('--swatch', 'linear-gradient(135deg,#f8c762,#e78334)');
      else if (option.value === 'sky') button.style.setProperty('--swatch', 'linear-gradient(135deg,#e7f2f5,#8fbcd4)');
      else button.style.setProperty('--swatch', option.value);
      button.addEventListener('click', () => update({ [key]: option.value }));
      container.append(button);
    }
    if (key === 'lightColor') {
      const custom = document.createElement('button');
      custom.type = 'button'; custom.className = 'swatch is-custom';
      custom.title = 'Custom colour'; custom.setAttribute('aria-label', 'Custom colour lighting');
      custom.dataset.custom = 'true'; custom.setAttribute('aria-pressed', 'false');
      custom.addEventListener('click', () => $('customLight').click());
      container.append(custom);
    }
  }
  makePalette($('lightPalette'), M.LIGHTS, 'lightColor');
  makePalette($('backgroundPalette'), M.BACKGROUNDS, 'background');

  function syncControls(s = settings) {
    for (const key of ranges) {
      const input = $(key);
      input.value = Math.round(s[key] * 100);
      const percentage = key === 'lightIntensity' ? s[key] * 100 : (s[key] + 1) * 50;
      input.style.setProperty('--fill', percentage + '%');
    }
    $('zoomValue').textContent = Math.round(s.zoom * 100) + '%';
    $('characterName').textContent = name;
    canvas.setAttribute('aria-label', name + ' character preview · 点击或按回车互动');
    document.title = name + ' · Character Studio';
    for (const [id, key] of [['lightPalette', 'lightColor'], ['backgroundPalette', 'background']]) {
      $(id).querySelectorAll('[data-value]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.value === s[key]));
      });
    }
    const custom = $('lightPalette').querySelector('[data-custom]');
    custom.setAttribute('aria-pressed', String(Boolean(s.lightColor) && !M.LIGHTS.some(x => x.value === s.lightColor)));
    $('headMove').setAttribute('aria-valuenow', String(Math.round(s.headBoundary * 100)));
    syncWardrobe();
  }

  function setDark(hex) {
    const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
    const luminance = match ? 0.2126 * parseInt(match[1], 16) + 0.7152 * parseInt(match[2], 16) + 0.0722 * parseInt(match[3], 16) : 190;
    document.body.classList.toggle('is-dark', luminance < 115);
  }

  function sceneBackground(value,options) {
    const defaults = ['#cbbba5', '#d2c5b3', '#e4dfd5'];
    let colours = defaults;
    if (value === 'sunset') colours = ['#eba24a', '#f2bb66', '#f5d29b'];
    else if (value === 'sky') colours = ['#9ec5dc', '#b7d4e4', '#d7e9f1'];
    else if (M.validHex(value)) colours = [value, value, value];
    if(options)colours=StudioEffects.palette({...settings,background:value},{...options.state,scene:'studio'},options.lighting);
    ['--studio-top', '--studio-middle', '--studio-floor'].forEach((key, i) => document.body.style.setProperty(key, colours[i]));
    setDark(colours[1]);
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    render();
  }

  function render() {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => {
      framePending = false;
      if (!ready) return;
      const options=studio.options();
      bounds = R.draw(canvas, image, studio.camera ? { ...settings, zoom: 1 } : settings, { original: comparing, studio: options, photograph: studio.camera });
      canvas.dataset.pose = studio.pose().id || 'idle';
      canvas.dataset.frame = String(++paintFrame);
      sceneBackground(comparing ? M.DEFAULTS.background : settings.background,comparing?null:options);
      positionHeadRegion();
    });
  }

  function positionHeadRegion() {
    if (!bounds || $('headRegion').hidden) return;
    const ratio = canvas.width / stage.clientWidth;
    const region = $('headRegion');
    const height = (bounds.headBottom - bounds.y) / ratio;
    const width = Math.min(bounds.width / ratio * 1.05, height * 1.4);
    const center = (bounds.x + bounds.width * settings.headCenter) / ratio;
    region.style.width = width + 'px'; region.style.height = height + 'px';
    region.style.left = (center - width / 2) + 'px'; region.style.top = bounds.y / ratio + 'px';
  }

  function update(patch) {
    if (!ready) return;
    comparing = false; $('compareButton').classList.remove('is-held');
    settings = M.sanitizeSettings({ ...settings, ...patch });
    if (Object.prototype.hasOwnProperty.call(patch, 'lightColor')) studio.state.lightEnabled = Boolean(patch.lightColor);
    studio.updateLight();
    syncControls(); studio.sync(); render();persist();
  }
  for (const key of ranges) $(key).addEventListener('input', event => update({ [key]: Number(event.target.value) / 100 }));
  $('customLight').addEventListener('input', event => update({ lightColor: event.target.value }));
  $('zoomIn').addEventListener('click', () => update({ zoom: Math.round((settings.zoom + 0.1) * 10) / 10 }));
  $('zoomOut').addEventListener('click', () => update({ zoom: Math.round((settings.zoom - 0.1) * 10) / 10 }));
  $('zoomReset').addEventListener('click', () => update({ zoom: 1 }));
  $('resetButton').addEventListener('click', () => {
    studio.restore();
    update({ ...M.DEFAULTS });
    notify('已恢复当前穿搭的原始比例与灯光。');
  });

  function compare(value) {
    if (!ready) return;
    comparing = value;
    $('compareButton').classList.toggle('is-held', value);
    render();
  }
  $('compareButton').addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId); compare(true);
  });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) $('compareButton').addEventListener(eventName, () => compare(false));
  window.addEventListener('blur', () => compare(false));
  window.addEventListener('keydown', event => {
    if (event.code === 'Space' && (event.target === document.body || event.target === $('compareButton') || event.target === canvas)) {
      event.preventDefault(); compare(true);
    }
    if (event.key === 'Escape') { compare(false); }
  });
  window.addEventListener('keyup', event => { if (event.code === 'Space' && comparing) compare(false); });

  $('headRegionButton').addEventListener('click', () => {
    const visible = $('headRegion').hidden;
    $('headRegion').hidden = !visible;
    $('headRegionButton').setAttribute('aria-pressed', String(visible));
    positionHeadRegion();
  });
  function headDrag(element, resizeOnly) {
    let start;
    element.addEventListener('pointerdown', event => {
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      start = { x: event.clientX, y: event.clientY, center: settings.headCenter,
        boundary: settings.headBoundary, width: bounds.width * stage.clientWidth / canvas.width,
        height: bounds.height * stage.clientWidth / canvas.width };
    });
    element.addEventListener('pointermove', event => {
      if (!start) return;
      update({ headBoundary: start.boundary + (event.clientY - start.y) / start.height,
        headCenter: resizeOnly ? start.center : start.center + (event.clientX - start.x) / start.width });
    });
    for (const e of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(e, () => { start = null; });
  }
  headDrag($('headMove'), false); headDrag($('headResize'), true);
  $('headMove').addEventListener('keydown', event => {
    const patch = {};
    if (event.key === 'ArrowDown') patch.headBoundary = settings.headBoundary + 0.01;
    if (event.key === 'ArrowUp') patch.headBoundary = settings.headBoundary - 0.01;
    if (event.key === 'ArrowLeft') patch.headCenter = settings.headCenter - 0.01;
    if (event.key === 'ArrowRight') patch.headCenter = settings.headCenter + 0.01;
    if (Object.keys(patch).length) { event.preventDefault(); update(patch); }
  });

  function decode(blob, frame) {
    return new Promise((resolve, reject) => {
      const objectURL = URL.createObjectURL(blob);
      const decoded = new Image();
      decoded.onload = () => {
        if (decoded.naturalWidth * decoded.naturalHeight > 24000000) {
          URL.revokeObjectURL(objectURL); reject(new Error('Use an image smaller than 24 megapixels.')); return;
        }
        try { R.prepare(decoded, { frame }); }
        catch (error) { URL.revokeObjectURL(objectURL); reject(error); return; }
        resolve({ image: decoded, url: objectURL, frame });
      };
      decoded.onerror = () => { URL.revokeObjectURL(objectURL); reject(new Error('This image could not be opened. Try a PNG, JPEG or WebP.')); };
      decoded.src = objectURL;
    });
  }

  function setCharacter(decoded, blob, characterName, id, savedSettings, outfitId = null, responseAssets = null) {
    compare(false);
    releaseSource();
    image = decoded.image; sourceObjectURL = decoded.url; sourceBlob = blob; sourceFrame = decoded.frame;
    name = W.characterForOutfit(outfitId)?.name || characterName; currentId = id;
    activeOutfitId = W.find(outfitId)?.id || null;
    activeCharacterId = W.characterForOutfit(activeOutfitId)?.id || null;
    if (activeCharacterId) {
      activeSeason=W.seasonForOutfit(activeOutfitId,activeSeason);
      outfitSelection.set(activeCharacterId, activeOutfitId);
      seasonalSelection.set(activeCharacterId+':'+activeSeason,activeOutfitId);
    }
    settings = M.sanitizeSettings(savedSettings || M.DEFAULTS);
    studio.updateLight(true);
    useResponseAssets = responseAssets ?? (id.startsWith('outfit:') || id.startsWith('original:'));
    $('headRegion').hidden = true; $('headRegionButton').setAttribute('aria-pressed', 'false');
    $('demoButton').hidden = !activeOutfitId;
    studio.changed(); syncControls(); render();persist();
  }

  document.querySelectorAll('.more-menu button').forEach(b=>b.addEventListener('click',()=>b.closest('details').open=false));
  $('uploadButton').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { notify('Choose a PNG, JPEG or WebP image.', true); return; }
    if (file.size > 20 * 1024 * 1024) { notify('Use an image smaller than 20 MB.', true); return; }
    const sequence = ++uploadSequence;
    try {
      $('uploadButton').disabled = true;
      const decoded = await decode(file);
      if (sequence !== uploadSequence) { URL.revokeObjectURL(decoded.url); return; }
      setCharacter(decoded, file, file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'Your character', 'upload');
      notify('Character uploaded. Use the target icon to adjust its head region.');
    } catch (error) { notify(error.message || 'Could not open this image.', true); }
    finally { $('uploadButton').disabled = false; }
  });

  function exportCanvas({ thumbnail = false, photograph = false, studioOptions = studio.options() } = {}) {
    const exported = document.createElement('canvas');
    const size=photograph?StudioModel.photoSize(studioOptions.state.ratio):{width:1200,height:1500};
    exported.width=thumbnail?240:size.width;exported.height=thumbnail?Math.round(240*size.height/size.width):size.height;
    const exportSettings = { ...settings, zoom: 1 };
    if (thumbnail && exportSettings.background === 'transparent') exportSettings.background = '#dcd0be';
    R.draw(exported, image, exportSettings, { export: true, photograph, studio: studioOptions });
    return exported;
  }
  function toBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare the PNG.')), 'image/png'));
  }
  $('downloadButton').addEventListener('click', async () => {
    try {
      $('downloadButton').disabled = true;
        const exported = exportCanvas();
      const blob = await toBlob(exported);
      const url = URL.createObjectURL(blob);
      const link = $('downloadLink');
      const exportName = name + (W.find(activeOutfitId) ? ' ' + W.find(activeOutfitId).name : '');
      link.href = url; link.download = exportName.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') + '.png';
      $('exportImage').src = exported.toDataURL('image/png');
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      notify('PNG ready · 1200 × 1500.');
    } catch (error) { notify(error.message || 'Could not download this version.', true); }
    finally { $('downloadButton').disabled = false; }
  });

  async function capturePhoto() {
    const studioOptions = studio.options(), snapshot = studio.snapshot();
    const exported = exportCanvas({ photograph: true, studioOptions });
    const thumbnail = document.createElement('canvas'); thumbnail.width = 240; thumbnail.height = Math.round(240*exported.height/exported.width);
    thumbnail.getContext('2d').drawImage(exported, 0, 0, thumbnail.width, thumbnail.height);
    const record = { id: crypto.randomUUID(), kind: 'photo', name, characterId: activeCharacterId,
      outfitId: activeOutfitId, season: activeSeason, settings: M.sanitizeSettings(settings), createdAt: Date.now(),
      imageBlob: sourceBlob, frame: sourceFrame || null, studio: snapshot,
      responseVersion: useResponseAssets ? 2 : 0, thumbnail: thumbnail.toDataURL('image/png') };
    const blob = await toBlob(exported);
    record.photoBlob = blob;
    $('exportImage').src = exported.toDataURL('image/png');
    openPhoto(blob, record, false);
  }
  function openPhoto(blob, record, saved) {
    if (photoURL) URL.revokeObjectURL(photoURL);
    photoURL = URL.createObjectURL(blob); lastPhoto = { blob, record, saved };
    $('photoResult').src = photoURL;
    $('photoTitle').textContent=record.studio?.state?.caption||displayName(record);
    $('downloadPhoto').dataset.size=record.studio?.state?.ratio||'portrait';
    $('savePhoto').disabled = saved; $('savePhoto').textContent = saved ? '已收藏' : '收藏';
    $('retakePhoto').disabled = !record.imageBlob; $('retakePhoto').textContent = saved ? '继续编辑' : '调整重拍';
    $('retakePhoto').title = record.imageBlob ? '' : '这张照片未保存可编辑素材';
    if (!$('photoDialog').open) $('photoDialog').showModal();
  }
  $('closePhoto').addEventListener('click', () => $('photoDialog').close());
  $('photoDialog').addEventListener('click', event => {
    if (event.target !== $('photoDialog')) return;
    const r = event.target.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close();
  });
  $('retakePhoto').addEventListener('click', async () => {
    const photo = lastPhoto;
    if (!photo?.record.imageBlob) return;
    const button = $('retakePhoto'); button.disabled = true; button.setAttribute('aria-busy', 'true');
    try {
      const restored = await restoreRecord(photo.record, false, () => lastPhoto === photo && $('photoDialog').open);
      if (!restored) return;
      $('photoDialog').close(); studio.enterCamera();
    } catch (error) { notify('未能恢复这张照片，请重试。', true); }
    finally { button.disabled = !lastPhoto?.record.imageBlob; button.setAttribute('aria-busy', 'false'); }
  });
  $('savePhoto').addEventListener('click', async () => {
    if (!lastPhoto || lastPhoto.saved) return;
    const photo = lastPhoto; $('savePhoto').disabled = true;
    try {
      await S.saveVersion(photo.record); await refreshLibrary(); photo.saved = true;
      $('savePhoto').textContent = '已收藏'; notify('已收藏');
    } catch (error) { $('savePhoto').disabled = false; notify('照片未能保存，请下载 PNG 保留。', true); }
  });
  $('downloadPhoto').addEventListener('click', () => {
    if (!lastPhoto) return;
    const link = $('downloadLink'); link.href = photoURL;
    link.download = displayName(lastPhoto.record) + '-ootd-' + lastPhoto.record.createdAt + '.png';
    link.click();
  });

  async function refreshLibrary() {
    versions = await S.listVersions();
    $('versionCount').textContent = versions.length;
    $('versionCount').hidden = !versions.length;
    return versions;
  }

  $('saveButton').addEventListener('click', async () => {
    if (!ready) return;
    const button = $('saveButton');
    try {
      button.disabled = true;
      const record = {
        id: crypto.randomUUID(), name, characterId: activeCharacterId, outfitId: activeOutfitId, season: activeSeason, settings: M.sanitizeSettings(settings),
        createdAt: Date.now(), imageBlob: sourceBlob, frame: sourceFrame || null,
        responseVersion: useResponseAssets ? 2 : 0, studio: studio.snapshot(),
        thumbnail: exportCanvas({ thumbnail: true }).toDataURL('image/png')
      };
      await S.saveVersion(record);
      await refreshLibrary();
      notify('版本已保存在当前浏览器。');
    } catch (error) {
      notify('Could not save this version. Browser storage may be full or unavailable.', true);
      console.warn('Version save failed:', error);
    } finally { button.disabled = false; }
  });

  async function restoreRecord(record, original = false, stillCurrent = () => true) {
    const sequence = ++uploadSequence, outfitId = W.fromRecord(record);
    const expressions = original || Boolean(W.find(outfitId) && record.responseVersion >= 1);
    let decoded, adopted = false;
    try {
      decoded = original ? await loadOutfit(outfitId) : await decode(record.imageBlob, W.frameForRecord(record));
      if (sequence !== uploadSequence || !stillCurrent()) return false;
      if (expressions) await Promise.all([
        StudioEffects.loadCharacter(W.characterForOutfit(outfitId).id), StudioEffects.loadLook(outfitId)
      ]);
      if (sequence !== uploadSequence || !stillCurrent()) return false;
      activeSeason=W.seasonForRecord(record,activeSeason);
      setCharacter(decoded, original ? decoded.blob : record.imageBlob, record.name,
        original ? 'original:' + outfitId : record.id, original ? M.DEFAULTS : record.settings, outfitId, expressions);
      adopted = true;
      if (!original) studio.restore(record.studio);
      persist(); return true;
    } finally {
      if (decoded && !original && !adopted) URL.revokeObjectURL(decoded.url);
    }
  }

  function libraryCard(record, original = false) {
    const card = document.createElement('div'); card.className = 'version-card'+(record.kind==='photo'?' photo-card':'');
    const select = document.createElement('button'); select.type = 'button'; select.className = 'version-select';
    const shown=displayName(record),shownTitle=record.studio?.state?.caption || (record.title&&record.title!==record.name?record.title:shown);
    select.setAttribute('aria-label', original ? '载入角色：' + shown : '打开作品：' + shownTitle);
    const thumb = document.createElement('img'); thumb.alt = shownTitle; thumb.src = record.thumbnail;
    const title = document.createElement('span');
    const savedOutfit = W.fromRecord(record);
    title.textContent = shownTitle + (W.find(savedOutfit) ? ' · ' + W.find(savedOutfit).label : '');
    const date = document.createElement('small');
    date.textContent = original ? '原版角色' : (record.kind === 'photo' ? '照片 · ' : '') + new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(record.createdAt);
    select.append(thumb, title, date);
    select.addEventListener('click', async () => {
      if (record.kind === 'photo' && record.photoBlob) {
        $('libraryDialog').close(); openPhoto(record.photoBlob, record, true); return;
      }
      try {
        select.disabled = true;
        if (await restoreRecord(record, original, () => $('libraryDialog').open)) $('libraryDialog').close();
      } catch (error) { notify('未能打开这份作品，请重试。', true); }
      finally { select.disabled = false; }
    });
    card.append(select);
    if (!original) {
      if(record.kind==='photo'){
        const favorite=document.createElement('button');favorite.type='button';favorite.className='favorite-photo';favorite.textContent=record.favorite?'★':'☆';favorite.setAttribute('aria-label','喜欢这张照片');favorite.setAttribute('aria-pressed',String(Boolean(record.favorite)));
        favorite.addEventListener('click',async()=>{favorite.disabled=true;try{const next={...record,favorite:!record.favorite};await S.saveVersion(next);await refreshLibrary();populateLibrary();}catch(e){favorite.disabled=false;notify('未能更新收藏',true);}});card.append(favorite);
      }
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-version';
      remove.setAttribute('aria-label', '删除作品：' + shown); remove.title = 'Delete version'; remove.append(icon('trash'));
      remove.addEventListener('click', async () => {
        try {
          remove.disabled = true; await S.deleteVersion(record.id); await refreshLibrary();
          if (currentId === record.id) {
            const sequence = ++uploadSequence;
            const character = W.getCharacter(activeCharacterId) || W.getCharacter('sweet');
            const base = await loadOutfit(character.base);
            if (sequence === uploadSequence) setCharacter(base, base.blob, character.name, 'original:' + character.base, M.DEFAULTS, character.base);
          }
          populateLibrary(); notify('Version deleted.');
        } catch (error) { remove.disabled = false; notify('Could not delete this version.', true); }
      });
      card.append(remove);
    }
    return card;
  }

  function populateLibrary() {
    const list=$('libraryList');list.replaceChildren();list.classList.toggle('photo-wall',libraryView==='photos');
    document.querySelectorAll('[data-library]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.library===libraryView)));
    if(libraryView==='characters')for(const character of W.CHARACTERS)list.append(libraryCard({name:character.name,thumbnail:character.file,characterId:character.id,outfitId:character.base},true));
    else {
      const records=versions.filter(x=>libraryView==='photos'?x.kind==='photo':x.kind!=='photo').sort((a,b)=>Number(Boolean(b.favorite))-Number(Boolean(a.favorite))||b.createdAt-a.createdAt);
      for(const record of records)list.append(libraryCard(record));
      if(!records.length){const empty=document.createElement('div');empty.className='library-empty';const text=document.createElement('p');text.textContent=libraryView==='photos'?'还没有照片':'还没有版本';empty.append(text);if(libraryView==='photos'){const b=document.createElement('button');b.type='button';b.className='save-button';b.textContent='拍一张';b.addEventListener('click',()=>{$('libraryDialog').close();studio.enterCamera();});empty.append(b);}list.append(empty);}
    }
  }
  document.querySelectorAll('[data-library]').forEach(b=>b.addEventListener('click',()=>{libraryView=b.dataset.library;populateLibrary();}));
  $('libraryButton').addEventListener('click', async () => {
    if (!ready) return;
    try { await refreshLibrary(); populateLibrary(); $('libraryDialog').showModal(); }
    catch (error) { notify('Saved versions are unavailable in this browser.', true); }
  });
  $('closeLibrary').addEventListener('click', () => $('libraryDialog').close());
  $('libraryDialog').addEventListener('click', event => {
    if (event.target !== $('libraryDialog')) return;
    const rect = event.target.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close();
  });

  new ResizeObserver(resize).observe(stage);
  window.addEventListener('beforeunload', () => {
    releaseSource();
    if (photoURL) URL.revokeObjectURL(photoURL);
    for (const entry of outfitCache.values()) Promise.resolve(entry).then(look => URL.revokeObjectURL(look.url), () => {});
  });

  async function init() {
    try {
      const requested=W.find(sessionData.outfit)?.id||'autumn';
      const initial=W.selectForSeason(W.characterForOutfit(requested).id,activeSeason,requested).id;
      const decoded = await loadOutfit(initial);
      image = decoded.image; sourceBlob = decoded.blob; sourceObjectURL = decoded.url; sourceFrame = decoded.frame;
      activeOutfitId=initial;activeCharacterId=W.characterForOutfit(initial).id;name=W.characterForOutfit(initial).name;
      outfitSelection.set(activeCharacterId,initial);seasonalSelection.set(activeCharacterId+':'+activeSeason,initial);
      if(sessionData.settings)settings=M.sanitizeSettings(sessionData.settings);if(sessionData.studio)studio.state=StudioModel.sanitize(sessionData.studio);
      ready = true; editableButtons.forEach(id => { $(id).disabled = false; }); studio.setReady(true);
      $('loading').hidden = true; syncControls(); resize();warmWardrobe(activeCharacterId);
      await refreshLibrary().catch(() => { /* Editing and export remain usable without persistent storage. */ });
    } catch (error) {
      $('loading').textContent = 'Could not load your character. Start the local server and reload.';
      notify(error.message || 'Could not start the studio.', true);
    }
  }
  init();
})();
