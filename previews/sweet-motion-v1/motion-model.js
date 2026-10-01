(function (root) {
  'use strict';
  const clamp = (n,a,b,f=a) => Number.isFinite(Number(n)) ? Math.max(a,Math.min(b,Number(n))) : f;
  function smooth(a,b,n) { const t=clamp((n-a)/(b-a),0,1); return t*t*(3-2*t); }
  const DURATIONS = Object.freeze({ puff:3.4, wave:3.8, smile:3.2 });
  const DEFAULT_LIGHT = Object.freeze({ enabled:true, color:'#ffd4a4', intensity:.65, x:.22, y:.22 });
  function sanitizeLight(input={}) {
    return { enabled:input.enabled!==false, color:/^#[0-9a-f]{6}$/i.test(input.color) ? input.color : DEFAULT_LIGHT.color,
      intensity:clamp(input.intensity,0,1,DEFAULT_LIGHT.intensity), x:clamp(input.x,.08,.92,DEFAULT_LIGHT.x),
      y:clamp(input.y,.1,.65,DEFAULT_LIGHT.y) };
  }
  function lighting(input) {
    const light=sanitizeLight(input), power=light.enabled?light.intensity:0;
    const direction=clamp((.53-light.x)*2,-1,1);
    return { ...light, power, shadowX:direction*.23*power, shadowY:(.68-light.y)*.045*power,
      shadowWidth:.115+Math.abs(direction)*.1*power, shadowOpacity:.15+power*.12 };
  }
  function sample(time,action,idle=true) {
    const elapsed=action?Math.max(0,time-action.start):0, duration=DURATIONS[action?.id]||0;
    const active=Boolean(duration&&elapsed<duration), amount=active?smooth(0,.24,elapsed)*(1-smooth(duration-.42,duration,elapsed)):0;
    const blinkPhase=(time%5.4)-4.7;
    const blink=idle&&!active&&blinkPhase>=0&&blinkPhase<.28
      ? smooth(0,.08,blinkPhase)*(1-smooth(.15,.28,blinkPhase)) : 0;
    return { time, idle, id:active?action.id:null, active, amount, blink };
  }
  function point(x,y,width,height,pose) {
    const px=x/width, py=y/height, upper=1-smooth(.57,.91,py), head=1-smooth(.28,.4,py);
    const idle=pose.idle?1:0, sway=Math.sin(pose.time*1.25)*width*.009*upper*idle;
    let dx=sway, dy=-Math.sin(pose.time*1.85)*height*.0027*upper*idle;
    const tilt=(Math.sin(pose.time*.92)*.007*idle+(pose.id==='smile'?Math.sin(pose.time*2.3)*.014*pose.amount:0))*head;
    dx+=-(y-height*.3)*tilt; dy+=(x-width*.5)*tilt;
    if(pose.id==='puff') {
      const scale=.025*pose.amount*(.6+.4*Math.sin(pose.time*4));
      dx+=(x-width*.49)*scale*head; dy+=(y-height*.29)*scale*head;
    }
    if(pose.id==='wave') {
      const arm=smooth(.66,.79,px)*(1-smooth(.36,.49,py)), angle=Math.sin(pose.time*9)*.055*pose.amount;
      const vx=x-width*.72, vy=y-height*.44;
      dx+=(vx*(Math.cos(angle)-1)-vy*Math.sin(angle))*arm;
      dy+=(vx*Math.sin(angle)+vy*(Math.cos(angle)-1))*arm;
    }
    return { x:x+dx,y:y+dy };
  }
  class MotionClock {
    constructor() { this.time=0; this.previous=null; }
    advance(now,paused=false) {
      const delta=this.previous===null?0:clamp((now-this.previous)/1000,0,.05);
      this.previous=now;
      if(!paused)this.time+=delta;
      return this.time;
    }
  }
  const api={ clamp,smooth,DURATIONS,DEFAULT_LIGHT,sanitizeLight,lighting,sample,point,MotionClock };
  root.SweetMotionModel=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
