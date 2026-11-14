"""Structural validation for the exported GLBs; no external packages."""
import json,struct,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
report=[]
for p in sorted((ROOT/'models').glob('*.glb')):
 b=p.read_bytes();magic,version,total=struct.unpack_from('<III',b)
 assert magic==0x46546c67 and version==2 and total==len(b),p
 jl,jt=struct.unpack_from('<II',b,12);assert jt==0x4e4f534a
 d=json.loads(b[20:20+jl]);bl,bt=struct.unpack_from('<II',b,20+jl);start=28+jl;assert bt==0x004e4942 and start+bl==len(b)
 for view in d['bufferViews']:assert view.get('byteOffset',0)+view['byteLength']<=d['buffers'][0]['byteLength']
 def read(i):
  a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];n=a['count']*dict(VEC2=2,VEC3=3,SCALAR=1)[a['type']];fmt='f' if a['componentType']==5126 else 'I'
  assert a.get('byteOffset',0)+n*4<=v['byteLength']
  x=struct.unpack_from('<'+fmt*n,b,start+v.get('byteOffset',0)+a.get('byteOffset',0));assert all(math.isfinite(z) for z in x)
  return x
 tris=0
 for m in d['meshes']:
  for q in m['primitives']:
   pos=read(q['attributes']['POSITION']);norm=read(q['attributes']['NORMAL']);uv=read(q['attributes']['TEXCOORD_0']);ix=read(q['indices'])
   assert len(pos)==len(norm) and len(uv)//2==len(pos)//3 and max(ix)<len(pos)//3 and len(ix)%3==0
   tris+=len(ix)//3
 for im in d.get('images',[]):
  v=d['bufferViews'][im['bufferView']];offset=start+v.get('byteOffset',0)
  assert b[offset:offset+8]==bytes([137,80,78,71,13,10,26,10])
 report.append(dict(file=p.name,triangles=tris,parts=len(d['nodes']),embeddedTextures=len(d.get('images',[])),bytes=len(b),valid=True))
(ROOT/'previews/glb-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))

