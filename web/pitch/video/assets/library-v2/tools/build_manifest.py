import json,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sources=json.loads((ROOT/'manifest.sources.json').read_text())['assets']
validation={a['id']:a for a in json.loads((ROOT/'previews/image-validation.json').read_text())} if (ROOT/'previews/image-validation.json').exists() else {}
assets=[]
for a in sources:
 p=ROOT/a['file'];w,h=struct.unpack('>II',p.read_bytes()[16:24])
 alpha=validation.get(a['id'],{}).get('alpha',{}).get('min',255)<255
 assets.append({k:a[k] for k in ['id','name','category','file','use']}|dict(kind='image',format='PNG',width=w,height=h,alpha=alpha,bytes=p.stat().st_size))
for a in json.loads((ROOT/'models.json').read_text()):
 assets.append(a|dict(kind='model',format='GLB',preview='previews/'+a['id']+'.png',bytes=(ROOT/a['file']).stat().st_size))
for a in json.loads((ROOT/'vectors.json').read_text()):assets.append(a|dict(kind='vector',format='SVG',alpha=True,bytes=(ROOT/a['file']).stat().st_size))
manifest={'name':'Echo visual asset library v2','assetCount':len(assets),'provenance':'Generated raster artwork and original procedural models/vectors. Hardware is generic concept geometry, not manufacturer CAD.','assets':assets}
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2))
prompts=[{k:a[k] for k in ['id','file','prompt','references'] if k in a}|{'tool':'image_gen.imagegen','transparent_background_requested':a.get('transparent',True),'original_generated_file':a['source']} for a in sources]
(ROOT/'prompts.json').write_text(json.dumps(prompts,indent=2))
print(json.dumps({'assets':len(assets),'images':len(sources),'models':sum(a['kind']=='model' for a in assets),'vectors':sum(a['kind']=='vector' for a in assets)}))

