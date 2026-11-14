# Echo visual asset library v2

50 assets: **28 PNG images and material maps, 10 textured or material-based 3D models, and 12 editable SVG overlays**.

Open `/pitch/video/assets/library-v2/` through the project's existing web server. The gallery supports category filters, search, original downloads, light/dark/checkerboard backgrounds, and image inspection. Model cards open an orbit viewer with zoom, camera presets and an ingredient separation slider.

This is an asset pack. It does not change `film.html`, its timeline, footage slots, audio or narration.

## Start with these

| Film moment | Assets | Suggested treatment |
| --- | --- | --- |
| Glasses reveal | `images/glasses-hinge-macro.png`, `images/midnight-product-stage.png` | A short detail insert and a slow reveal. Keep movement to a small push on the still image. |
| Lens transition | `images/waveguide-glass.png`, `vectors/lens-glint.svg`, `images/optical-caustics-stage.png` | One restrained reflection sweep or a short optical cutaway, then resolve into the next shot. |
| Recipe extraction | `images/phone-blank.png`, `vectors/transfer-path.svg`, `vectors/step-rail.svg` | Put a real captured source on the phone. Let the selected frame become the instruction card using the same visual object. |
| Ingredient comparison | Board, bread, lettuce, Gouda, ham and pesto PNG cutouts | Reuse the same objects at constant scale. Change their placement and overlap; do not inflate the food to make a correction appear successful. |
| Dimensional explanation | `models/sandwich.glb`, `models/sandwich-exploded.glb` | Rotate gently, then separate the named ingredient meshes. Use this as a stylized explanatory insert. |
| Result / ending | `images/sandwich-hero.png`, `images/ivory-plate.png` | A brief appetizing result, with a simple move and room for the final message. |
| Optional set dressing | Basil, pesto bowl, linen napkin, knife, cucumber and tomato | Small peripheral accents. Pick only what supports the recipe being demonstrated. |

The strongest material is the glasses hinge macro, ingredient cutouts, sandwich portraits and optical caustic background. Keep optional decorations out of footage placeholders. Real product recordings should replace those placeholders later.

## Files

- `images/`: original generated PNGs, retained at native dimensions; no destructive resizing.
- `models/`: 10 GLB files, plus matching OBJ and MTL exports.
- `vectors/`: 12 SVG effects with named paths/groups.
- `previews/`: rendered model thumbnails, contact sheet, gallery screenshots and validation reports.
- `manifest.json`: gallery metadata, dimensions, transparency, formats and recommended uses.
- `prompts.json`: exact generation prompts and original generated-file locations.
- `manifest.sources.json`: full generation provenance used during assembly.
- `tools/build_models.py`: original model geometry and exporter source.
- `tools/build_vectors.py`: editable source for all vector graphics.
- `tools/build_manifest.py`: rebuild the gallery manifest.
- `tools/inspect.mjs`: local Chrome preview/check utility used for this pack.
- `OPUS_HANDOFF.md`: integration brief for the next film-editing pass.

Serve this directory over HTTP; browsers restrict local `file://` fetches.

## PNG compositing

The overhead ingredients share a top-down camera and broadly consistent upper-left lighting. Their **canvas dimensions and transparent padding differ**. Set the apparent object size deliberately instead of giving every image the same CSS width. Alpha-visible bounds are recorded in `previews/image-validation.json`.

Use normal alpha compositing. Do not chroma-key black pixels or apply `mix-blend-mode: screen` to food. Use the gallery's checkerboard mode to inspect actual transparency.

The finished and exploded sandwiches are complete compositions. They cannot rotate in depth or expose a hidden side. For genuine rotation, use the GLB; for independently moving photographic ingredients, use the separate ingredient PNGs.

The waveguide PNG is a conceptual translucent optical insert. Its highlights are baked into the image. It is not a physically simulated transmissive lens.

The blank phone screen is intentionally empty. Add real UI as a separate layer; do not treat the generated phone as a screenshot of the application.

## Models

All models use **meters, Y up**, with named mesh nodes. Food lies in the X/Z plane. Glasses face toward positive Z; their temples extend toward negative Z.

| Model | Purpose |
| --- | --- |
| cutting-board | Beveled walnut preparation board with a separate groove |
| bread | Separate crust, crumb face and bottom |
| cheese | Thin gently curved Gouda layer |
| ham | Rippled filling surface |
| lettuce | Wavy leaf and separate raised veins |
| sandwich | Assembled ingredient stack |
| sandwich-exploded | Pre-separated version of the stack |
| smart-glasses-concept | Generic frame, clear lenses, bridge, temples and camera accents |
| phone | Generic phone with a named screen mesh and UV coordinates |
| butter-knife | Separate blade and handle |

The six generated color maps are embedded in the applicable GLBs. Those GLBs are self-contained. **OBJ users must keep the MTL and the adjacent `images/` directory**: texture references are relative to the MTL. The maps provide color detail; they are not a full measured PBR scan, normal-map set or a guarantee of seamless tiling.

Every node contains `extras.explodeVector`. Animate `translation = initialTranslation + explodeVector * progress`, where progress is 0–1. The assembled sandwich has one vector per ingredient group; bread crust and crumb move together. The already-exploded model can be used directly without applying another separation.

The glasses GLB includes `extras.lensAnchors`. It is **original generic concept geometry, not Meta/Ray-Ban CAD**. Do not match-cut it into a different branded frame and imply it is the exact same physical product. Use real hardware footage for a product-accuracy claim.

These are visual animation props, not manufacturing meshes, rigged mechanical assemblies or collision-ready assets. Thin food surfaces are double-sided. The viewer provides a lightweight lighting approximation, not a production path-traced render.

## Glasses display integration

1. Place the scene or small cue below the physical frame.
2. Clip it to the exact visible aperture of that particular glasses image.
3. Put the frame above it so the rim occludes the cue.
4. Put reflections above the content but inside the same lens mask.
5. Animate one parent for the entire assembly so frame, content and reflections stay aligned.

The earlier `../generated-v1/` pack has a front glasses cutout and a starting lens-mask guide. Its mask only applies to that image and may need adjustment. Do not reuse it for the new optical insert or the GLB.

Do not present a large full-lens movie panel as verified hardware behavior. Keep the in-lens cue small and readable; label explanatory graphics as concept visualization where appropriate.

## SVG effects

Named groups and paths support opacity, transform and stroke drawing. Assets with `pathLength="1"` can use `stroke-dasharray: 1; stroke-dashoffset: 1`, then animate the offset to 0.

The five-node instruction rail is a layout template, not a claim that every recipe has five steps. The waveform is illustrative, not recorded audio. The aperture vignette is a transition overlay, not the exact glasses mask.

Use a consistent accent palette: pale mint for confirmation, warm amber for correction, and restrained cyan for optical reflections. Remove cues once they have served their purpose.

## Motion direction

Use smooth acceleration and deceleration for camera-scale moves. Keep UI response brief and clear. Avoid applying a very front-loaded ease to every animation.

The conveyor should slow into a selected source frame, retain that frame visually, and let it become the next card. Avoid a fast belt followed by a separate unrelated fade.

Keep the film silent until the picture is stable. Voiceover timing should follow the finished visual edit.

## Provenance and use limits

Raster assets are AI-generated illustrations. They do not document an actual cooking session, customer, pilot site, product test or exact hardware internals. The kitchen is a synthetic setting. Models and vectors are original procedural work for this asset pack.

All assets can be edited. Keep the original PNGs and model source as masters. No external stock images, logos, external fonts or hosted JavaScript dependencies are required by the gallery.

