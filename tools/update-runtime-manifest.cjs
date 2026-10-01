const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),files=[];
function walk(dir){for(const item of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const file=dir+'/'+item.name;item.isDirectory()?walk(file):files.push(file);}}
walk('assets');walk('js');walk('previews/mobile');files.push('index.html','styles.css');
const manifest=Object.fromEntries(files.sort().map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
fs.writeFileSync(path.join(root,'runtime-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(files.length+' runtime files');
