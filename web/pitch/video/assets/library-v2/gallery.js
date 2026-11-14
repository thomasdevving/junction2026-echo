const $=id=>document.getElementById(id);let assets=[],category='All',query='',background=0;
const categories=['All','Cutouts','Food portraits','Product details','Backgrounds','3D models','Vector effects','Material maps'];
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
function link(text,href,download=false){const a=el('a','',text);a.href=href;if(download)a.download='';return a}
function inspect(a){if(a.kind==='model'){location.href='model.html?id='+encodeURIComponent(a.id);return}
 $('detail-img').src=a.file;$('detail-img').alt=a.name;$('detail-category').textContent=a.category;$('detail-title').textContent=a.name;$('detail-use').textContent=a.use;
 $('detail-meta').textContent=[a.format,a.width?a.width+' × '+a.height:'Editable vector',a.alpha?'Transparent background':'',a.kind==='image'?'Generated artwork':'Original SVG'].filter(Boolean).join(' · ');
 $('detail-path').textContent='assets/library-v2/'+a.file;$('detail-download').href=a.file;$('copy').textContent='Copy relative path';$('detail').showModal()}
function render(){
 const visible=assets.filter(a=>(category==='All'||a.category===category)&&(!query||(a.name+' '+a.use+' '+a.category+' '+a.id).toLowerCase().includes(query)));
 $('grid').replaceChildren();$('result-count').textContent=visible.length+' assets'+(category==='All'?'':' / '+category);$('empty').hidden=visible.length>0;
 for(const a of visible){const card=el('article','asset'),preview=el('button','preview'),im=el('img');preview.setAttribute('aria-label','Inspect '+a.name);preview.onclick=()=>inspect(a);
 im.src=a.preview||a.file;im.alt=a.name;im.loading='lazy';if(a.category==='Backgrounds'||a.category==='Material maps'||a.id==='glasses-hinge-macro')im.classList.add('cover');preview.append(im,el('span','type',a.format));
 const info=el('div','card-links');if(a.kind==='model'){info.append(link('Orbit ↗','model.html?id='+encodeURIComponent(a.id)),link('GLB ↓',a.file,true),link('OBJ ↓',a.obj,true))}else{const b=el('button','','Inspect ↗');b.onclick=()=>inspect(a);info.append(b,link(a.format+' ↓',a.file,true))}
 info.append(el('span','dimensions',a.width?a.width+' × '+a.height:a.triangles?a.triangles.toLocaleString()+' tris':'VECTOR'));
 card.append(preview,el('h3','',a.name),el('p','asset-use',a.use),info);$('grid').append(card)}
}
for(const c of categories){const b=el('button',c==='All'?'active':'',c);b.setAttribute('aria-pressed',String(c==='All'));b.onclick=()=>{category=c;for(const n of $('filters').children){n.classList.toggle('active',n===b);n.setAttribute('aria-pressed',String(n===b))}render()};$('filters').append(b)}
$('search').oninput=e=>{query=e.target.value.trim().toLowerCase();render()};
$('background').onclick=()=>{background=(background+1)%3;document.body.classList.toggle('light-previews',background===1);document.body.classList.toggle('checker-previews',background===2);$('background').textContent='Background: '+['dark','light','alpha'][background]};
document.querySelector('.close').onclick=()=>$('detail').close();$('detail').onclick=e=>{if(e.target===$('detail')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('detail-path').textContent);$('copy').textContent='Copied'}catch{$('copy').textContent='Select the path above to copy'}};
try{const m=await(await fetch('manifest.json')).json();assets=m.assets;$('total').textContent=assets.length;render();window.galleryReady=true}catch(e){$('result-count').textContent='Open this library through a local web server to load the manifest.';console.error(e)}

