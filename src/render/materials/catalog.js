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
import { MATERIAL_BOUNDARY } from '../../config/materials.js'

export const materialCatalog = Object.freeze([
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
    reference: 'small irregular bent aggregate marks derived from the supplied hand-drawn texture',
    appliesTo: 'exterior concrete architecture',
    materialRange: Object.freeze([MATERIAL_BOUNDARY.grass, MATERIAL_BOUNDARY.concrete]),
    mapping: 'dominant-axis world-space planar',
    outputs: Object.freeze(['aggregate-mask', 'pore-mask', 'matrix-tone', 'weathering-mask', 'height']),
    textureInputs: Object.freeze([]),
    controls: concreteAggregateDefaults,
    shader: concreteAggregateGlsl
  })
])

export const materialGlsl = materialCatalog
  .map(({ shader }) => shader)
  .join('\n')
