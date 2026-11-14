# Echo film: generated glasses assets v1

Two AI-generated product illustrations made with the built-in image_gen tool from the existing smart-glasses asset. These are design assets, not authenticated product photographs or CAD-accurate hardware representations. Check hardware identity before using as an exact Meta product depiction. The camera, frame and temple details can differ from the source.

## Files

- `glasses-hero-cutout.png`: 1536 × 1024 RGBA. Three-quarter product reveal, cool rim light and restrained warm fill. Alpha transparency includes the lens openings. Best used as a short, gently moving hero shot; avoid the former extreme 10× enlargement.
- `glasses-front-cutout.png`: 1774 × 887 RGBA. Frontal companion, clear apertures and no arm crossing through the lens openings. Best base for the lens transition and closing lockup.
- `lens-masks.svg`: editable, slightly inset lens guides for the FRONT asset only, in its exact 1774 × 887 coordinate space. Includes `viewer-left`, `viewer-right`, and `both` clip paths. These are hand-authored starting guides, not automatically extracted contours. Check final registration against the cutout. Viewer-left/right describe the image, not the wearer's anatomy.
- `prompts.json`: exact generation prompts and method.

## Compositing order

1. Film background / wearer scene.
2. A copy of the scene clipped to the chosen lens guide when performing the lens transition.
3. The transparent glasses cutout ABOVE that scene.
4. Optional subtle, clipped reflection highlight.

Place the PNG and mask in the same coordinate system. Put both inside ONE parent transform; animate that parent's position and scale. Do not animate a separately positioned black card on top of the frame. The hardware rim must occlude the scene.

For a straight-on push, align the camera to the chosen aperture, grow the whole assembly with gentle acceleration, and let the SAME underlying scene fill the screen once the rim has left the viewport. Reverse that for the closing shot. Never replace the sandwich halfway through the move. Keep any device interface in a compact wearer-view inset; these assets do not simulate optical display geometry.

These two stills are separate compositions, not turntable frames. Do not interpolate them as if they were a 3D rotation. A restrained cut or matched transition between them is appropriate. Use a real model or a consistent multi-view render sequence only if a true orbit becomes essential.

## Deliberately not generated

- No cooking footage, chef reference photos, or performance evidence. Those should come from the real recording.
- No replacement UI screenshots, conveyor thumbnails, typography, or diagrams. Keep those editable in HTML/SVG and derive thumbnails from the actual clip.
- No approximate GLB model. For the current short push-through and pull-back shots, these layers are a lower-complexity route to a better result. A rough model would introduce unverified hardware geometry.

The existing film has not been modified or wired to these assets. Use this pack in the next visual revision after fixing replay contamination. The generated shapes and apertures require new coordinates; do not reuse the old film's LENS constants.
