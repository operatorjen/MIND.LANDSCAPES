import assert from 'node:assert/strict'
import test from 'node:test'
import { architectureGlsl } from '../src/render/glsl/architecture.glsl.js'

test('architecture continuously morphs from a weathered boulder into the detailed structure', () => {
  assert.match(architectureGlsl, /architectureBoulderDistance/)
  assert.match(architectureGlsl, /morphArchitectureDistance\(boulderMass, structure, structureDetail\)/)
  assert.match(architectureGlsl, /distanceToEnvelope/)
  assert.match(architectureGlsl, /max\(abs\(cameraLocal\) - morphEnvelope, 0\.0\)/)
  assert.match(architectureGlsl, /if \(structureDetail < 0\.002\) return boulderMass/)
  assert.doesNotMatch(architectureGlsl, /distantBase/)
  assert.doesNotMatch(architectureGlsl, /proximityDetail\(center, 18\.0, 88\.0\)/)
})

test('underground courtyards open a sky shaft only underground and use dedicated stone, soil and foliage surfaces', () => {
  assert.match(architectureGlsl, /indoorCourtyardDistance/)
  assert.match(architectureGlsl, /mazeNode\.a > 0\.5 && mazeNode\.a < 254\.5/)
  assert.match(architectureGlsl, /courtyardOffset/)
  assert.match(architectureGlsl, /columns \* 0\.5 - 0\.04/)
  assert.match(architectureGlsl, /ceilingBoundary = courtyardNode \? -1000\.0/)
  assert.match(architectureGlsl, /aboveStructure = max\(aboveStructure, -courtyardSkyShaft\)/)
  assert.match(architectureGlsl, /MATERIAL_COURTYARD_STONE/)
  assert.match(architectureGlsl, /MATERIAL_COURTYARD_SOIL/)
  assert.match(architectureGlsl, /MATERIAL_COURTYARD_FOLIAGE/)
})
