(function(root){
  'use strict';
  const M=root.StudioModel,sprites=new Map(),textures=new WeakMap(),lookLoads=new Map(),imageLoads=new Map();
  const files={
    'sweet-blink':'assets/motion/sweet-autumn-v1/blink.png','sweet-smile':'assets/motion/sweet-autumn-v1/smile.png',
    'sweet-puff':'assets/motion/sweet-autumn-v1/puff.png','sweet-wave':'assets/motion/sweet-autumn-v1/wave.png',
    'cool-blink':'assets/motion/responses-v1/cool-blink.png','cool-brow':'assets/motion/responses-v1/cool-brow.png',
    'literary-blink':'assets/motion/responses-v1/literary-blink.png','literary-smile':'assets/motion/responses-v1/literary-smile.png'
  };
  // Raw-image eye-line anchors register a face patch without changing its outfit.
  const anchors={autumn:[495,296,1],blue:[524,287,1.05],polo:[519,313,1.06],
    'cool-original':[517,332,1],'cool-street':[516,327,1],'cool-olive':[514,260,1.03],
    'literary-bookshop':[493,285,1],'literary-campus':[506,273,1],'literary-weekend':[493,272,1],
    'sweet-summer':[495,296,1],'sweet-winter':[495,296,1],
    'cool-summer':[517,332,1],'cool-winter':[517,332,1],
    'literary-summer':[493,285,1],'literary-winter':[493,285,1],"sweet-summer-2":[495, 296, 1],"sweet-autumn-2":[495, 296, 1],"sweet-winter-2":[495, 296, 1],"cool-spring-2":[517, 332, 1],"cool-summer-2":[517, 332, 1],"cool-winter-2":[517, 332, 1],"literary-spring-2":[493, 285, 1],"literary-summer-2":[493, 285, 1],"literary-winter-2":[493, 285, 1]};
  const seasonalPairs=new Set(["sweet-summer-2", "sweet-autumn-2", "sweet-winter-2", "cool-spring-2", "cool-summer-2", "cool-winter-2", "literary-spring-2", "literary-summer-2", "literary-winter-2"]);
  const seasonalLooks=new Set(['sweet-summer','sweet-winter','cool-summer','cool-winter','literary-summer','literary-winter',...seasonalPairs]);
  const baseAnchors={sweet:[495,296],cool:[517,332],literary:[493,285]};
  const sweetRegistration={
    autumn:[1,0,0,1,0,0],
    // Register the two eye centres and mouth, rather than enlarging a whole head.
    blue:[1.04324,.02609,-.03094,.96904,3.778,-12.588],
    polo:[1.05168,.03690,-.03892,1.04589,7.296,-8.446],
    'sweet-summer':[1,0,0,1,0,0],'sweet-winter':[1,0,0,1,0,0],"sweet-summer-2":[1,0,0,1,0,0],"sweet-autumn-2":[1,0,0,1,0,0],"sweet-winter-2":[1,0,0,1,0,0]
  };
  const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;};
  const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  function loadImage(id,path){
    if(sprites.has(id))return Promise.resolve(id);
    if(imageLoads.has(id))return imageLoads.get(id);
    const job=new Promise((resolve,reject)=>{
    const img=new Image();let retried=false;img.decoding='async';
    img.onload=()=>{sprites.set(id,img);resolve(id);};
    img.onerror=()=>{if(!retried){retried=true;img.src=path+'?retry=1';}else reject(new Error('动作素材未载入：'+id));};img.src=path;
    });imageLoads.set(id,job);job.catch(()=>imageLoads.delete(id));return job;
  }
  function loadCharacter(character){
    const ids=character==='sweet'?['sweet-blink','sweet-smile']:character==='cool'?['cool-blink']:character==='literary'?['literary-blink']:[];
    return Promise.all(ids.map(id=>loadImage(id,files[id])));
  }
  async function load(){
    const entries=Object.entries(files),results=[];let index=0;
    async function worker(){while(index<entries.length){const [id,path]=entries[index++];try{await loadImage(id,path);results.push({status:'fulfilled',value:id});}catch(reason){results.push({status:'rejected',reason});}}}
    await Promise.all([worker(),worker()]);return results;
  }
  function loadLook(look){
    const sweet=Boolean(sweetRegistration[look]);
    const actions=sweet?['puff','heart']:look?.startsWith('cool-')?['hat','arms','peace']:look?.startsWith('literary-')?['glasses','wave','think']:[];
    if(!actions.length)return Promise.resolve();
    if(!lookLoads.has(look)){
      const folder=seasonalPairs.has(look)?'seasons-v2':seasonalLooks.has(look)?'seasons-v1':sweet?'sweet-actions-v2':'responses-v2';
      const job=Promise.all(actions.map(id=>loadImage(look+':'+id,'assets/motion/'+folder+'/'+look+'-'+id+'.png')));
      lookLoads.set(look,job);job.catch(()=>lookLoads.delete(look));
    }
    return lookLoads.get(look);
  }
  function fullPose(data,pose,look){
    const sprite=sprites.get(look+':'+pose.id);if(!sprite)return null;
    // A complete gesture has one face and one pair of arms. Do not dissolve
    // two silhouettes together while the action enters or returns to idle.
    if(pose.amount<.5)return data;
    let cache=textures.get(data);if(!cache){cache={};textures.set(data,cache);}
    const key='full:'+look+':'+pose.id;if(cache.key===key)return cache;
    const pad=Math.round(170*data.scale),w=data.source.width+pad*2,h=data.source.height;
    const posed=make(w,h),p=posed.getContext('2d');
    p.drawImage(sprite,pad-data.left*data.scale,-data.top*data.scale,1024*data.scale,1536*data.scale);
    // Preserve the approved trousers, skirt hem and shoes pixel-for-pixel.
    const mask=make(w,h),m=mask.getContext('2d'),g=m.createLinearGradient(0,h*(look.startsWith('literary-')?.70:.59),0,h*(look.startsWith('literary-')?.75:.67));
    g.addColorStop(0,'#fff');g.addColorStop(1,'rgba(255,255,255,0)');m.fillStyle=g;m.fillRect(0,0,w,h);
    if(seasonalLooks.has(look)&&look.startsWith('sweet-')){
      // Seasonal gestures use their own registered arm/cheek region. A heart
      // must never import a second face or regenerate the approved handbag.
      m.clearRect(0,0,w,h);
      const point=(x,y)=>[(x-data.left)*data.scale+pad,(y-data.top)*data.scale];
      const region=make(w,h),r=region.getContext('2d');
      const points=pose.id==='puff'?
        [[365,270],[345,335],[358,385],[400,430],[448,449],[552,449],[605,430],[645,385],[660,335],[635,270]]:
        [[620,430],[870,430],[895,770],[810,975],[685,1010],[640,820],[610,650]];
      r.beginPath();points.forEach(([x,y],i)=>{const p=point(x,y);i?r.lineTo(...p):r.moveTo(...p);});r.closePath();r.fillStyle='#fff';r.fill();
      m.filter='blur('+4*data.scale+'px)';m.drawImage(region,0,0);m.filter='none';
      const limits=pose.id==='puff'?[435,449]:[930,1010];
      const fade=m.createLinearGradient(0,point(0,limits[0])[1],0,point(0,limits[1])[1]);
      fade.addColorStop(0,'#fff');fade.addColorStop(1,'rgba(255,255,255,0)');
      m.globalCompositeOperation='destination-in';m.fillStyle=fade;m.fillRect(0,0,w,h);m.globalCompositeOperation='source-over';
    }
    p.globalCompositeOperation='destination-in';p.drawImage(mask,0,0);
    const endpoint=make(w,h),e=endpoint.getContext('2d');e.drawImage(data.source,pad,0);e.globalCompositeOperation='destination-out';e.drawImage(mask,0,0);e.globalCompositeOperation='lighter';e.drawImage(posed,0,0);
    cache.key=key;cache.source=endpoint;cache.offsetX=pad;cache.tintKey='';cache.tinted=null;return cache;
  }
  function triangle(ctx,image,from,to){
    const [s0,s1,s2]=from,[d0,d1,d2]=to;
    const u=s1.x-s0.x,v=s1.y-s0.y,r=s2.x-s0.x,s=s2.y-s0.y,det=u*s-v*r;
    const a=((d1.x-d0.x)*s-(d2.x-d0.x)*v)/det,b=((d1.y-d0.y)*s-(d2.y-d0.y)*v)/det;
    const c=((d2.x-d0.x)*u-(d1.x-d0.x)*r)/det,d=((d2.y-d0.y)*u-(d1.y-d0.y)*r)/det;
    const winding=Math.sign((d1.x-d0.x)*(d2.y-d0.y)-(d1.y-d0.y)*(d2.x-d0.x));
    const clip=to.map((p,i)=>{const before=to[(i+2)%3],after=to[(i+1)%3];
      const normal=(x,y)=>{const length=Math.hypot(x,y);return {x:y/length*winding,y:-x/length*winding};};
      const u=normal(p.x-before.x,p.y-before.y),v=normal(after.x-p.x,after.y-p.y),amount=1/(1+u.x*v.x+u.y*v.y);
      return {x:p.x+(u.x+v.x)*amount,y:p.y+(u.y+v.y)*amount};});
    ctx.save();ctx.beginPath();ctx.moveTo(clip[0].x,clip[0].y);ctx.lineTo(clip[1].x,clip[1].y);ctx.lineTo(clip[2].x,clip[2].y);ctx.closePath();ctx.clip();
    ctx.transform(a,b,c,d,d0.x-a*s0.x-c*s0.y,d0.y-b*s0.x-d*s0.y);
    const x=Math.max(0,Math.floor(Math.min(...from.map(p=>p.x)))-4),y=Math.max(0,Math.floor(Math.min(...from.map(p=>p.y)))-4);
    const width=Math.min(image.width,Math.ceil(Math.max(...from.map(p=>p.x)))+4)-x,height=Math.min(image.height,Math.ceil(Math.max(...from.map(p=>p.y)))+4)-y;
    ctx.drawImage(image,x,y,width,height,x,y,width,height);ctx.restore();
  }
  function mesh(ctx,image,from,to,columns){
    for(let i=0;i<from.length-columns;i++)if(i%columns<columns-1){
      for(const indices of [[i,i+1,i+columns],[i+1,i+columns+1,i+columns]])triangle(ctx,image,indices.map(k=>from[k]),indices.map(k=>to[k]));
    }
  }
  function sweetApprovedAction(data,pose,look){
    const id=pose.id==='hello'?'heart':pose.id;
    if(!['puff','heart'].includes(id))return null;
    const sprite=sprites.get(look+':'+id);
    // Select one complete keyframe, never two translucent faces or hands.
    if(!sprite||pose.amount<.5)return data;
    let cache=textures.get(data);if(!cache){cache={};textures.set(data,cache);}
    const key='sweet-approved:'+look+':'+id;if(cache.key===key)return cache;
    const pad=Math.round(100*data.scale),w=data.source.width+pad*2,h=data.source.height;
    const point=(x,y)=>({x:(x-data.left)*data.scale+pad,y:(y-data.top)*data.scale});
    const outline=make(w,h),o=outline.getContext('2d');
    const face=[[365,270],[345,335],[358,385],[400,430],[448,449],[448,470],[552,470],[552,449],[605,430],[645,385],[660,335],[635,270]];
    const arm=look==='autumn'?[[672,450],[835,450],[865,760],[790,975],[680,975],[680,840],[632,744],[632,620],[650,560]]:
      look==='blue'?[[680,415],[865,415],[865,1020],[690,1020],[660,865],[612,730],[612,600],[640,518]]:
      [[686,440],[865,440],[865,1100],[685,1100],[669,948],[622,780],[622,649],[650,540]];
    const coords=id==='puff'?face:arm,registration=sweetRegistration[look];
    o.beginPath();coords.forEach(([x,y],i)=>{
      if(id==='puff'){const [a,b,c,d,e,f]=registration;[x,y]=[a*x+c*y+e,b*x+d*y+f];}
      const p=point(x,y);if(i)o.lineTo(p.x,p.y);else o.moveTo(p.x,p.y);
    });o.closePath();o.fillStyle='#fff';o.fill();
    const mask=make(w,h),m=mask.getContext('2d');m.filter=`blur(${(id==='puff'?4:6)*data.scale}px)`;m.drawImage(outline,0,0);m.filter='none';
    if(id==='puff'){
      const bottom=look==='autumn'?[455,463]:look==='blue'?[435,445]:[480,490];
      const g=m.createLinearGradient(0,point(0,bottom[0]).y,0,point(0,bottom[1]).y);g.addColorStop(0,'#fff');g.addColorStop(1,'rgba(255,255,255,0)');m.globalCompositeOperation='destination-in';m.fillStyle=g;m.fillRect(0,0,w,h);
    }else{
      const bottom=look==='autumn'?[880,975]:look==='blue'?[980,1020]:[1060,1100];
      const g=m.createLinearGradient(0,point(0,bottom[0]).y,0,point(0,bottom[1]).y);g.addColorStop(0,'#fff');g.addColorStop(1,'rgba(255,255,255,0)');m.globalCompositeOperation='destination-in';m.fillStyle=g;m.fillRect(0,0,w,h);
      if(look!=='autumn'){
        // Below the bent elbow, replace only the old bare arm. Keep the
        // approved skirt's original texture and alpha silhouette intact.
        const region=m.getImageData(0,0,w,h),base=data.source.getContext('2d').getImageData(0,0,data.source.width,h),pixels=region.data;
        const stencil=make(w,h),s=stencil.getContext('2d'),skinPixels=s.createImageData(w,h);
        for(let y=Math.max(0,Math.floor(point(0,750).y));y<h;y++)for(let x=pad;x<pad+data.source.width;x++){
          const i=(y*w+x)*4;if(!pixels[i+3])continue;
          const j=(y*data.source.width+x-pad)*4,r=base.data[j],g=base.data[j+1],b=base.data[j+2];
          if(base.data[j+3]>3&&r>g+22&&g>b+8&&r>55)skinPixels.data[i+3]=255;
        }
        s.putImageData(skinPixels,0,0);
        const expanded=make(w,h),e=expanded.getContext('2d');e.filter=`blur(${3*data.scale}px)`;e.drawImage(stencil,0,0);
        const skin=e.getImageData(0,0,w,h).data;
        for(let y=Math.max(0,Math.floor(point(0,780).y));y<h;y++)for(let x=pad;x<pad+data.source.width;x++){
          const i=(y*w+x)*4;if(!pixels[i+3])continue;
          const lower=M.clamp(((y/data.scale+data.top)-780)/20,0,1);
          pixels[i+3]=Math.round(pixels[i+3]*(1-lower+lower*(skin[i+3]>2?1:0)));
        }
        m.putImageData(region,0,0);
      }
    }
    const layer=make(w,h),p=layer.getContext('2d');
    if(id==='heart'){
      if(look==='polo'){
        // Reconstruct the skirt edge hidden by the former forearm, connecting
        // the original waist and the unobstructed lower skirt contour.
        p.beginPath();p.moveTo(0,0);p.lineTo(w,0);p.lineTo(w,point(0,780).y);
        for(const [x,y] of [[652,800],[769,1050],[800,1120]]){const q=point(x,y);p.lineTo(q.x,q.y);}
        p.lineTo(w,point(0,1150).y);p.lineTo(w,h);p.lineTo(0,h);p.closePath();p.clip();
      }
      const from=[],to=[];for(const y of [0,750,800,1000,1536])for(const x of [0,1024]){
        const lower=M.clamp((y-750)/250,0,1),dx=look==='autumn'?-M.clamp((y-750)/50,0,1)*8:look==='blue'?8*(1-lower):6*(1-lower);
        from.push({x,y});to.push(point(x+dx,y+(look==='polo'?18*(1-lower):0)));
      }mesh(p,sprite,from,to,2);
    }else p.drawImage(sprite,pad-data.left*data.scale,-data.top*data.scale,1024*data.scale,1536*data.scale);
    p.globalCompositeOperation='destination-in';p.drawImage(mask,0,0);
    const c=make(w,h),ctx=c.getContext('2d');ctx.drawImage(data.source,pad,0);ctx.globalCompositeOperation='destination-out';ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='lighter';ctx.drawImage(layer,0,0);
    cache.key=key;cache.source=c;cache.offsetX=pad;cache.tintKey='';cache.tinted=null;return cache;
  }
  function sweetTexture(data,pose,look){
    const approved=sweetApprovedAction(data,pose,look);if(approved)return approved;
    const id=pose.id==='hello'&&look==='autumn'?'wave':['smile','puff'].includes(pose.id)?pose.id:pose.blink>.01?'blink':null;
    const amount=Math.round((id==='blink'?pose.blink:pose.amount)*24)/24,sprite=sprites.get('sweet-'+id);
    if(!sprite||!amount)return data;
    let cache=textures.get(data);if(!cache){cache={};textures.set(data,cache);}
    const key='sweet-clean:'+look+':'+id+':'+amount;if(cache.key===key)return cache;
    const pad=Math.round(100*data.scale),w=data.source.width+pad*2,h=data.source.height;
    const point=(x,y)=>({x:(x-data.left)*data.scale+pad,y:(y-data.top)*data.scale});
    const c=make(w,h),ctx=c.getContext('2d');ctx.drawImage(data.source,pad,0);
    if(id==='wave'){
      // One arm layer replaces the old sleeve; face, bag, hem and shoes stay original.
      if(amount<.5)return data;
      const outline=make(w,h),m=outline.getContext('2d');m.beginPath();
      [[735,320],[925,320],[925,735],[808,766],[790,975],[680,975],[680,840],[628,744],[628,600],[672,519],[718,483]].forEach(([x,y],i)=>{const p=point(x,y);if(i)m.lineTo(p.x,p.y);else m.moveTo(p.x,p.y);});
      m.closePath();m.fillStyle='#fff';m.fill();
      // Keep hair/coat registration fixed. Only the renderer's existing body
      // motion animates this keyframe; rotating a clipped sprite tears its edges.
      const mask=make(w,h),soft=mask.getContext('2d');soft.filter=`blur(${6*data.scale}px)`;soft.drawImage(outline,0,0);soft.filter='none';
      const fade=soft.createLinearGradient(0,point(0,880).y,0,point(0,975).y);fade.addColorStop(0,'#fff');fade.addColorStop(1,'rgba(255,255,255,0)');
      soft.globalCompositeOperation='destination-in';soft.fillStyle=fade;soft.fillRect(0,0,w,h);
      const layer=make(w,h),p=layer.getContext('2d');
      // The donor's waist is 20 px wider on this side. Register it to the
      // original coat contour before fading into the unchanged lower outfit.
      const from=[],to=[];for(const y of [0,750,800,1000,1536])for(const x of [0,1024]){
        from.push({x,y});to.push(point(x-M.clamp((y-750)/50,0,1)*20,y));
      }
      mesh(p,sprite,from,to,2);
      p.globalCompositeOperation='destination-in';p.drawImage(mask,0,0);
      ctx.globalCompositeOperation='destination-out';ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='lighter';ctx.drawImage(layer,0,0);
    }else{
      const registration=sweetRegistration[look];
      const registered=(x,y)=>{const [a,b,c,d,e,f]=registration;return point(a*x+c*y+e,b*x+d*y+f);};
      const columns=[320,395,435,448,471,495,527,548,565,605,670],rows=[201,250,0,0,0,346,373,388,403,423,476];
      const eyeBase=[[283,296,309],[278,290.5,303]];
      const eyeTarget=id==='smile'?[[296,302,308],[287,294,301]]:id==='blink'?[[306,312,318],[294,300,306]]:eyeBase;
      const mouthTarget=id==='puff'?[365,380,395]:id==='smile'?[371,385,400]:rows.slice(6,9);
      const original=[],expression=[];
      for(let row=0;row<rows.length;row++)for(const x of columns){
        let y=rows[row],targetY=y,targetX=x;
        if(row>=2&&row<=4){const f=M.clamp((x-435)/130,0,1),i=row-2;y=eyeBase[0][i]+(eyeBase[1][i]-eyeBase[0][i])*f;targetY=eyeTarget[0][i]+(eyeTarget[1][i]-eyeTarget[0][i])*f;}
        if(row>=6&&row<=8){targetY=mouthTarget[row-6];
          const [left,right]=id==='puff'?[476,516]:id==='smile'?[451,553]:[448,548];
          targetX=x<448?320+(x-320)/(448-320)*(left-320):x<=548?left+(x-448)/100*(right-left):right+(x-548)/(670-548)*(670-right);
        }
        original.push(registered(x,y));expression.push(registered(targetX,targetY));
      }
      // Keep intermediate surfaces within the face-sized region.
      const points=original.concat(expression),ox=Math.floor(Math.min(...points.map(p=>p.x)))-4,oy=Math.floor(Math.min(...points.map(p=>p.y)))-4;
      const pw=Math.ceil(Math.max(...points.map(p=>p.x)))-ox+4,ph=Math.ceil(Math.max(...points.map(p=>p.y)))-oy+4;
      for(const p of points){p.x-=ox;p.y-=oy;}
      const intermediate=original.map((p,i)=>({x:p.x+(expression[i].x-p.x)*amount,y:p.y+(expression[i].y-p.y)*amount}));
      const base=make(pw,ph);base.getContext('2d').drawImage(data.source,pad-ox,-oy);
      const aligned=make(pw,ph),a=aligned.getContext('2d'),[ra,rb,rc,rd,re,rf]=registration;
      a.setTransform(ra*data.scale,rb*data.scale,rc*data.scale,rd*data.scale,(re-data.left)*data.scale+pad-ox,(rf-data.top)*data.scale-oy);a.drawImage(sprite,0,0);
      const neutral=make(pw,ph),n=neutral.getContext('2d'),target=make(pw,ph),t=target.getContext('2d');
      mesh(n,base,original,intermediate,columns.length);mesh(t,aligned,expression,intermediate,columns.length);
      const layer=make(pw,ph),p=layer.getContext('2d');p.globalAlpha=1-amount;p.drawImage(neutral,0,0);p.globalCompositeOperation='lighter';p.globalAlpha=amount;p.drawImage(target,0,0);
      // Skin may blend, but each moving eyelid or lip uses one registered texture.
      const detail=make(pw,ph),d=detail.getContext('2d');
      const feature=(before,after)=>{
        const current=[];
        for(const [x,y] of [[0,0],[1,0],[1,1],[0,1]]){const b=registered(before[x?2:0],before[y?3:1]),a=registered(after[x?2:0],after[y?3:1]);current.push({x:b.x+(a.x-b.x)*amount-ox,y:b.y+(a.y-b.y)*amount-oy});}
        const left=Math.floor(Math.min(...current.map(p=>p.x)))-12,top=Math.floor(Math.min(...current.map(p=>p.y)))-12;
        const width=Math.ceil(Math.max(...current.map(p=>p.x)))-left+12,height=Math.ceil(Math.max(...current.map(p=>p.y)))-top+12;
        const box=make(width,height),b=box.getContext('2d'),horizontal=b.createLinearGradient(0,0,width,0);
        horizontal.addColorStop(0,'rgba(255,255,255,0)');horizontal.addColorStop(8/width,'#fff');horizontal.addColorStop(1-8/width,'#fff');horizontal.addColorStop(1,'rgba(255,255,255,0)');b.fillStyle=horizontal;b.fillRect(0,0,width,height);
        const vertical=b.createLinearGradient(0,0,0,height);vertical.addColorStop(0,'rgba(255,255,255,0)');vertical.addColorStop(8/height,'#fff');vertical.addColorStop(1-8/height,'#fff');vertical.addColorStop(1,'rgba(255,255,255,0)');b.globalCompositeOperation='destination-in';b.fillStyle=vertical;b.fillRect(0,0,width,height);d.drawImage(box,left,top);
      };
      if(id!=='puff'){
        feature([395,283,471,309],[395,eyeTarget[0][0],471,eyeTarget[0][2]]);
        feature([527,278,605,303],[527,eyeTarget[1][0],605,eyeTarget[1][2]]);
      }
      if(id!=='blink')feature([448,373,548,403],id==='puff'?[476,365,516,395]:[451,371,553,400]);
      const crisp=make(pw,ph),k=crisp.getContext('2d');k.drawImage(amount<.5?neutral:target,0,0);k.globalCompositeOperation='destination-in';k.drawImage(detail,0,0);
      p.globalAlpha=1;p.globalCompositeOperation='destination-out';p.drawImage(detail,0,0);p.globalCompositeOperation='lighter';p.drawImage(crisp,0,0);
      const mask=make(pw,ph),m=mask.getContext('2d'),center=registered(id==='puff'?499:495,id==='blink'?296:id==='puff'?386:339);
      m.translate(center.x-ox,center.y-oy);m.scale((id==='puff'?70:145)*data.scale, (id==='blink'?46:id==='puff'?38:108)*data.scale);
      const g=m.createRadialGradient(0,0,.88,0,0,1);g.addColorStop(0,'#fff');g.addColorStop(1,'rgba(255,255,255,0)');m.fillStyle=g;m.fillRect(-1,-1,2,2);
      if(id==='puff'){
        const lower=make(pw,ph),l=lower.getContext('2d');l.setTransform(ra*data.scale,rb*data.scale,rc*data.scale,rd*data.scale,(re-data.left)*data.scale+pad-ox,(rf-data.top)*data.scale-oy);
        const lips=l.createLinearGradient(0,352,0,368);lips.addColorStop(0,'rgba(255,255,255,0)');lips.addColorStop(1,'#fff');l.fillStyle=lips;l.fillRect(0,0,1024,1536);
        m.setTransform(1,0,0,1,0,0);m.globalCompositeOperation='destination-in';m.drawImage(lower,0,0);
      }else if(id==='smile'){
        const nose=registered(495,343);m.setTransform(1,0,0,1,0,0);m.globalCompositeOperation='destination-out';m.translate(nose.x-ox,nose.y-oy);m.scale(39*data.scale,24*data.scale);
        const skin=m.createRadialGradient(0,0,.8,0,0,1);skin.addColorStop(0,'#fff');skin.addColorStop(1,'rgba(255,255,255,0)');m.fillStyle=skin;m.fillRect(-1,-1,2,2);
      }
      if(id!=='blink'){
        const guard=make(pw,ph),j=guard.getContext('2d');
        j.setTransform(ra*data.scale,rb*data.scale,rc*data.scale,rd*data.scale,(re-data.left)*data.scale+pad-ox,(rf-data.top)*data.scale-oy);
        const jaw=j.createLinearGradient(0,405,0,423);jaw.addColorStop(0,'#fff');jaw.addColorStop(1,'rgba(255,255,255,0)');j.fillStyle=jaw;j.fillRect(0,0,1024,1536);
        m.setTransform(1,0,0,1,0,0);m.globalCompositeOperation='destination-in';m.drawImage(guard,0,0);
      }
      p.globalAlpha=1;p.globalCompositeOperation='destination-in';p.drawImage(mask,0,0);
      ctx.globalCompositeOperation='destination-out';ctx.drawImage(mask,ox,oy);ctx.globalCompositeOperation='lighter';ctx.drawImage(layer,ox,oy);
    }
    cache.key=key;cache.source=c;cache.offsetX=pad;cache.tintKey='';cache.tinted=null;return cache;
  }
  function texture(data,pose,character,look,enabled){
    if(!enabled||!anchors[look])return data;
    if(character==='sweet'&&sweetRegistration[look]&&!seasonalLooks.has(look))return sweetTexture(data,pose,look);
    const full=fullPose(data,pose,look);if(full)return full;
    if(character==='sweet'&&sweetRegistration[look])return sweetTexture(data,pose,look);
    const id=pose.id==='hello'&&look==='autumn'?'wave':pose.id==='smile'||pose.id==='puff'||pose.id==='brow'?pose.id:pose.blink>.01?'blink':null;
    const amount=id?Math.round((id==='blink'?pose.blink:pose.amount)*24)/24:0;
    const sprite=sprites.get(character+'-'+id);
    if(!sprite||amount===0)return data;
    let cache=textures.get(data);if(!cache){cache={};textures.set(data,cache);}
    const key=look+':'+id+':'+amount;
    if(cache.key===key)return cache;
    const pad=id==='wave'?Math.round(100*data.scale):0,w=data.source.width+2*pad,h=data.source.height;
    const c=make(w,h),ctx=c.getContext('2d');
    ctx.drawImage(data.source,pad,0);
    const [ax,ay,sc]=anchors[look],[bx,by]=baseAnchors[character];
    const scale=data.scale*sc,dx=(ax-bx*sc-data.left)*data.scale+pad,dy=(ay-by*sc-data.top)*data.scale;
    if(id==='wave'){
      ctx.clearRect(0,0,w,h);ctx.globalAlpha=1-amount;ctx.drawImage(data.source,pad,0);
      ctx.globalCompositeOperation='lighter';ctx.globalAlpha=amount;
      ctx.drawImage(sprite,-data.left*data.scale+pad,-data.top*data.scale,sprite.width*data.scale,sprite.height*data.scale);
    }else{
      const patch=make(w,h),p=patch.getContext('2d');p.drawImage(sprite,dx,dy,sprite.width*scale,sprite.height*scale);
      const eye=id==='blink'||id==='brow',rx=(character==='sweet'?145:130)*scale,ry=(eye?(character==='sweet'?48:65):135)*scale;
      const cx=(ax-data.left)*data.scale+pad,cy=(ay-data.top)*data.scale+(eye?-5:55)*scale;
      p.globalCompositeOperation='destination-in';p.save();p.translate(cx,cy);p.scale(rx,ry);
      const mask=p.createRadialGradient(0,0,.68,0,0,1);mask.addColorStop(0,'#fff');mask.addColorStop(1,'rgba(255,255,255,0)');
      p.fillStyle=mask;p.fillRect(-1,-1,2,2);p.restore();
      ctx.globalAlpha=amount;ctx.drawImage(patch,0,0);
      ctx.globalAlpha=1;ctx.globalCompositeOperation='destination-in';ctx.drawImage(data.source,pad,0);
    }
    cache.key=key;cache.source=c;cache.offsetX=pad;cache.tintKey='';cache.tinted=null;return cache;
  }
  function light(settings,state,visible){
    const s=M.sanitize(state),target=M.lightTarget(settings,s),l=visible?M.lightTarget({lightColor:visible.color,lightIntensity:visible.power},{...s,lightEnabled:true,lightX:visible.lightX,lightY:visible.lightY}):target;
    return {...s,...l,direction:M.clamp((.53-l.lightX)/.45,-1,1),height:M.clamp((.65-l.lightY)/.55,0,1)};
  }
  function mix(a,b,t){
    const n=parseInt(a.slice(1),16),m=parseInt(b.slice(1),16);
    return '#'+[16,8,0].map(shift=>Math.round(((n>>shift)&255)*(1-t)+((m>>shift)&255)*t).toString(16).padStart(2,'0')).join('');
  }
  function palette(settings,state,visible){
    const l=light(settings,state,visible),scene=state.scene;
    let colours=scene==='magazine'?['#ddd9d2','#e9e3d8','#f4eee3']:['#cbbda9','#d6cab8','#e5ded1'];
    if(settings.background==='sunset')colours=['#f7bc57','#ef9e46','#e47833'];
    else if(settings.background==='sky')colours=['#dcecf1','#b4d7e7','#91c1dc'];
    else if(/^#[\da-f]{6}$/i.test(settings.background))colours=[settings.background,settings.background,settings.background];
    return colours.map(color=>mix(mix(color,'#413e3b',.32*(1-l.power)),l.color,l.power*.20));
  }
  function room(ctx,w,h,settings,state,visible){
    const l=light(settings,state,visible);
    const gradient=ctx.createLinearGradient(0,0,0,h);
    const colours=palette(settings,state,l);
    gradient.addColorStop(0,colours[0]);gradient.addColorStop(.68,colours[1]);gradient.addColorStop(1,colours[2]);ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
    if(l.power){
      const x=l.lightX*w,y=l.lightY*h;
      ctx.save();ctx.translate(x,y);ctx.scale(1,h/w*.9);
      const g=ctx.createRadialGradient(0,0,0,0,0,w*.95);
      g.addColorStop(0,rgba(l.color,l.power*.75));g.addColorStop(.4,rgba(l.color,l.power*.34));g.addColorStop(1,rgba(l.color,0));
      ctx.fillStyle=g;ctx.fillRect(-w*2,-w*2,w*4,w*4);ctx.restore();
      const dark=ctx.createLinearGradient(0,0,w,0);
      dark.addColorStop(0,`rgba(37,35,33,${Math.max(0,-l.direction)*l.power*.32})`);
      dark.addColorStop(1,`rgba(37,35,33,${Math.max(0,l.direction)*l.power*.32})`);
      ctx.fillStyle=dark;ctx.fillRect(0,0,w,h);
      // A wide, soft pool follows source height without drawing a stage boundary.
      const floorX=w*(.53+(l.lightX-.53)*(.35+.2*(1-l.height))),radius=w*(.38+.18*l.height);
      ctx.save();ctx.translate(floorX,h*.91);ctx.scale(1,.15+.09*l.height);
      const spill=ctx.createRadialGradient(0,0,0,0,0,radius);spill.addColorStop(0,rgba(l.color,l.power*.65));spill.addColorStop(.45,rgba(l.color,l.power*.28));spill.addColorStop(1,rgba(l.color,0));
      ctx.fillStyle=spill;ctx.fillRect(-radius,-radius,radius*2,radius*2);ctx.restore();
    }
  }
  function shadow(ctx,w,h,l,cx,baseline,footprint=w*.1){
    const altitude=l.height??M.clamp((.65-l.lightY)/.55,0,1),stretch=l.power?1-altitude:0;
    const offset=l.direction*w*(.075+.14*stretch)*l.power;
    const radius=footprint*(1.1+Math.abs(l.direction)*l.power*(1+stretch));
    ctx.save();ctx.translate(cx+offset,baseline+h*.012);ctx.scale(1,.19+.08*stretch);
    const g=ctx.createRadialGradient(0,0,0,0,0,radius);g.addColorStop(0,`rgba(42,37,33,${.12+l.power*.25})`);g.addColorStop(.4,`rgba(42,37,33,${.07+l.power*.12})`);g.addColorStop(1,'rgba(42,37,33,0)');
    ctx.fillStyle=g;ctx.fillRect(-radius,-radius,radius*2,radius*2);ctx.restore();
    // Contact stays fixed at the soles even when the cast shadow moves away.
    ctx.save();ctx.translate(cx,baseline+h*.003);ctx.scale(1,.13);
    const contact=ctx.createRadialGradient(0,0,0,0,0,footprint);contact.addColorStop(0,'rgba(42,37,33,.30)');contact.addColorStop(.5,'rgba(42,37,33,.14)');contact.addColorStop(1,'rgba(42,37,33,0)');
    ctx.fillStyle=contact;ctx.fillRect(-footprint,-footprint,footprint*2,footprint*2);ctx.restore();
  }
  function decoration(ctx,w,h,state,info={}){
    ctx.save();ctx.fillStyle='#39332c';ctx.textBaseline='top';
    const title=state.caption||info.outfit||'My everyday look',unit=Math.min(w,h);
    const sans='-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif';
    function fit(text,font,size,max){let n=size;do{ctx.font=`${n}px ${font}`;if(ctx.measureText(text).width<=max)break;n*=.92;}while(n>w*.012);return text;}
    if(state.scene==='magazine'){
      ctx.textAlign='center';ctx.font=`500 ${unit*.13}px ${sans}`;ctx.fillText('OOTD',w*.5,unit*.035);
      ctx.font=`${unit*.021}px ${sans}`;ctx.fillText(info.label||'PERSONAL STYLE',w*.5,unit*.192);
      ctx.textAlign='left';ctx.font=`${unit*.014}px ${sans}`;ctx.fillText('THE DAILY EDIT',unit*.075,h-unit*.143);
      fit(title,sans,unit*.044,w-unit*.15);ctx.fillText(title,unit*.075,h-unit*.108);
      if(state.showDate){ctx.font=`${unit*.015}px ${sans}`;ctx.textAlign='right';ctx.fillStyle='#756b5e';ctx.fillText(info.date||'',w-unit*.075,h-unit*.041);}
    }else if(state.scene==='polaroid'){
      ctx.textAlign='center';fit(title,sans,unit*.042,w-unit*.18);ctx.fillText(title,w*.5,h-unit*(state.showDate?.135:.111));
      if(state.showDate){ctx.font=`${unit*.017}px ${sans}`;ctx.fillStyle='#8b8070';ctx.fillText(info.date||'',w*.5,h-unit*.061);}
    }else if(state.caption||state.showDate){
      const start=h-unit*.15,wash=ctx.createLinearGradient(0,start,0,h);wash.addColorStop(0,'rgba(242,233,218,0)');wash.addColorStop(1,'rgba(242,233,218,.6)');ctx.fillStyle=wash;ctx.fillRect(0,start,w,unit*.15);ctx.fillStyle='#39332c';
      ctx.textAlign='center';fit(state.caption||info.label||'',sans,unit*.034,w-unit*.15);ctx.fillText(state.caption||info.label||'',w*.5,h-unit*(state.showDate?.10:.075));
      if(state.showDate){ctx.font=`${unit*.015}px ${sans}`;ctx.fillStyle='#756b5e';ctx.fillText(info.date||'',w*.5,h-unit*.044);}
    }
    ctx.restore();
  }
  root.StudioEffects={load,loadCharacter,loadLook,texture,light,palette,room,shadow,decoration,anchors};
})(window);
