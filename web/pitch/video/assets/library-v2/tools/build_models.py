"""Original procedural film props. Python stdlib only; outputs glTF 2.0 GLB + OBJ/MTL.
Meters, Y up. Named parts can be animated independently. No brand-accurate CAD claim.
"""
import json, math, struct, random, copy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'models'
OUT.mkdir(exist_ok=True)
PI=math.pi
def sub(a,b):return [a[i]-b[i] for i in range(3)]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def norm(a):
 d=math.sqrt(sum(x*x for x in a)) or 1
 return [x/d for x in a]
MATS={
 'walnut':([.22,.095,.038,1],0,.45), 'grain':([.11,.038,.014,1],0,.65),
 'crust':([.64,.28,.065,1],0,.8), 'crumb':([.98,.83,.54,1],0,.93),
 'cheese':([1,.65,.10,1],0,.4), 'ham':([.84,.34,.38,1],0,.65),
 'leaf':([.17,.45,.035,1],0,.65), 'vein':([.43,.62,.14,1],0,.65),
 'black':([.012,.019,.029,1],.35,.19), 'rubber':([.025,.03,.04,1],0,.65),
 'silver':([.65,.73,.83,1],.95,.22), 'blue':([.06,.39,.8,1],.55,.23),
 'lens':([.13,.26,.36,.19],.1,.08), 'screen':([.01,.025,.045,1],.25,.12),
 'red':([.8,.04,.025,1],0,.4), 'seed':([.97,.75,.35,1],0,.45),
}
TEXTURES={'walnut':'texture-walnut','crumb':'texture-bread-crumb','crust':'texture-bread-crust','ham':'texture-ham','cheese':'texture-cheese','leaf':'texture-leaf'}
def curve3(points,steps=8):
 out=[]
 for i in range(len(points)-1):
  p0,p1,p2,p3=[points[max(0,min(len(points)-1,i+k))] for k in [-1,0,1,2]]
  for j in range(steps):
   t=j/steps
   out.append([.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t) for k in range(3)])
 return out+[points[-1]]
def mesh(name,v,f,mat,translation=(0,0,0),explode=(0,0,0)):
 return dict(name=name,v=v,f=f,mat=mat,translation=list(translation),explode=list(explode))
def rounded(w,d,r,n=12):
 p=[]
 for cx,cz,a in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
  for j in range(n):
   t=math.radians(a+j*90/n);p.append((cx+r*math.cos(t),cz+r*math.sin(t)))
 return p
def extrude(name,p,height,mat,bevel=.0007,translation=(0,0,0),explode=(0,0,0)):
 n=len(p);b=min(bevel,height*.2);sc=max(.93,1-b/max(max(abs(x),abs(z)) for x,z in p))
 rings=[(sc,0),(1,b),(1,height-b),(sc,height)]
 v=[[x*s,y,z*s] for s,y in rings for x,z in p];f=[]
 for k in range(3):
  for i in range(n):
   j=(i+1)%n;a=k*n+i;c=k*n+j;d=(k+1)*n+i;e=(k+1)*n+j
   f.extend([(a,d,e),(a,e,c)])
 v.extend([[0,0,0],[0,height,0]]);lo=len(v)-2;hi=len(v)-1
 for i in range(n):
  j=(i+1)%n;f.extend([(lo,i,j),(hi,3*n+j,3*n+i)])
 return mesh(name,v,f,mat,translation,explode)
def tube(name,points,r,mat,sides=10):
 v=[];f=[]
 for i,p in enumerate(points):
  t=norm(sub(points[min(i+1,len(points)-1)],points[max(0,i-1)]))
  a=norm(cross(t,[0,1,0] if abs(t[1])<.9 else [1,0,0]));b=cross(t,a)
  for j in range(sides):
   q=j*2*PI/sides;v.append([p[k]+r*(a[k]*math.cos(q)+b[k]*math.sin(q)) for k in range(3)])
 for i in range(len(points)-1):
  for j in range(sides):
   a=i*sides+j;b=i*sides+(j+1)%sides;c=a+sides;d=b+sides
   f.extend([(a,b,d),(a,d,c)])
 return mesh(name,v,f,mat)
def ring_frame(name,cx,outer=(.029,.020),inner=(.024,.0155),depth=.006,mat='black'):
 # Rounded superellipse front plane with chamfered lip, real opening, closed side walls.
 n=96;v=[];f=[];power=.52
 for rx,ry,z in [(outer[0]-.001,outer[1]-.001,-depth/2),(outer[0],outer[1],-depth/2+.001),
                  (outer[0],outer[1],depth/2-.001),(outer[0]-.001,outer[1]-.001,depth/2),
                  (inner[0],inner[1],depth/2),(inner[0]-.0004,inner[1]-.0004,-depth/2)]:
  for i in range(n):
   a=i*2*PI/n;c=math.cos(a);s=math.sin(a)
   v.append([cx+rx*math.copysign(abs(c)**power,c),ry*math.copysign(abs(s)**power,s),z])
 for k,jk in [(0,1),(1,2),(2,3),(3,4),(4,5),(5,0)]:
  for i in range(n):
   j=(i+1)%n;a=k*n+i;b=k*n+j;c=jk*n+i;d=jk*n+j;f.extend([(a,b,d),(a,d,c)])
 return mesh(name,v,f,mat)
def disc(name,cx,cy,cz,r,mat,axis='z'):
 v=[[cx,cy,cz]];n=64
 for i in range(n):
  a=i*2*PI/n
  v.append([cx+r*math.cos(a),cy+r*math.sin(a),cz] if axis=='z' else [cx+r*math.cos(a),cy,cz+r*math.sin(a)])
 return mesh(name,v,[(0,i+1,(i+1)%n+1) for i in range(n)],mat)
def smooth_contour(pts,n=8):
 out=[]
 for i in range(len(pts)):
  p0,p1,p2,p3=[pts[(i+k)%len(pts)] for k in [-1,0,1,2]]
  for j in range(n):
   t=j/n;out.append(tuple(.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t) for k in range(2)))
 return out
BREAD=smooth_contour([(.046,-.05),(.051,-.044),(.051,.026),(.057,.037),(.052,.050),(.028,.059),(0,.054),(-.028,.059),(-.052,.050),(-.057,.037),(-.051,.026),(-.051,-.044),(-.046,-.05)])
def bread(name='bread',y=0,explode=(0,0,0)):
 a=extrude(name+'-crust',BREAD,.016,'crust',.001,(0,y,0),explode)
 p=[(x*.9,z*.91) for x,z in BREAD]
 b=extrude(name+'-crumb',p,.0006,'crumb',.0001,(0,y+.0158,0),explode)
 c=extrude(name+'-bottom',p,.0004,'crumb',.00008,(0,y-.0002,0),explode)
 return [a,b,c]
def cheese(name='cheese',y=0,explode=(0,0,0)):
 m=extrude(name,rounded(.094,.094,.004,14),.0015,'cheese',.00025,(0,y,0),explode)
 for p in m['v']:p[1]+=.0015*math.sin(p[0]*30)*math.cos(p[2]*35)
 return [m]
def ham(name='ham',y=0,explode=(0,0,0)):
 v=[[0,.004,0]];f=[];nr=22;nt=88
 for j in range(1,nr+1):
  r=.049*j/nr
  for i in range(nt):
   t=2*PI*i/nt;rr=r*(1+.035*math.sin(7*t));x=rr*math.cos(t);z=rr*math.sin(t)
   yy=.004*math.sin(x*95)+.002*math.cos(z*120)+.004*(r/.049)**3*(1+math.sin(3*t))
   v.append([x,yy,z])
 for i in range(nt):f.append((0,1+(i+1)%nt,1+i))
 for j in range(nr-1):
  for i in range(nt):
   a=1+j*nt+i;b=1+j*nt+(i+1)%nt;c=a+nt;d=b+nt;f.extend([(a,d,b),(a,c,d)])
 return [mesh(name,v,f,'ham',(0,y,0),explode)]
def lettuce(name='lettuce',y=0,explode=(0,0,0)):
 def point(u,v):
  width=.065*(max(0,math.sin(PI*v))**.46)*(1+.07*math.sin(v*48))
  return [u*width,.0025*math.sin(v*32+u*8)*(abs(u)**1.7)+.0015*math.cos(u*9)+(abs(u)**3)*.003,v*.118-.059]
 n=48;v=[point(-1+2*i/n,j/n) for j in range(n+1) for i in range(n+1)];f=[]
 for j in range(n):
  for i in range(n):
   a=j*(n+1)+i;b=a+1;c=a+n+1;d=c+1;f.extend([(a,d,b),(a,c,d)])
 parts=[mesh(name,v,f,'leaf',(0,y,0),explode)]
 for k in range(9):
  if k==0:pts=[point(0,.02+j*.96/30) for j in range(31)];r=.0009
  else:
   side=-1 if k%2 else 1;start=.14+(k-1)//2*.17
   pts=[point(side*.85*j/12,start+.12*j/12) for j in range(13)];r=.00035
  pts=[[p[0],p[1]+.0006,p[2]] for p in pts];m=tube(name+'-vein-'+str(k),pts,r,'vein',6);m['translation']=[0,y,0];m['explode']=list(explode);parts.append(m)
 return parts
def board():
 parts=[extrude('walnut-board',rounded(.30,.21,.018,18),.016,'walnut',.002)]
 # Fine geometric groove, with deterministic wood-grain strokes for oblique lighting.
 path=rounded(.281,.191,.014,24);parts.append(tube('juice-groove',[[x,.0161,z] for x,z in path+[path[0]]],.00065,'grain',8))
 for i in range(0):
  z=-.081+i*.010
  pts=[[x,.01612,z+.0006*math.sin(x*90+i)] for x in [-.125+j*.25/24 for j in range(25)]]
  parts.append(tube('grain-'+str(i),pts,.00011,'grain',4))
 return parts
def sandwich(exploded=False):
 levels=[0,.017,.022,.027,.030]
 if exploded:levels=[0,.049,.083,.116,.15]
 return bread('bottom-bread',levels[0],(0,0,0))+lettuce('lettuce',levels[1],(0,.025,0))+ham('ham',levels[2],(0,.05,0))+cheese('cheese',levels[3],(0,.075,0))+bread('top-bread',levels[4],(0,.10,0))
def glasses():
 parts=[ring_frame('left-frame',-.034),ring_frame('right-frame',.034)]
 parts.append(tube('bridge',[[-.009,.005,0],[-.006,.009,0],[0,.011,0],[.006,.009,0],[.009,.005,0]],.003,'black',16))
 for sign,label in [(-1,'left'),(1,'right')]:
  x=sign*.034;n=96;vv=[[x,0,.0008]]
  for i in range(n):
   t=i*2*PI/n;c=math.cos(t);s=math.sin(t);vv.append([x+.0237*math.copysign(abs(c)**.52,c),.0152*math.copysign(abs(s)**.52,s),.0008])
  parts.append(mesh(label+'-clear-lens',vv,[(0,i+1,(i+1)%n+1) for i in range(n)],'lens'))
  pts=[[sign*.061,.011,0],[sign*.066,.010,-.012],[sign*.069,.008,-.06],[sign*.067,.006,-.105],[sign*.064,-.008,-.125],[sign*.061,-.015,-.132]]
  parts.append(tube(label+'-temple',curve3(pts,12),.0035,'black',20))
  parts.append(tube(label+'-temple-accent',[[sign*.069,.011,-.02],[sign*.071,.010,-.059]],.0005,'silver',8))
  parts.append(disc(label+'-hardware-ring',sign*.061,.011,.004,.0036,'silver'))
  parts.append(disc(label+'-camera',sign*.061,.011,.0042,.0028,'black' if sign>0 else 'blue'))
  parts.append(disc(label+'-camera-glint',sign*.0605,.0115,.0043,.0007,'silver'))
 return parts
def phone():
 p=extrude('phone-body',rounded(.074,.151,.010,18),.008,'black',.001)
 parts=[p,extrude('screen',rounded(.068,.143,.008,18),.0003,'screen',.00005,(0,.0081,0)),extrude('earpiece',rounded(.016,.003,.0014,10),.0004,'rubber',.00005,(0,.0085,-.061))]
 return parts
def knife():
 pts=smooth_contour([(-.012,-.10),(.008,-.10),(.012,-.075),(.009,.006),(.004,.023),(-.003,.026),(-.009,.012)])
 return [extrude('blade',pts,.002,'silver',.0003),extrude('handle',rounded(.021,.095,.009,14),.008,'black',.001,(0,-.003,.07))]
def normals(m):
 out=[[0,0,0] for p in m['v']]
 for a,b,c in m['f']:
  n=cross(sub(m['v'][b],m['v'][a]),sub(m['v'][c],m['v'][a]))
  for k in [a,b,c]:out[k]=[out[k][j]+n[j] for j in range(3)]
 return [norm(n) for n in out]
def export(slug,title,parts,description):
 doc={'asset':{'version':'2.0','generator':'Echo procedural asset library v2'},'scene':0,'scenes':[{'nodes':list(range(len(parts)))}],
      'nodes':[],'meshes':[],'materials':[],'accessors':[],'bufferViews':[],'buffers':[]}
 blob=bytearray();texture_indices={}
 used={m['mat'] for m in parts}
 for name,stem in TEXTURES.items():
  if name not in used:continue
  path=ROOT/'images'/(stem+'.png')
  if not path.exists():continue
  while len(blob)%4:blob.append(0)
  data=path.read_bytes();bv=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data)});blob.extend(data)
  ix=len(doc.setdefault('images',[]));doc['images'].append({'name':stem,'bufferView':bv,'mimeType':'image/png'})
  ti=len(doc.setdefault('textures',[]));doc['textures'].append({'source':ix});texture_indices[name]=ti
 for name,(color,metal,rough) in MATS.items():
  mat={'name':name,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':metal,'roughnessFactor':rough},'doubleSided':True}
  if name in texture_indices:mat['pbrMetallicRoughness'].update(baseColorFactor=[1,1,1,1],baseColorTexture={'index':texture_indices[name]})
  if color[3]<1:mat['alphaMode']='BLEND'
  doc['materials'].append(mat)
 mnames=list(MATS);obj=['# Original Echo concept prop; meters, Y up','mtllib '+slug+'.mtl'];offset=1;triangles=0
 def accessor(data,kind,count,ctype=5126,target=34962,bounds=None):
  while len(blob)%4:blob.append(0)
  start=len(blob);blob.extend(struct.pack('<'+('f' if ctype==5126 else 'I')*len(data),*data))
  bv=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(blob)-start,'target':target})
  a={'bufferView':bv,'componentType':ctype,'count':count,'type':kind}
  if bounds:a.update(min=bounds[0],max=bounds[1])
  ix=len(doc['accessors']);doc['accessors'].append(a);return ix
 for i,m in enumerate(parts):
  ns=normals(m);vs=m['v'];bounds=([min(p[k] for p in vs) for k in range(3)],[max(p[k] for p in vs) for k in range(3)])
  pos=accessor([x for p in vs for x in p],'VEC3',len(vs),bounds=bounds)
  normal=accessor([x for p in ns for x in p],'VEC3',len(ns))
  uv=[]
  for p in vs:
   if m['mat']=='crust':uv.append([math.atan2(p[2],p[0])/(2*PI)+.5,(p[1]-bounds[0][1])/max(.00001,bounds[1][1]-bounds[0][1])])
   else:uv.append([(p[0]-bounds[0][0])/max(.00001,bounds[1][0]-bounds[0][0]),(p[2]-bounds[0][2])/max(.00001,bounds[1][2]-bounds[0][2])])
  texcoord=accessor([x for p in uv for x in p],'VEC2',len(uv))
  inds=accessor([x for f in m['f'] for x in f],'SCALAR',len(m['f'])*3,5125,34963)
  doc['meshes'].append({'name':m['name'],'primitives':[{'attributes':{'POSITION':pos,'NORMAL':normal,'TEXCOORD_0':texcoord},'indices':inds,'material':mnames.index(m['mat'])}]})
  doc['nodes'].append({'name':m['name'],'mesh':i,'translation':m['translation'],'extras':{'explodeVector':m['explode']}})
  obj.extend(['o '+m['name'],'usemtl '+m['mat']])
  obj.extend('v '+' '.join(f'{p[k]+m["translation"][k]:.7f}' for k in range(3)) for p in vs)
  obj.extend('vn '+' '.join(f'{x:.7f}' for x in n) for n in ns)
  obj.extend('vt '+' '.join(f'{x:.7f}' for x in p) for p in uv)
  obj.extend('f '+' '.join(f'{x+offset}/{x+offset}/{x+offset}' for x in f) for f in m['f']);offset+=len(vs);triangles+=len(m['f'])
 doc['buffers']=[{'byteLength':len(blob)}]
 if slug=='smart-glasses-concept':doc['extras']={'lensAnchors':{'left':[-.034,0,.0008],'right':[.034,0,.0008]},'hardwareAccuracy':'generic concept, not Meta CAD'}
 js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);blob+=b'\0'*((-len(blob))%4)
 glb=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(blob))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(blob),0x004E4942)+blob
 (OUT/(slug+'.glb')).write_bytes(glb);(OUT/(slug+'.obj')).write_text('\n'.join(obj)+'\n')
 mtl=[]
 for name,(c,metal,rough) in MATS.items():
  mtl.extend(['newmtl '+name,'Kd '+('1 1 1' if name in texture_indices else ' '.join(map(str,c[:3]))),'d '+str(c[3]),'Ns '+str(round((1-rough)*180))])
  if name in texture_indices:mtl.append('map_Kd ../images/'+TEXTURES[name]+'.png')
  mtl.append('')
 (OUT/(slug+'.mtl')).write_text('\n'.join(mtl))
 return {'id':slug,'name':title,'category':'3D models','file':'models/'+slug+'.glb','obj':'models/'+slug+'.obj','use':description,'triangles':triangles,'parts':len(parts),'generator':'procedural Python source included'}
jobs=[('cutting-board','Walnut board — 3D',board(),'Beveled board, groove and fine geometric grain.'),
 ('bread','Bread slice — 3D',bread(),'Separate crust and crumb; editable named meshes.'),
 ('cheese','Cheese slice — 3D',cheese(),'Thin softly curved layer; consistent physical dimensions.'),
 ('ham','Folded ham — 3D',ham(),'Rippled surface for rotation and layer choreography.'),
 ('lettuce','Veined lettuce — 3D',lettuce(),'Wavy leaf with separate central and branching veins.'),
 ('sandwich','Sandwich assembly — 3D',sandwich(),'Named ingredient groups. Explode vectors provided per node.'),
 ('sandwich-exploded','Exploded sandwich — 3D',sandwich(True),'Pre-separated assembly for camera moves and explanation.'),
 ('smart-glasses-concept','Smart glasses concept — 3D',glasses(),'Original generic frame with true lens apertures, transparent lenses, hardware details and temples. Not Meta CAD.'),
 ('phone','Phone prop — 3D',phone(),'Generic blank phone; screen mesh can accept a UI texture.'),
 ('butter-knife','Butter knife — 3D',knife(),'Rounded spreading blade and separate handle.')]
manifest=[export(*job) for job in jobs]
(ROOT/'models.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({'models':len(manifest),'triangles':sum(m['triangles'] for m in manifest),'files':len(list(OUT.iterdir()))}))
