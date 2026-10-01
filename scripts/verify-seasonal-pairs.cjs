// Render all nine added outfits through the production scene and action pipeline.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('@napi-rs/canvas'),W=require('../js/wardrobe.js'),SM=require('../js/studio-model.js'),M=require('../js/model.js');
const additions=require('../previews/seasons-v2/generation.json').items,root=path.resolve(__dirname,'..');
class AssetImage extends C.Image {set src(value){super.src=path.join(root,value.split('?')[0]);}get src(){return super.src;}}
async function main(){
 const window={StudioModel:SM,NieveModel:M},context=vm.createContext({window,Image:AssetImage,document:{createElement:()=>C.createCanvas(1,1)}});
 for(const name of ['renderer','studio-effects'])vm.runInContext(fs.readFileSync(path.join(root,'js',name+'.js'),'utf8'),context);
 const E=window.StudioEffects,R=window.NieveRenderer,frames=[];
 for(const character of W.CHARACTERS){
  const looks=additions.filter(i=>i.character===character.id),grid=C.createCanvas(1280,1500),g=grid.getContext('2d');
  g.fillStyle='#eee8df';g.fillRect(0,0,1280,1500);
  for(const [row,item] of looks.entries()){
   const id=item.id,look=W.find(id),im=await C.loadImage(path.join(root,look.file));
   R.prepare(im,{frame:W.frameForOutfit(id)});await Promise.all([E.loadCharacter(character.id),E.loadLook(id)]);
   const actions=[['idle','idle'],...SM.PROFILES[character.id].actions];
   for(const [col,[action]] of actions.entries()){
    const out=C.createCanvas(320,460),pose={id:action,amount:action==='idle'?0:1,blink:0,idle:action==='idle',active:action!=='idle',time:0,progress:.3};
    const b=R.draw(out,im,{...M.DEFAULTS,lightColor:'#fff1d8',lightIntensity:.32},{export:true,photograph:true,studio:{state:{...SM.DEFAULTS,scene:'studio',crop:'full'},characterId:character.id,outfitId:id,label:character.name,outfit:look.label,useExpressions:true,pose}});
    frames.push({id,action,bounds:b});g.drawImage(out,col*320,row*500+32);
    g.fillStyle='#484239';g.font='13px sans-serif';g.textAlign='center';g.fillText(id+' / '+action,col*320+160,row*500+20);
   }
  }
  fs.writeFileSync(path.join(root,'output','seasonal-wardrobe-v2-'+character.id+'-actions.png'),grid.toBuffer('image/png'));
 }
 fs.writeFileSync(path.join(root,'output/seasonal-wardrobe-v2-frames.json'),JSON.stringify(frames,null,2));
 console.log('Rendered 9 approved outfits and all 27 action slots with the production renderer.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
