(function(root){
  'use strict';
  const M=root.StudioModel,$=id=>document.getElementById(id);
  class StudioController{
    constructor(api){
      this.api=api;this.state={...M.DEFAULTS};this.time=0;this.previous=null;
      const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.lightTransition=new M.LightTransition(M.lightTarget(api.settings(),this.state));this.lightPending=false;
      this.idle=!reduced;this.paused=reduced;this.action=null;this.frozen=null;
      this.pendingResponse=null;this.queuedResponse=null;
      this.ready=false;this.camera=false;this.countdown=new M.Countdown();this.lastPaint=0;this.frame=null;
      this.bind();this.sync();
    }
    context(){return this.api.context();}
    pose(){return this.frozen||M.sample(this.time,this.action,this.idle&&Boolean(this.context().characterId));}
    options(){
      const c=this.context();return {state:{...this.state},lighting:this.lightTransition?.sample(performance.now())||M.lightTarget(this.api.settings(),this.state),pose:M.poseSnapshot(this.pose()),characterId:c.characterId,
        outfitId:c.outfitId,useExpressions:c.useExpressions,
        info:{label:c.label,outfit:c.outfit,date:new Intl.DateTimeFormat('en-CA').format(new Date())}};
    }
    snapshot(){return {state:{...this.state},pose:M.poseSnapshot(this.pose())};}
    restore(snapshot){
      this.state=M.sanitize(snapshot?.state);this.action=null;this.pendingResponse=null;this.queuedResponse=null;
      this.frozen=snapshot?.pose?M.poseSnapshot(snapshot.pose):null;
      this.paused=Boolean(this.frozen)||matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.updateLight(true);
      this.sync();this.api.resize();
    }
    changed(){
      const wasFrozen=Boolean(this.frozen);
      this.cancelCapture();this.action=null;this.frozen=null;this.pendingResponse=null;this.queuedResponse=null;this.responseIndex=0;
      if(wasFrozen&&!this.camera)this.paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
      const c=this.context(),profile=c.useExpressions?M.PROFILES[c.characterId]:null;
      $('responseSection').hidden=!profile;
      $('personality').textContent=profile?.description||'你的角色，你的专属穿搭。';
      $('responseButtons').replaceChildren();$('cameraResponses').replaceChildren();
      for(const [id,name] of profile?.actions||[]){
        const b=document.createElement('button');b.type='button';b.dataset.response=id;
        b.textContent=name;
        b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>this.respond(id));$('responseButtons').append(b);
        const photo=document.createElement('button');photo.type='button';photo.dataset.response=id;photo.textContent=b.textContent;
        photo.setAttribute('aria-pressed','false');photo.addEventListener('click',()=>this.respond(id));$('cameraResponses').append(photo);
      }
      if(c.useExpressions&&c.outfitId){
        const outfit=c.outfitId;
        Promise.all([root.StudioEffects.loadCharacter(c.characterId),root.StudioEffects.loadLook(outfit)]).then(()=>{
          if(this.context().outfitId===outfit){this.sync();this.api.render();}
        }).catch(()=>{if(this.context().outfitId===outfit)this.api.notify('动作素材未能载入，请重试。',true);});
      }
      this.sync();
    }
    setReady(ready){this.ready=ready;this.updateLight(true);this.changed();}
    async respond(id){
      if(!this.ready||!this.context().useExpressions||this.countdown.deadline!==null||!M.PROFILES[this.context().characterId]?.actions.some(x=>x[0]===id))return;
      const outfit=this.context().outfitId;
      const token={id,outfit};this.pendingResponse=token;
      try{await Promise.all([root.StudioEffects.loadLook(outfit),root.StudioEffects.loadCharacter?.(this.context().characterId)]);}catch(e){if(this.pendingResponse===token){this.pendingResponse=null;this.api.notify('动作素材未能载入，请重试。',true);}return;}
      if(this.pendingResponse!==token||this.context().outfitId!==outfit)return;
      this.pendingResponse=null;
      const current=this.pose();
      if(!this.camera&&current.active&&current.id===id&&!this.queuedResponse)return;
      this.frozen=null;this.paused=false;
      if(this.camera){this.queuedResponse=null;this.frozen=M.sample(this.time+.7,{id,start:this.time},false);this.paused=true;this.action=null;}
      else if(current.active&&current.amount>0){
        this.queuedResponse={id,outfit};
        if(!Number.isFinite(this.action?.releaseAt))this.action={id:current.id,start:this.time,releaseAt:this.time,releaseAmount:current.amount};
      }else{this.queuedResponse=null;this.action={id,start:this.time};}
      this.sync();this.api.render();this.schedule();
    }
    updateLight(immediate=false){
      const now=performance.now(),target=M.lightTarget(this.api.settings(),this.state);
      if(!this.lightTransition)this.lightTransition=new M.LightTransition(target);
      this.lightTransition.set(target,now,immediate||matchMedia('(prefers-reduced-motion: reduce)').matches);
      this.lightPending=this.lightTransition.active(now);
      this.schedule();
    }
    setState(patch){this.state=M.sanitize({...this.state,...patch});this.updateLight();this.sync();if(patch.ratio)this.api.resize();else this.api.render();this.api.persist?.();}
    enterCamera(){
      if(!this.ready)return;
      this.cameraWasPaused=this.paused;
      this.pendingResponse=null;this.queuedResponse=null;
      const current=this.pose();if(current.active&&!this.frozen){this.frozen=M.poseSnapshot({...current,amount:1,idle:false});this.paused=true;this.action=null;}
      this.camera=true;this.api.stage.style.setProperty('--photo-ratio',this.ratio());$('advancedSettings').open=false;$('headRegion').hidden=true;
      $('headRegionButton').setAttribute('aria-pressed','false');
      document.body.classList.add('camera-mode');$('cameraControls').hidden=false;
      this.sync();this.api.resize();$('captureButton').focus();
    }
    ratio(){const z=M.photoSize(this.state.ratio);return z.width/z.height;}
    exitCamera(){
      this.cancelCapture();this.camera=false;document.body.classList.remove('camera-mode');$('cameraControls').hidden=true;
      this.pendingResponse=null;this.queuedResponse=null;
      if(!this.cameraWasPaused){this.frozen=null;this.action=null;this.paused=matchMedia('(prefers-reduced-motion: reduce)').matches;this.previous=null;}
      this.sync();this.api.resize();$('photoButton').focus();
      this.schedule();
    }
    cancelCapture(){this.countdown.cancel();$('countdown').hidden=true;this.lock(false);}
    lock(value){
      $('captureButton').disabled=value||!this.ready;
      $('fullCrop').disabled=$('halfCrop').disabled=value;
      document.querySelectorAll('[data-ratio],#photoScale,#photoCaption,#photoDate,#resetComposition').forEach(b=>b.disabled=value);
      $('cancelCapture').hidden=!value;
      $('cameraResponses').querySelectorAll('button').forEach(b=>b.disabled=value);
    }
    sync(){
      const s=this.state,p=this.pose(),enabled=Boolean(this.context().characterId);
      $('photoButton').disabled=!this.ready;$('lightHandle').disabled=!this.ready;
      $('idleButton').disabled=!this.ready||!enabled;
      $('idleButton').setAttribute('aria-pressed',String(this.idle));$('idleButton').textContent=this.idle?'待机':'静止';
      $('demoButton').disabled=!this.ready||!enabled;$('demoLabel').textContent=this.paused?'播放':'暂停';$('demoIcon').setAttribute('href',this.paused?'#i-play':'#i-pause');
      $('demoButton').setAttribute('aria-pressed',String(this.paused));
      const lit=Boolean(s.lightEnabled&&this.api.settings().lightColor);$('lightToggle').setAttribute('aria-pressed',String(lit));$('lightToggle').textContent=lit?'开':'关';
      $('lightHandle').style.left=s.lightX*100+'%';$('lightHandle').style.top=s.lightY*100+'%';
      $('lightHandle').classList.toggle('is-off',!s.lightEnabled||!this.api.settings().lightColor);
      $('lightHandle').hidden=this.camera||s.scene!=='studio';
      $('lightHandle').setAttribute('aria-valuenow',String(Math.round(s.lightX*100)));
      $('lightHandle').setAttribute('aria-valuetext',`横向 ${Math.round(s.lightX*100)}%，纵向 ${Math.round(s.lightY*100)}%`);
      $('lightPosition').textContent=s.lightX<.53?'左侧受光':'右侧受光';
      $('leftLight').setAttribute('aria-pressed',String(s.lightX<.53));$('rightLight').setAttribute('aria-pressed',String(s.lightX>=.53));
      document.querySelectorAll('[data-scene]').forEach(b=>{b.disabled=!this.ready;b.setAttribute('aria-pressed',String(b.dataset.scene===s.scene));});
      this.api.stage.style.setProperty('--photo-ratio',this.ratio());
      document.querySelectorAll('[data-ratio]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ratio===s.ratio)));
      $('photoScale').value=Math.round(s.scale*100);
      if(document.activeElement!==$('photoCaption'))$('photoCaption').value=s.caption;
      $('photoDate').checked=s.showDate;
      document.querySelectorAll('[data-light]').forEach(b=>{const l=M.LIGHT_PRESETS[b.dataset.light],a=this.api.settings();b.setAttribute('aria-pressed',String(s.lightEnabled&&a.lightColor===l.color&&Math.abs(a.lightIntensity-l.intensity)<.001));});
      $('fullCrop').setAttribute('aria-pressed',String(s.crop==='full'));$('halfCrop').setAttribute('aria-pressed',String(s.crop==='half'));
      document.querySelectorAll('[data-response]').forEach(b=>{b.disabled=!this.ready||this.countdown.deadline!==null;b.setAttribute('aria-pressed',String(b.dataset.response===p.id));});
      const active=$('responseButtons').querySelector('[aria-pressed="true"]');
      const text=!enabled?'上传角色支持构图和灯光调整':this.paused?'动态已暂停':p.active?'正在'+(active?.textContent||'回应')+'…':this.idle?(this.context().useExpressions?'待机 · 呼吸与眨眼':'待机 · 轻微呼吸'):'点击人物或按钮，触发回应';
      if($('responseStatus').textContent!==text)$('responseStatus').textContent=text;
    }
    bind(){
      $('photoButton').addEventListener('click',()=>this.enterCamera());$('exitCamera').addEventListener('click',()=>this.exitCamera());
      $('fullCrop').addEventListener('click',()=>this.setState({crop:'full'}));$('halfCrop').addEventListener('click',()=>this.setState({crop:'half'}));
      document.querySelectorAll('[data-ratio]').forEach(b=>b.addEventListener('click',()=>this.setState({ratio:b.dataset.ratio})));
      $('photoScale').addEventListener('input',e=>this.setState({scale:Number(e.target.value)/100}));
      $('photoCaption').addEventListener('input',e=>this.setState({caption:e.target.value}));
      $('photoDate').addEventListener('change',e=>this.setState({showDate:e.target.checked}));
      $('resetComposition').addEventListener('click',()=>this.setState({offsetX:0,offsetY:0,scale:1}));
      document.querySelectorAll('[data-light]').forEach(b=>b.addEventListener('click',()=>{const l=M.LIGHT_PRESETS[b.dataset.light];this.setState({lightEnabled:true,lightX:l.x,lightY:l.y});this.api.update({lightColor:l.color,lightIntensity:l.intensity});}));
      let composition;
      this.api.canvas.addEventListener('pointerdown',e=>{if(!this.camera||this.countdown.deadline!==null)return;composition={x:e.clientX,y:e.clientY,offsetX:this.state.offsetX,offsetY:this.state.offsetY};e.currentTarget.setPointerCapture(e.pointerId);});
      this.api.canvas.addEventListener('pointermove',e=>{if(!composition)return;const r=this.api.canvas.getBoundingClientRect();this.setState({offsetX:composition.offsetX+(e.clientX-composition.x)/r.width,offsetY:composition.offsetY+(e.clientY-composition.y)/r.height});});
      for(const event of ['pointerup','pointercancel','lostpointercapture'])this.api.canvas.addEventListener(event,()=>composition=null);
      this.api.canvas.addEventListener('keydown',e=>{if(!this.camera||this.countdown.deadline!==null)return;const p={};if(e.key==='ArrowLeft')p.offsetX=this.state.offsetX-.01;if(e.key==='ArrowRight')p.offsetX=this.state.offsetX+.01;if(e.key==='ArrowUp')p.offsetY=this.state.offsetY-.01;if(e.key==='ArrowDown')p.offsetY=this.state.offsetY+.01;if(Object.keys(p).length){e.preventDefault();this.setState(p);}});
      document.querySelectorAll('[data-scene]').forEach(b=>b.addEventListener('click',()=>this.setState({scene:b.dataset.scene})));
      $('captureButton').addEventListener('click',()=>{this.countdown.start(performance.now());this.lock(true);$('countdown').hidden=false;$('countdown').textContent='3';this.schedule();});
      $('cancelCapture').addEventListener('click',()=>this.cancelCapture());
      $('idleButton').addEventListener('click',()=>{this.idle=!this.idle;this.frozen=null;if(this.idle)this.paused=false;this.sync();this.api.render();this.schedule();});
      $('demoButton').addEventListener('click',()=>{this.paused=!this.paused;if(!this.paused)this.frozen=null;this.sync();this.api.render();this.schedule();});
      $('lightToggle').addEventListener('click',()=>{
        const enabled=Boolean(this.state.lightEnabled&&this.api.settings().lightColor);
        this.setState({lightEnabled:!enabled});
        if(!enabled&&!this.api.settings().lightColor)this.api.update({lightColor:'#ffd4a4'});
      });
      $('leftLight').addEventListener('click',()=>this.setState({lightX:.22,lightY:.22}));$('rightLight').addEventListener('click',()=>this.setState({lightX:.82,lightY:.22}));
      let drag=false;
      const move=e=>{const r=this.api.stage.getBoundingClientRect();this.setState({lightX:(e.clientX-r.left)/r.width,lightY:(e.clientY-r.top)/r.height});};
      $('lightHandle').addEventListener('pointerdown',e=>{drag=true;e.currentTarget.setPointerCapture(e.pointerId);move(e);});
      $('lightHandle').addEventListener('pointermove',e=>{if(drag)move(e);});
      for(const type of ['pointerup','pointercancel','lostpointercapture'])$('lightHandle').addEventListener(type,()=>drag=false);
      $('lightHandle').addEventListener('keydown',e=>{
        const p={};if(e.key==='ArrowLeft')p.lightX=this.state.lightX-.03;if(e.key==='ArrowRight')p.lightX=this.state.lightX+.03;
        if(e.key==='ArrowUp')p.lightY=this.state.lightY-.03;if(e.key==='ArrowDown')p.lightY=this.state.lightY+.03;
        if(Object.keys(p).length){e.preventDefault();this.setState(p);}
      });
      this.api.canvas.addEventListener('click',e=>{
        const r=this.api.canvas.getBoundingClientRect(),b=this.api.bounds();if(!b||this.camera)return;
        const x=(e.clientX-r.left)*this.api.canvas.width/r.width,y=(e.clientY-r.top)*this.api.canvas.height/r.height;
        if(x<b.x||x>b.x+b.width||y<b.y||y>b.baseline)return;
        const char=this.context().characterId,a=M.PROFILES[char]?.actions;if(a){if(char==='cool'&&y<b.y+b.height*.16){this.respond('hat');return;}if(char==='literary'&&y<b.y+b.height*.28){this.respond('glasses');return;}const index=this.responseIndex||0;this.respond(a[index%a.length][0]);this.responseIndex=index+1;}
      });
      this.api.canvas.addEventListener('keydown',e=>{if(e.key==='Enter'&&!this.camera){e.preventDefault();const a=M.PROFILES[this.context().characterId]?.actions;if(a)this.respond(a[0][0]);}});
      document.addEventListener('visibilitychange',()=>{this.previous=null;if(document.hidden)this.cancelCapture();else{this.api.render();this.schedule();}});
      document.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.camera&&!$('photoDialog').open){e.preventDefault();if(this.countdown.deadline!==null)this.cancelCapture();else this.exitCamera();}});
    }
    schedule(){
      if(this.frame!=null||!this.ready||document.hidden)return;
      if((this.paused||!this.idle&&!this.action)&&!this.lightPending&&this.countdown.deadline===null)return;
      this.frame=requestAnimationFrame(now=>{this.frame=null;this.tick(now);});
    }
    tick(now){
      if(this.previous!==null&&!this.paused&&!document.hidden)this.time+=M.clamp((now-this.previous)/1000,0,.05,0);
      this.previous=now;
      const c=this.countdown.tick(now);
      if(c.remaining&&$('countdown').textContent!==String(c.remaining))$('countdown').textContent=String(c.remaining);
      if(c.capture){
        this.frozen=M.poseSnapshot(this.pose());this.paused=true;this.cancelCapture();this.sync();
        Promise.resolve(this.api.capture()).catch(e=>this.api.notify(e.message||'拍照失败，请重试。',true));
      }
      const animated=!this.paused&&(this.idle||this.action);
      if(this.ready&&!document.hidden&&(animated||this.lightPending)&&now-this.lastPaint>=1000/30){
        if(animated&&this.action&&!this.pose().active){
          const next=this.queuedResponse;this.queuedResponse=null;
          this.action=next&&next.outfit===this.context().outfitId?{id:next.id,start:this.time}:null;
        }
        this.api.render();
        const status=[this.pose().id,this.pose().active,this.paused].join(':');
        if(status!==this.lastStatus){this.lastStatus=status;this.sync();}
        this.lastPaint=now;this.lightPending=this.lightTransition?.active(now)||false;
      }
      this.schedule();
    }
  }
  root.StudioController=StudioController;
})(window);
