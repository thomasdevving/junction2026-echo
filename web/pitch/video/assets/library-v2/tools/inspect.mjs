import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp,stat} from 'node:fs/promises';
import {dirname,join,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=join(root,'previews');
await mkdir(out,{recursive:true});
const port=9624,debug=9625;
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary'};
const server=createServer(async(req,res)=>{try{
 let file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(file!==root&&!file.startsWith(root+'\\')){res.writeHead(403);return res.end()}
 if((await stat(file)).isDirectory())file=join(file,'index.html');
 const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(body);
}catch{res.writeHead(404);res.end('Not found')}});
await new Promise(r=>server.listen(port,'127.0.0.1',r));
const profile=await mkdtemp(join(tmpdir(),'echo-assets-'));
const proc=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--enable-unsafe-swiftshader','--use-angle=swiftshader-webgl',`--remote-debugging-port=${debug}`,`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--hide-scrollbars','--mute-audio','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws;const errors=[];
try{
 let target;for(let i=0;i<60&&!target;i++){try{target=(await(await fetch(`http://127.0.0.1:${debug}/json/list`)).json()).find(x=>x.type==='page')}catch{}if(!target)await sleep(200)}
 if(!target)throw Error('Chrome did not start');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 let next=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 await send('Runtime.enable');await send('Page.enable');
 const size=async(w,h)=>send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});
 const go=async path=>{await send('Page.navigate',{url:`http://127.0.0.1:${port}/${path}`});await sleep(250)};
 const shot=async file=>{const r=await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});await writeFile(join(out,file),Buffer.from(r.data,'base64'))};
 const wait=async condition=>{for(let i=0;i<160;i++){if(await evaluate(condition))return;await sleep(100)}throw Error('Timed out: '+condition)};
 const mode=process.argv[2]||'models';
 if(mode==='models'){
  const models=JSON.parse(await readFile(join(root,'models.json'),'utf8'));await size(800,650);let report=[];
  for(const m of models){
   await go('model.html?id='+encodeURIComponent(m.id)+'&capture');
   await wait('window.viewer?.ready||window.viewer?.error');
   const result=await evaluate('({ready:window.viewer.ready,error:window.viewer.error,id:window.viewer.id,triangles:window.viewer.triangles,parts:window.viewer.parts})');
   if(result.error)throw Error(m.id+': '+result.error);
   await sleep(250);await shot(m.id+'.png');report.push(result);
  }
  await writeFile(join(out,'model-validation.json'),JSON.stringify({report,errors},null,2));console.log(JSON.stringify({models:report.length,errors}));
 }else if(mode==='images'){
  await go('model.html?capture');
  const manifest=JSON.parse(await readFile(join(root,'manifest.sources.json'),'utf8'));const files=manifest.assets.map(a=>({id:a.id,file:a.file}));
  const report=await evaluate(`(async()=>{const files=${JSON.stringify(files)};let out=[];for(const a of files){const im=new Image();im.src=a.file;await im.decode();const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);const data=x.getImageData(0,0,c.width,c.height).data;let zero=0,partial=0,opaque=0,min=255,max=0,box=[c.width,c.height,0,0];for(let p=0;p<data.length;p+=4){const v=data[p+3];min=Math.min(min,v);max=Math.max(max,v);if(v===0)zero++;else if(v===255)opaque++;else partial++;if(v>8){let k=p/4,xx=k%c.width,yy=Math.floor(k/c.width);box=[Math.min(box[0],xx),Math.min(box[1],yy),Math.max(box[2],xx),Math.max(box[3],yy)]}}out.push({...a,width:c.width,height:c.height,alpha:{min,max,zero,partial,opaque,visibleBounds:box}})}return out})()`);
  await writeFile(join(out,'image-validation.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report.map(a=>({id:a.id,size:[a.width,a.height],alpha:a.alpha.min+'..'+a.alpha.max,transparentPercent:Math.round(a.alpha.zero/(a.width*a.height)*100),bounds:a.alpha.visibleBounds}))));
 }else if(mode==='gallery'){
  await size(1600,1050);await go('index.html');await wait('window.galleryReady===true');await sleep(500);await shot('gallery-desktop.png');
  const images=await evaluate('({cards:document.querySelectorAll(".asset").length,broken:[...document.images].filter(i=>i.getAttribute("src")&&i.complete&&!i.naturalWidth).map(i=>i.src),width:document.documentElement.scrollWidth,viewport:innerWidth,gridColumns:getComputedStyle(document.getElementById("grid")).gridTemplateColumns})');
  const interactions=await evaluate(`(()=>{const buttons=[...document.querySelectorAll('#filters button')];buttons.find(b=>b.textContent==='3D models').click();const modelCount=document.querySelectorAll('.asset').length;buttons[0].click();const s=document.getElementById('search');s.value='walnut';s.dispatchEvent(new Event('input'));const searchCount=document.querySelectorAll('.asset').length;s.value='';s.dispatchEvent(new Event('input'));document.querySelector('.preview').click();const dialog=document.getElementById('detail').open;document.querySelector('.close').click();document.getElementById('background').click();const background=document.body.classList.contains('light-previews');document.getElementById('background').click();document.getElementById('background').click();return {modelCount,searchCount,dialog,background}})()`);
  await size(390,844);await sleep(250);await shot('gallery-mobile.png');
  const mobile=await evaluate('({width:document.documentElement.scrollWidth,viewport:innerWidth})');
  await writeFile(join(out,'gallery-validation.json'),JSON.stringify({images,mobile,interactions,errors},null,2));console.log(JSON.stringify({images,mobile,interactions,errors}));
 }else if(mode==='contact'){
  await size(1800,2000);await go('index.html');await wait('window.galleryReady===true');
  const contactPage=async()=>{
   document.body.innerHTML='<div style="padding:30px;background:#0d1620;color:#e6e9e8;font-family:Arial"><h1 style="font:32px Arial;margin:0 0 26px;letter-spacing:2px">ECHO / 50 VISUAL ASSETS</h1><div id="contact" style="display:grid;grid-template-columns:repeat(6,1fr);gap:14px"></div></div>';
   const m=await(await fetch('manifest.json')).json();
   for(const a of m.assets){const c=document.createElement('div'),im=new Image(),p=document.createElement('p');im.style='width:100%;height:155px;object-fit:contain;background:#1a2633;border-radius:6px';im.src=a.preview||a.file;p.style='font-size:11px;margin:8px 0 12px;color:#b8c7d2';p.textContent=a.name;c.append(im,p);document.getElementById('contact').append(c)}
   await Promise.all([...document.images].map(i=>i.decode()));
  };
  await evaluate('('+contactPage.toString()+')()');
  const h=await evaluate('document.documentElement.scrollHeight');await size(1800,Math.min(h,4000));await sleep(150);await shot('contact-sheet.png');console.log(JSON.stringify({contact:true,height:h,errors}));
 }
}finally{ws?.close();proc.kill();server.close()}

