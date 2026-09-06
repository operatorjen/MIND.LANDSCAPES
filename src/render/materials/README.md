# Surface materials

## Module contract

A material module should export:

- a frozen object containing named, artist-facing defaults;
- one GLSL string containing only that material's functions;
- a catalog entry describing its material range, mapping, outputs, and optional
  bitmap inputs.

Keep geometry and raymarch distance functions outside this directory. Material
modules run after a surface hit and may provide color masks, height/bump data,
roughness, or other shading attributes.

## Adding a variant

1. Add `<variant-name>.glsl.js` beside the bark module.
2. Put tunable values at the top of that module instead of scattering numeric
   literals through the shader.
3. Register it in `catalog.js` and add its shader to the catalog entry.
4. Call the material function from the appropriate range in `lighting.glsl.js`.
5. Fade expensive detail with `surfaceDetail` or `microDetail`.

For PNG-backed materials, list asset roles in `textureInputs`, add the sampler
uniforms to `uniforms.js`, and load the textures in `landscape.js`. Color maps
use `THREE.SRGBColorSpace`; height, normal, roughness, and masks remain in
`THREE.NoColorSpace`.

The concrete material uses `assets/textures/concrete-height.png` as repeating
linear height data. It mixes two fine scales of that map with sparse procedural
pores and aggregate, keeping large recognizable marks out of the building
surface while retaining deterministic weathering and quality-scaled bump.

`sunlit-overgrowth.glsl.js` adds one 512 × 512 grayscale lookup to nearby
exterior concrete. Gray moss colonies and white vine cores share the same mask;
world height remains the vertical texture axis. Growth follows the stable
daylight arc, fades in with the architecture detail range, simplifies vine
detail on Low, and is excluded from roofs and underground/interior concrete.

## Bark contour mapping

`bark-contours.glsl.js` uses a per-tree seed, periodic angular coordinates, an
anisotropic organic distance field, and nested contour bands. The angular hash
wraps after `BARK_CELLS_AROUND`, so the trunk seam meets without repeating one
shared bitmap across trees. Bump samples are limited by `microDetail`; distant
trees retain only the cheaper color pattern.

`morphStart` and `morphEnd` control how the contour width, distortion, color
masks, and relief grow into their final form as a tree approaches. Palette and
charcoal selections come from the same stable per-tree seed, producing umber,
sienna, ash-brown, muted accent, and soft-black families without changing on
reload.

Contour coverage estimates the projected pixel footprint from camera distance
and render resolution. Low quality uses wider coverage filtering, subtle
object-space stippling, and reduced bump strength. The stipple is derived from
tree coordinates rather than screen pixels, so it remains attached to the bark
while the camera moves.

The current coordinates are centered on each tree and follow its overall growth
axis. If future branch geometry exposes a closest-segment frame, replace only
`barkContourCoordinates`; the contour generator and material response can stay
unchanged.

`personal-art` blends the local RGBA atlas into interior wall pigment before
lighting. It uses building-local panels and seed-derived variations, with no
camera/time dependence. `ArtAtlas` owns texture replacement, context restoration,
and disposal; the personal-art UI persists only the processed atlas and pack
metadata in its separate IndexedDB database. An empty library skips sampling.
