"""Editable vector overlays. All coordinates and colors are original and code-native."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'vectors';OUT.mkdir(exist_ok=True)
assets=[]
def save(slug,title,body,use,box='0 0 1920 1080'):
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{box}" fill="none"><title>{title}</title>{body}</svg>'
 (OUT/(slug+'.svg')).write_text(svg)
 assets.append(dict(id=slug,name=title,category='Vector effects',file='vectors/'+slug+'.svg',use=use,generator='original editable SVG'))
save('capture-corners','Capture corners',
 '<g id="corners" stroke="#C4E9DF" stroke-width="3" stroke-linecap="round"><path d="M180 260V180H300"/><path d="M1620 180H1740V260"/><path d="M1740 820V900H1620"/><path d="M300 900H180V820"/></g>',
 'A quiet framing cue for a recorded source. Animate the four paths independently.')
save('focus-reticle','Focus reticle',
 '<g id="reticle" stroke="#C4E9DF" stroke-width="2"><circle cx="320" cy="320" r="68" stroke-opacity=".45"/><path d="M320 210V245M320 395V430M210 320H245M395 320H430"/><circle cx="320" cy="320" r="3" fill="#C4E9DF" stroke="none"/></g>',
 'Momentary focus acquisition; fade out once content is selected.','0 0 640 640')
save('lens-glint','Lens reflection sweep',
 '<defs><linearGradient id="glint" x1="0" x2="1"><stop stop-color="#C9F0FF" stop-opacity="0"/><stop offset=".48" stop-color="#DFF7FF" stop-opacity=".03"/><stop offset=".54" stop-color="#FFFFFF" stop-opacity=".5"/><stop offset=".57" stop-color="#B4DDFF" stop-opacity=".13"/><stop offset="1" stop-color="#B4DDFF" stop-opacity="0"/></linearGradient></defs><path id="sweep" d="M100 1080L760 0H1360L700 1080Z" fill="url(#glint)"/>',
 'Translate inside the exact lens mask; keep the physical frame above it.')
save('optical-ribbon','Optical light ribbon',
 '<defs><linearGradient id="ribbon"><stop stop-color="#80BCD9" stop-opacity="0"/><stop offset=".35" stop-color="#A8D7F0" stop-opacity=".65"/><stop offset=".65" stop-color="#D5F0E6" stop-opacity=".9"/><stop offset="1" stop-color="#AFC3E7" stop-opacity="0"/></linearGradient></defs><g stroke="url(#ribbon)"><path id="main" pathLength="1" d="M-80 860C440 900 390 150 980 350S1420 1040 2000 180" stroke-width="3"/><path d="M-80 878C440 918 390 168 980 368S1420 1058 2000 198" stroke-width="1" opacity=".3"/><path d="M-80 842C440 882 390 132 980 332S1420 1022 2000 162" stroke-width="1" opacity=".3"/></g>',
 'Short transition accent. Reveal the main path with stroke-dashoffset, then remove it.')
save('transfer-path','Source-to-step path',
 '<path id="connector" pathLength="1" d="M180 750H610C850 750 790 330 1030 330H1740" stroke="#99C9CA" stroke-width="3" stroke-linecap="round"/><circle id="origin" cx="180" cy="750" r="8" fill="#C4E9DF"/><circle id="destination" cx="1740" cy="330" r="10" fill="#0F1925" stroke="#C4E9DF" stroke-width="3"/>',
 'Move a small source card along this path; derive the step card from the same DOM element.')
save('step-rail','Instruction sequence rail',
 '<path id="rail" d="M160 200H1760" stroke="#6F8996" stroke-width="2" opacity=".6"/>'+''.join(f'<g id="step-{i+1}"><circle cx="{160+i*400}" cy="200" r="20" fill="#111C29" stroke="#A9D9CA" stroke-width="2"/><circle cx="{160+i*400}" cy="200" r="5" fill="#A9D9CA"/></g>' for i in range(5)),
 'Editable five-node staging rail. Match the actual number of steps before use.','0 0 1920 400')
save('success-check','Confirmation check',
 '<circle id="ring" cx="160" cy="160" r="93" stroke="#A7D8BE" stroke-width="3" opacity=".45"/><path id="check" pathLength="1" d="M113 162L145 194L210 126" stroke="#C4E9DF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>',
 'Draw the check once after the correction, without pulsing or a large pop.','0 0 320 320')
save('correction-arrow','Correction direction',
 '<path id="curve" pathLength="1" d="M150 350C230 120 540 100 660 305" stroke="#E2C28F" stroke-width="4" stroke-linecap="round"/><path id="tip" d="M601 288L664 314L682 248" stroke="#E2C28F" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
 'A restrained direction cue; animate alongside the same fixed-size ingredient.','0 0 800 500')
save('bread-boundary','Ingredient coverage boundary',
 '<path id="boundary" pathLength="1" d="M190 700Q155 700 155 660V320C110 280 130 195 210 175Q290 150 400 185Q510 150 590 175C670 195 690 280 645 320V660Q645 700 610 700Z" stroke="#E2C28F" stroke-width="3" stroke-dasharray="10 12" stroke-linecap="round"/>',
 'Optional single coverage outline. Use briefly at the area needing correction.','0 0 800 850')
save('listening-wave','Listening waveform',
 '<defs><linearGradient id="wave"><stop stop-color="#C4E9DF" stop-opacity="0"/><stop offset=".3" stop-color="#C4E9DF"/><stop offset=".7" stop-color="#C4E9DF"/><stop offset="1" stop-color="#C4E9DF" stop-opacity="0"/></linearGradient></defs><path id="wave" pathLength="1" d="M0 150H160C180 150 180 125 200 125S220 175 240 175S260 100 280 100S300 200 320 200S340 60 360 60S380 240 400 240S420 30 440 30S460 270 480 270S500 85 520 85S540 215 560 215S580 120 600 120S620 180 640 180S660 150 680 150H960" stroke="url(#wave)" stroke-width="3" stroke-linecap="round"/>',
 'Optional listening-state cue. Illustrative waveform, not recorded audio.','0 0 960 300')
save('glass-panel','Subtle glass panel',
 '<defs><linearGradient id="panel" x2="1" y2="1"><stop stop-color="#D7E9F7" stop-opacity=".1"/><stop offset="1" stop-color="#BCCEDC" stop-opacity=".02"/></linearGradient><linearGradient id="edge" x2="1" y2="1"><stop stop-color="#E4F3FD" stop-opacity=".5"/><stop offset=".5" stop-color="#E4F3FD" stop-opacity=".05"/><stop offset="1" stop-color="#A0BEC9" stop-opacity=".25"/></linearGradient></defs><rect x="2" y="2" width="1196" height="796" rx="34" fill="url(#panel)" stroke="url(#edge)" stroke-width="2"/>',
 'Card surface only. Keep text and captured footage as live HTML on top.','0 0 1200 800')
save('aperture-transition','Aperture transition guide',
 '<defs><radialGradient id="aperture"><stop offset=".5" stop-color="#08111D" stop-opacity="0"/><stop offset=".78" stop-color="#08111D" stop-opacity=".55"/><stop offset="1" stop-color="#08111D"/></radialGradient></defs><rect width="1920" height="1080" fill="url(#aperture)"/>',
 'A soft vignette for a lens push-through. It is an overlay, not the actual lens mask.')
(ROOT/'vectors.json').write_text(json.dumps(assets,indent=2))
print(f'Built {len(assets)} editable SVG effects')

