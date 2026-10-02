const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Exercise the actual HTML entry point. The network boundary alone is replaced,
// so errors/retries/ordering and the fallback UI run through the shipped code.
async function page(failEffects=0){
  const requests=[],globals={},loading={textContent:'准备中…',hidden:false,children:[],setAttribute(k,v){this[k]=v;},replaceChildren(...items){this.children=items;this.textContent=items.map(n=>n.textContent||n).join('');}};
  let attempts=0,started=false,reloads=0;
  const resource=async src=>{
    const file=src.split('?')[0];requests.push(src);
    if(file==='js/studio-effects.js'&&attempts++<failEffects)throw new Error('net::ERR_SOCKET_NOT_CONNECTED');
    if(file==='js/app.js'){
      if(!globals.StudioEffects)throw new Error('Cannot read properties of undefined (reading load)');
      started=true;loading.hidden=true;
    }else globals[{'js/model.js':'NieveModel','js/renderer.js':'NieveRenderer','js/storage.js':'NieveStorage','js/wardrobe.js':'SweetWardrobe','js/studio-model.js':'StudioModel','js/studio-effects.js':'StudioEffects','js/studio-controller.js':'StudioController'}[file]]={};
  };
  const doc={getElementById:()=>loading,createTextNode:text=>({textContent:text}),createElement:()=>({remove(){this.removed=true;}}),head:{appendChild(script){queueMicrotask(async()=>{try{await resource(script.src);script.onload?.();}catch{script.onerror?.();}});}}};
  const context=vm.createContext({document:doc,window:globals,location:{reload(){reloads++;}},setTimeout,clearTimeout,console:{error(){}}});
  const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
    const src=/\bsrc="([^"]+)"/.exec(match[1]);
    if(src){try{await resource(src[1]);}catch{}}
    else await vm.runInContext(match[2],context);
  }
  return {requests,loading,started,reloads:()=>reloads};
}
test('a lost lighting script is retried before application startup, avoiding a permanent loading screen',async()=>{
  const result=await page(1);
  assert.equal(result.started,true,'one dropped script left the site on preparing');assert.equal(result.loading.hidden,true);
  const effects=result.requests.filter(src=>src.startsWith('js/studio-effects.js'));assert.equal(effects.length,2);assert.notEqual(effects[0],effects[1],'retry reused the failed resource cache key');
  assert.ok(result.requests.indexOf(effects[1])<result.requests.indexOf('js/app.js'),'app ran before lighting recovered');
});
test('repeated connection failures show a usable reload control instead of keeping preparing forever',async()=>{
  const result=await page(Infinity);
  assert.equal(result.started,false);assert.ok(!result.requests.includes('js/app.js'),'app started with a missing dependency');
  assert.equal(result.loading.hidden,false);assert.ok(!result.loading.textContent.includes('准备中'),'failed loading never changed its status');
  const reload=result.loading.children.find(n=>n.textContent==='重新加载');assert.ok(reload,'no recovery control was shown');reload.onclick();assert.equal(result.reloads(),1);
});
test('successful loading starts the app once after its dependencies without redundant retries',async()=>{
  const result=await page();assert.equal(result.started,true);assert.equal(result.requests.length,9);assert.equal(result.requests.filter(src=>src==='js/app.js').length,1);
});
