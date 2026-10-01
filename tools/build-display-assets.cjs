// Derived delivery assets only. Approved source PNG files are never rewritten.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const W=require('../js/wardrobe.js'),root=path.resolve(__dirname,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
  const entries=[];await fs.mkdir(path.join(root,'assets/thumbnails'),{recursive:true});
  for(const look of W.LOOKS){
    const source=await fs.readFile(path.join(root,look.file)),file='assets/thumbnails/'+look.id+'.webp';
    const data=await sharp(source).resize(192,288).webp({quality:86,alphaQuality:100,effort:4}).toBuffer();
    await fs.writeFile(path.join(root,file),data);entries.push({source:look.file,file,sourceHash:hash(source),sourceBytes:source.length,bytes:data.length,kind:'thumbnail'});
  }
  const folders=await fs.readdir(path.join(root,'assets/motion'));
  for(const folder of folders){
    for(const name of await fs.readdir(path.join(root,'assets/motion',folder))){
      if(!name.endsWith('.png'))continue;
      const sourcePath='assets/motion/'+folder+'/'+name,file=sourcePath.replace(/\.png$/,'.webp'),source=await fs.readFile(path.join(root,sourcePath));
      const data=await sharp(source).webp({lossless:true,alphaQuality:100,effort:4}).toBuffer();
      await fs.writeFile(path.join(root,file),data);entries.push({source:sourcePath,file,sourceHash:hash(source),sourceBytes:source.length,bytes:data.length,kind:'lossless-motion'});
    }
  }
  await fs.writeFile(path.join(root,'assets/derived-manifest.json'),JSON.stringify({generator:'tools/build-display-assets.cjs',thumbnailCanvas:[192,288],entries},null,2)+'\n');
  console.log(JSON.stringify({files:entries.length,sourceBytes:entries.reduce((s,e)=>s+e.sourceBytes,0),derivedBytes:entries.reduce((s,e)=>s+e.bytes,0)}));
})().catch(e=>{console.error(e);process.exitCode=1;});
