(function(root){
  'use strict';
  const DEFAULTS=Object.freeze({scene:'studio',crop:'full',lightEnabled:true,lightX:.22,lightY:.22,ratio:'portrait',scale:1,offsetX:0,offsetY:0,caption:'',showDate:false});
  const DURATIONS=Object.freeze({puff:3.4,heart:3.4,hello:3.8,smile:3.2,brow:3,nod:2.5,blink:1.4,tilt:3,hat:2.8,arms:3.2,peace:2.8,glasses:2.8,wave:3,think:3.2});
  const PROFILES=Object.freeze({
    sweet:{description:'爱笑，也喜欢每一天的新穿搭。',actions:[['smile','开心笑'],['puff','鼓脸'],['heart','比心']]},
    cool:{description:'有自己的态度，偶尔也会回应你。',actions:[['hat','帽檐致意'],['arms','抱臂'],['peace','比耶']]},
    literary:{description:'慢一点，留住一个温柔的瞬间。',actions:[['glasses','扶镜'],['wave','轻挥手'],['think','思考']]}
  });
  function clamp(n,a,b,f=a){return n!==null&&n!==''&&Number.isFinite(Number(n))?Math.max(a,Math.min(b,Number(n))):f;}
  function smooth(a,b,n){const t=clamp((n-a)/(b-a),0,1);return t*t*(3-2*t);}
  function sanitize(input={}){
    const s=input&&typeof input==='object'?input:{};
    return {scene:['studio','magazine','polaroid'].includes(s.scene)?s.scene:DEFAULTS.scene,
      crop:s.crop==='half'?'half':'full',lightEnabled:s.lightEnabled!==false,
      lightX:clamp(s.lightX,.08,.92,.22),lightY:clamp(s.lightY,.1,.65,.22),
      ratio:['portrait','square','wallpaper'].includes(s.ratio)?s.ratio:'portrait',
      scale:clamp(s.scale,.75,1.2,1),offsetX:clamp(s.offsetX,-.15,.15,0),offsetY:clamp(s.offsetY,-.12,.12,0),
      caption:typeof s.caption==='string'?Array.from(s.caption.replace(/[\x00-\x1f]/g,'')).slice(0,26).join(''):'',showDate:s.showDate===true};
  }
  function sample(time,action,idle=true){
    time=clamp(time,0,1e8,0);
    const elapsed=action?Math.max(0,time-action.start):0,duration=DURATIONS[action?.id]||0;
    const releasing=Number.isFinite(action?.releaseAt),releaseElapsed=releasing?Math.max(0,time-action.releaseAt):0;
    const active=Boolean(duration&&(releasing?releaseElapsed<.24:elapsed<duration));
    const fullPose=['heart','hat','arms','peace','glasses','wave','think'].includes(action?.id);
    const amount=active?(releasing?clamp(action.releaseAmount,0,1)*(1-smooth(0,.24,releaseElapsed)):smooth(0,fullPose ? .42 : .25,elapsed)*(1-smooth(duration-(fullPose ? .55 : .45),duration,elapsed))):0;
    const phase=time%5.4-4.7;
    const blink=active&&action.id==='blink'?amount:idle&&!active&&phase>=0&&phase<.28?smooth(0,.08,phase)*(1-smooth(.15,.28,phase)):0;
    return {time,idle:Boolean(idle),id:active?action.id:null,active,amount,blink,progress:active?elapsed/duration:0};
  }
  function poseSnapshot(input={}){
    const p=input&&typeof input==='object'?input:{};
    return {time:clamp(p.time,0,1e8,0),idle:Boolean(p.idle),id:p.id==='hello'?'heart':DURATIONS[p.id]?p.id:null,
      active:Boolean(DURATIONS[p.id]&&p.active),amount:clamp(p.amount,0,1,0),blink:clamp(p.blink,0,1,0),progress:clamp(p.progress,0,1,0)};
  }
  function rowMotion(p,w,h,pose,character){
    if(p>=.97)return {x:0,y:0};
    const upper=1-smooth(.55,.97,p),head=1-smooth(.27,.4,p),idle=pose.idle?1:0;
    const style=character==='cool'?.35:character==='literary'?.55:1;
    let x=Math.sin(pose.time*1.25)*w*.008*upper*idle*style;
    let y=-Math.sin(pose.time*1.85)*h*.0023*upper*idle*style;
    const anticipation=pose.id&&pose.amount>0&&pose.amount<1?Math.sin(pose.amount*Math.PI):0;
    x+=anticipation*w*.006*upper*idle*style;
    y-=anticipation*h*.0016*upper*idle*style;
    const tilt=character==='sweet'&&pose.id==='smile'?pose.amount*.035:0;
    x+=(p-.19)*h*tilt*head;
    return {x:x||0,y:y||0};
  }
  function layout(w,h,scene){
    if(scene==='polaroid'){const unit=Math.min(w,h),border=unit*.065;return {x:border,y:border,width:w-2*border,height:h-border-unit*.17};}
    return {x:0,y:0,width:w,height:h};
  }
  function photoFrame(w,h,state,geometry,padding=0){
    const s=sanitize(state),unit=Math.min(w,h),half=s.crop==='half';
    const upper=s.scene==='magazine'?unit*.245:unit*.055;
    const lower=s.scene==='magazine'?unit*.175:s.scene==='studio'&&(s.caption||s.showDate)?unit*.15:unit*.075;
    const side=unit*(half?.035:.075),safe={x:side,y:upper,width:w-2*side,height:Math.max(1,h-upper-lower)};
    // Reserve gesture width even at rest, so a raised hand never resizes the figure.
    const envelope=geometry.maxWidth+padding*(half?.25:2);
    const limit=Math.min(safe.width/envelope,safe.height/(geometry.height*(half?.38:1)));
    const preferred=Math.min(safe.width*.94/envelope,safe.height*(half?1/.58:.94)/geometry.height);
    const factor=Math.min(preferred*s.scale,limit),extent=envelope*factor;
    const centerX=clamp(w*.5+s.offsetX*w,safe.x+extent/2,safe.x+safe.width-extent/2,w*.5);
    let top,baseline;
    if(half){top=clamp(safe.y+s.offsetY*h,safe.y,safe.y+safe.height*.12,safe.y);baseline=top+geometry.height*factor;}
    else{baseline=clamp(safe.y+safe.height+s.offsetY*h,safe.y+geometry.height*factor,safe.y+safe.height,safe.y+safe.height);top=baseline-geometry.height*factor;}
    return {factor,centerX,baseline,top,safe};
  }
  class Countdown{
    constructor(){this.deadline=null;}
    start(now){this.deadline=now+3000;}
    cancel(){this.deadline=null;}
    tick(now){
      if(this.deadline===null)return {remaining:0,capture:false};
      const remaining=Math.max(0,Math.ceil((this.deadline-now)/1000));
      if(remaining===0){this.deadline=null;return {remaining:0,capture:true};}
      return {remaining,capture:false};
    }
  }
  const LIGHT_PRESETS=Object.freeze({
    day:{color:'#fff1d8',intensity:.62,x:.28,y:.18},
    warm:{color:'#ffd4a4',intensity:.55,x:.22,y:.22},
    cool:{color:'#c6d9ed',intensity:.42,x:.78,y:.18}
  });
  function lightTarget(settings={},state={}){
    const s=sanitize(state),color=/^#[\da-f]{6}$/i.test(settings.lightColor)?settings.lightColor.toLowerCase():'#ffd4a4';
    return {color,power:s.lightEnabled&&/^#[\da-f]{6}$/i.test(settings.lightColor)?clamp(settings.lightIntensity,0,1,.55):0,lightX:s.lightX,lightY:s.lightY};
  }
  class LightTransition{
    constructor(target){this.from=this.target={...target};this.start=-Infinity;}
    sample(now){
      if(now-this.start>=280)return {...this.target};
      const t=smooth(0,280,now-this.start);
      if(t>=1)return {...this.target};
      const value={};for(const key of ['power','lightX','lightY'])value[key]=this.from[key]+(this.target[key]-this.from[key])*t;
      const a=parseInt(this.from.color.slice(1),16),b=parseInt(this.target.color.slice(1),16);
      value.color='#'+[16,8,0].map(shift=>Math.round(((a>>shift)&255)+(((b>>shift)&255)-((a>>shift)&255))*t).toString(16).padStart(2,'0')).join('');
      return value;
    }
    set(target,now,immediate=false){
      if(!immediate&&Object.keys(target).every(key=>target[key]===this.target[key]))return;
      this.from=immediate?{...target}:this.sample(now);this.target={...target};this.start=immediate?-Infinity:now;
    }
    active(now){return now-this.start<280;}
  }
  function photoSize(ratio){return ratio==='square'?{width:1200,height:1200}:ratio==='wallpaper'?{width:1080,height:1920}:{width:1200,height:1500};}
  function pickDaily(ids,current,random=Math.random){const choices=ids.filter(id=>id!==current);return choices.length?choices[Math.min(choices.length-1,Math.floor(clamp(random(),0,.999999,0)*choices.length))]:current;}
  const api={DEFAULTS,DURATIONS,PROFILES,clamp,smooth,sanitize,sample,poseSnapshot,rowMotion,layout,photoFrame,Countdown,LIGHT_PRESETS,lightTarget,LightTransition,photoSize,pickDaily};
  root.StudioModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
