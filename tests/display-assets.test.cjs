const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),manifest=require('../assets/derived-manifest.json'),W=require('../js/wardrobe.js');
test('all 24 card thumbnails keep transparent framing and avoid full-sized card downloads',async()=>{
 for(const look of W.LOOKS){const file=W.thumbnailFor(look.id),entry=manifest.entries.find(e=>e.file===file),m=await sharp(path.join(root,file)).metadata();assert.ok(entry);assert.equal(m.width,192);assert.equal(m.height,288);assert.equal(m.hasAlpha,true);assert.ok(entry.bytes<50000,look.id+' thumbnail is unnecessarily heavy');}
});
test('all approved PNG sources are unchanged and lossless motions retain every visible pixel',async()=>{
 for(const entry of manifest.entries){
  const source=fs.readFileSync(path.join(root,entry.source));assert.equal(crypto.createHash('sha256').update(source).digest('hex'),entry.sourceHash,entry.source+' was rewritten');
  if(entry.kind!=='lossless-motion')continue;
  const a=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(path.join(root,entry.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual(b.info,a.info,entry.file+' changed canvas dimensions');
  // RGB beneath fully transparent pixels is invisible and encoder dependent.
  for(let i=0;i<a.data.length;i+=4){assert.equal(b.data[i+3],a.data[i+3],entry.file+' changed alpha');if(a.data[i+3])for(let c=0;c<3;c++)assert.equal(b.data[i+c],a.data[i+c],entry.file+' changed visible pixel '+i);}
 }
});
