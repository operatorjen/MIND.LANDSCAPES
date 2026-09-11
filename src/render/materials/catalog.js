import {
  barkContourDefaults,
  barkContoursGlsl
} from './bark-contours.glsl.js'
import {
  grassMeadowDefaults,
  grassMeadowGlsl
} from './grass-meadow.glsl.js'
import {
  concreteAggregateDefaults,
  concreteAggregateGlsl
} from './concrete-aggregate.glsl.js'
import {
  sunlitOvergrowthDefaults,
  sunlitOvergrowthGlsl
} from './sunlit-overgrowth.glsl.js'
import { personalArtGlsl } from './personal-art.glsl.js'
import { flowersGlsl } from './flowers.glsl.js'
import { indoorCourtyardGlsl } from './indoor-courtyard.glsl.js'
import { MATERIAL_BOUNDARY } from '../../config/materials.js'

export const materialCatalog = Object.freeze([
  Object.freeze({
    key: 'surreal-flowers',
    label: 'Surreal courtyard flowers',
    reference: 'dahlia whorls, rhododendron trumpets, rose bowls and sunflower disks',
    appliesTo: 'collision-free indoor courtyard water gardens',
    materialRange: Object.freeze([MATERIAL_BOUNDARY.succulent, MATERIAL_BOUNDARY.grass]),
    mapping: 'seeded plant-local geometry with approach-based flowering',
    outputs: Object.freeze(['dahlia', 'rhododendron', 'rose', 'sunflower', 'stem', 'seed-disk', 'close-petal-veins']),
    textureInputs: Object.freeze([]),
    controls: Object.freeze({ outdoorSpacing: 4.8, indoorSpacing: 3.4, nearDistance: 7, farDistance: 46 }),
    shader: flowersGlsl
  }),
  Object.freeze({
    key: 'indoor-courtyard',
    label: 'Media-seeded underground wild garden',
    reference: 'uploaded contour drawings and cracked, flowing turquoise, coral and gold paint',
    appliesTo: 'one reachable garden of up to twelve cells per building',
    materialRange: Object.freeze([MATERIAL_BOUNDARY.foliageDetail, MATERIAL_BOUNDARY.liminal]),
    mapping: 'building-local courtyard stone, soil, moss and foliage',
    outputs: Object.freeze(['rose-beige-stucco', 'textured-plaster-relief', 'dusk-wall-downlights', 'curving-stream-water', 'low-river-boulders', 'morphing-flowers']),
    textureInputs: Object.freeze(['local browser art analysis palette and maze recipe', 'concrete height map']),
    controls: Object.freeze({ variants: 3, ceiling: 'open-to-live-sky', maximumPerBuilding: 1 }),
    shader: indoorCourtyardGlsl
  }),
  Object.freeze({
    key: 'personal-art',
    label: 'Personal art',
    reference: 'locally imported transparent art with seeded spray wear',
    appliesTo: 'interior walls, especially underground halls',
    materialRange: Object.freeze([4, MATERIAL_BOUNDARY.liminal]),
    mapping: 'building-local wall panels',
    outputs: Object.freeze(['alpha-blended-pigment']),
    textureInputs: Object.freeze(['local browser art atlas (RGBA)']),
    controls: Object.freeze({ maxImages: 32, tilePixels: 256 }),
    shader: personalArtGlsl
  }),
  Object.freeze({
    key: 'bark-contours',
    label: 'Nested contour bark',
    reference: 'hand-drawn elongated islands with irregular nested rings',
    appliesTo: 'wood',
    materialRange: Object.freeze([MATERIAL_BOUNDARY.terrain, MATERIAL_BOUNDARY.bark]),
    mapping: 'tree-local cylindrical',
    outputs: Object.freeze(['antialiased-color-mask', 'height', 'weathering-mask', 'ridge-palette']),
    textureInputs: Object.freeze([]),
    controls: barkContourDefaults,
    shader: barkContoursGlsl
  }),
  Object.freeze({
    key: 'grass-meadow',
    label: 'Wispy meadow grass',
    reference: 'sinusoidal feather-grass clumps with mixed lengths and faded natural color',
    appliesTo: 'terrain and ground growth',
    materialRange: Object.freeze([0, MATERIAL_BOUNDARY.terrain]),
    secondaryMaterialRange: Object.freeze([MATERIAL_BOUNDARY.succulent, MATERIAL_BOUNDARY.grass]),
    mapping: 'stable world-space planar and growth-cell local',
    outputs: Object.freeze(['coverage', 'fiber-mask', 'dryness', 'blade-gradient']),
    textureInputs: Object.freeze([]),
    controls: grassMeadowDefaults,
    shader: grassMeadowGlsl
  }),
  Object.freeze({
    key: 'concrete-aggregate',
    label: 'Fine organic concrete aggregate',
    reference: 'fine cast-concrete grain, tiny pores and sparse subscale aggregate',
    appliesTo: 'exterior concrete architecture',
    materialRange: Object.freeze([MATERIAL_BOUNDARY.grass, MATERIAL_BOUNDARY.concrete]),
    mapping: 'dominant-axis world-space planar',
    outputs: Object.freeze(['aggregate-mask', 'pore-mask', 'matrix-tone', 'weathering-mask', 'height']),
    textureInputs: Object.freeze(['assets/textures/concrete-height.png (linear grayscale height)']),
    controls: concreteAggregateDefaults,
    shader: concreteAggregateGlsl
  }),
  Object.freeze({
    key: 'sunlit-overgrowth',
    label: 'Solar-path moss and climbing vines',
    reference: 'sparse moss colonies and fine climbing tendrils on sun-exposed concrete',
    appliesTo: 'exterior concrete walls',
    materialRange: Object.freeze([MATERIAL_BOUNDARY.grass, MATERIAL_BOUNDARY.concrete]),
    mapping: 'vertical world-space planar with stable solar exposure',
    outputs: Object.freeze(['moss-mask', 'vine-mask', 'solar-exposure', 'growth-morph']),
    textureInputs: Object.freeze(['assets/textures/sunlit-overgrowth-mask.png (linear grayscale coverage)']),
    controls: sunlitOvergrowthDefaults,
    shader: sunlitOvergrowthGlsl
  })
])

export const materialGlsl = materialCatalog
  .map(({ shader }) => shader)
  .join('\n')
