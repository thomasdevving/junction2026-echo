// Dependency-free viewer for this library's self-contained GLB files.
// Supports positions, normals, indices, material factors and translated mesh nodes.
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search),id=params.get('id')||'smart-glasses-concept';
if(params.has('capture'))document.body.classList.add('capture');
const canvas=$('canvas'),gl=canvas.getContext('webgl2',{antialias:true,alpha:true,preserveDrawingBuffer:true});
window.viewer={ready:false,error:null};
const V={sub:(a,b)=>a.map((v,i)=>v-b[i]),dot:(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm:a=>{const d=Math.hypot(...a)||1;return a.map(x=>x/d)}};
function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o}
function perspective(f,aspect,n,far){const t=1/Math.tan(f/2);return new Float32Array([t/aspect,0,0,0,0,t,0,0,0,0,(far+n)/(n-far),-1,0,0,2*far*n/(n-far),0])}
function lookAt(eye,target){const z=V.norm(V.sub(eye,target)),x=V.norm(V.cross([0,1,0],z)),y=V.cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-V.dot(x,eye),-V.dot(y,eye),-V.dot(z,eye),1])}
function shader(type,source){const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh}
const vertex=`#version 300 es
precision highp float;
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
layout(location=2) in vec2 texcoord;
uniform mat4 vp;
uniform vec3 offset, center;
uniform float radius;
out vec3 n, p;
out vec2 uv;
void main(){p=(position+offset-center)/radius;n=normal;uv=texcoord;gl_Position=vp*vec4(p,1.);}
`;
const fragment=`#version 300 es
precision highp float;
in vec3 n,p;out vec4 outputColor;
in vec2 uv;uniform sampler2D colorTexture;
uniform vec4 baseColor;uniform vec3 eye;
uniform float metal,roughness;
void main(){
 vec3 N=normalize(n);if(!gl_FrontFacing)N=-N;
 vec3 V=normalize(eye-p),L=normalize(vec3(-.8,1.5,1.2)),R=normalize(vec3(1.,.5,-1.));
 float diffuse=max(dot(N,L),0.),rim=max(dot(N,R),0.);
 float spec=pow(max(dot(N,normalize(L+V)),0.),mix(160.,8.,roughness));
 float fres=pow(1.-max(dot(N,V),0.),4.);
 vec3 color=baseColor.rgb*texture(colorTexture,uv).rgb;
 vec3 c=color*(.25+.65*diffuse+.23*rim);
 c+=mix(vec3(.82,.9,1.),color,metal)*spec*(.14+.85*metal);
 c+=vec3(.16,.25,.33)*fres*(.13+.32*metal);
 c=c/(c+vec3(.65));c=pow(c,vec3(1./2.2));
 outputColor=vec4(c,baseColor.a);
}`;
let draws=[],center=[0,0,0],radius=1,yaw=.6,pitch=.85,distance=3.4,spin=false,explode=0,last=0,program;
let home={yaw,pitch,distance};const loc={};let textures=[],whiteTexture;
async function start(){
 if(!gl)throw Error('WebGL 2 is unavailable. Download the GLB to open it in a 3D editor.');
 const list=await (await fetch('models.json')).json(),asset=list.find(a=>a.id===id);
 if(!asset)throw Error('Unknown model');
 $('title').textContent=asset.name.replace(' — 3D','');$('description').textContent=asset.use+' Drag to orbit · scroll to zoom.';$('download').href=asset.file;
 const ab=await (await fetch(asset.file)).arrayBuffer(),dv=new DataView(ab);
 if(dv.getUint32(0,true)!==0x46546c67)throw Error('Invalid GLB');
 const jlen=dv.getUint32(12,true),doc=JSON.parse(new TextDecoder().decode(new Uint8Array(ab,20,jlen))),binStart=20+jlen+8;
 const read=i=>{const a=doc.accessors[i],b=doc.bufferViews[a.bufferView],start=binStart+(b.byteOffset||0)+(a.byteOffset||0),n=a.count*({VEC3:3,VEC2:2,SCALAR:1}[a.type]);return a.componentType===5126?new Float32Array(ab,start,n):new Uint32Array(ab,start,n)};
 whiteTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,whiteTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
 for(const texture of doc.textures||[]){
  const im=doc.images[texture.source],bv=doc.bufferViews[im.bufferView],bytes=new Uint8Array(ab,binStart+(bv.byteOffset||0),bv.byteLength),bitmap=await createImageBitmap(new Blob([bytes],{type:im.mimeType}));
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.SRGB8_ALPHA8,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);textures.push(t);bitmap.close();
 }
 program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 for(const key of ['vp','offset','center','radius','baseColor','eye','metal','roughness','colorTexture'])loc[key]=gl.getUniformLocation(program,key);
 let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],canExplode=false;
 for(const ni of doc.scenes[doc.scene||0].nodes){
  const node=doc.nodes[ni],translation=node.translation||[0,0,0],ev=node.extras?.explodeVector||[0,0,0];canExplode||=ev.some(Boolean);
  for(const prim of doc.meshes[node.mesh].primitives){
   const pos=read(prim.attributes.POSITION),normal=read(prim.attributes.NORMAL),uv=read(prim.attributes.TEXCOORD_0),indices=read(prim.indices),material=doc.materials[prim.material].pbrMetallicRoughness;
   for(let k=0;k<pos.length;k+=3)for(let a=0;a<3;a++){min[a]=Math.min(min[a],pos[k+a]+translation[a]);max[a]=Math.max(max[a],pos[k+a]+translation[a])}
   const vao=gl.createVertexArray();gl.bindVertexArray(vao);
   for(const [data,location,components] of [[pos,0,3],[normal,1,3],[uv,2,2]]){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,components,gl.FLOAT,false,0,0)}
   const b=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
   draws.push({vao,count:indices.length,translation,ev,material,name:node.name});
  }
 }
 center=min.map((a,i)=>(a+max[i])/2);radius=Math.max(...min.map((a,i)=>(max[i]-a)/2))||1;
 if(id.includes('glasses')){pitch=.23;yaw=.45;distance=4.8}
 else if(id.includes('exploded')){pitch=.45;yaw=.5;distance=4.7}
 else{pitch=.92;yaw=.35;distance=4.3}
 home={pitch,yaw,distance};
 if(params.has('yaw'))yaw=Number(params.get('yaw'));if(params.has('pitch'))pitch=Number(params.get('pitch'));
 $('explode-label').hidden=!canExplode;
 $('status').innerHTML=asset.triangles.toLocaleString()+' triangles<br>'+asset.parts+' named parts';
 gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 window.viewer={ready:true,error:null,id,triangles:asset.triangles,parts:asset.parts,setCamera:(a,b)=>{yaw=a;pitch=b},setExplode:v=>{explode=v},getState:()=>({yaw,pitch,distance,explode})};
 requestAnimationFrame(render);
}
function render(t){
 const ratio=Math.min(devicePixelRatio||1,2),w=Math.round(canvas.clientWidth*ratio),h=Math.round(canvas.clientHeight*ratio);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
 if(spin)yaw+=Math.min((t-last)/1000,.05)*.24;last=t;
 gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
 const fitDistance=distance*Math.max(1,1.2/(w/h)),eye=[Math.sin(yaw)*Math.cos(pitch)*fitDistance,Math.sin(pitch)*fitDistance,Math.cos(yaw)*Math.cos(pitch)*fitDistance],vp=multiply(perspective(.63,w/h,.01,30),lookAt(eye,[0,0,0]));
 gl.uniformMatrix4fv(loc.vp,false,vp);gl.uniform3fv(loc.eye,eye);gl.uniform3fv(loc.center,[center[0],center[1]+explode*.05,center[2]]);gl.uniform1f(loc.radius,radius+explode*.04);gl.uniform1i(loc.colorTexture,0);gl.activeTexture(gl.TEXTURE0);
 const ordered=[...draws].sort((a,b)=>b.material.baseColorFactor[3]-a.material.baseColorFactor[3]);
 for(const d of ordered){gl.bindVertexArray(d.vao);gl.bindTexture(gl.TEXTURE_2D,d.material.baseColorTexture?textures[d.material.baseColorTexture.index]:whiteTexture);gl.uniform3fv(loc.offset,d.translation.map((v,i)=>v+d.ev[i]*explode));gl.uniform4fv(loc.baseColor,d.material.baseColorFactor);gl.uniform1f(loc.metal,d.material.metallicFactor);gl.uniform1f(loc.roughness,d.material.roughnessFactor);gl.depthMask(d.material.baseColorFactor[3]===1);gl.drawElements(gl.TRIANGLES,d.count,gl.UNSIGNED_INT,0)}
 gl.depthMask(true);requestAnimationFrame(render);
}
let pointer=null;
canvas.addEventListener('pointerdown',e=>{pointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!pointer)return;yaw-=(e.clientX-pointer.x)*.007;pitch=Math.max(-1.48,Math.min(1.48,pitch+(e.clientY-pointer.y)*.007));pointer={x:e.clientX,y:e.clientY}});
canvas.addEventListener('pointerup',()=>pointer=null);canvas.addEventListener('pointercancel',()=>pointer=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(1.4,Math.min(9,distance*Math.exp(e.deltaY*.001)))},{passive:false});
$('spin').onclick=()=>{spin=!spin;$('spin').setAttribute('aria-pressed',String(spin))};
$('reset').onclick=()=>{({yaw,pitch,distance}=home);explode=0;$('explode').value=0};
$('front').onclick=()=>{yaw=0;pitch=id.includes('glasses')?0:.24};
$('top').onclick=()=>{yaw=0;pitch=1.48};
$('theme').onclick=()=>{const light=document.body.classList.toggle('light');$('theme').textContent=light?'Dark':'Light'};
$('explode').oninput=e=>explode=Number(e.target.value);
start().catch(e=>{console.error(e);window.viewer.error=e.message;$('status').textContent=e.message;$('status').classList.add('error')});

