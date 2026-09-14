import assert from 'node:assert/strict'
import test from 'node:test'
import { architectureGlsl } from '../src/render/glsl/architecture.glsl.js'
import { sceneGlsl } from '../src/render/glsl/scene.glsl.js'
import { lightingGlsl } from '../src/render/glsl/lighting.glsl.js'

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
  assert.match(architectureGlsl, /mazeNode\.a > 0\.5 && mazeNode\.a < 200\.5/)
  assert.match(architectureGlsl, /courtyardOffset/)
  assert.match(architectureGlsl, /columns \* 0\.5 - 0\.04/)
  assert.match(architectureGlsl, /ceilingBoundary = courtyardNode \? -1000\.0/)
  assert.match(architectureGlsl, /aboveStructure = max\(aboveStructure, -courtyardSkyShaft\)/)
  assert.match(architectureGlsl, /MATERIAL_COURTYARD_STONE/)
  assert.match(architectureGlsl, /MATERIAL_COURTYARD_SOIL/)
  assert.match(architectureGlsl, /MATERIAL_COURTYARD_FOLIAGE/)
  assert.match(architectureGlsl, /courtyardWaterShape/)
  assert.match(architectureGlsl, /courtyardEdgeJitter/)
  assert.match(architectureGlsl, /soilEdgeWeight/)
  assert.match(architectureGlsl, /courtyardSoilBand/)
  assert.match(architectureGlsl, /courtyardRockDistance/)
  assert.match(architectureGlsl, /MATERIAL_COURTYARD_ROCK/)
  assert.match(lightingGlsl, /const int courtyardReflectionSteps = 8/)
  assert.match(lightingGlsl, /const int courtyardReflectionSteps = 20/)
  assert.match(lightingGlsl, /const int courtyardReflectionSteps = 28/)
})

test('the lower stairwell includes solid descending treads as well as carved headroom', () => {
  assert.match(architectureGlsl, /vec2 lowerStairGeometry/)
  assert.match(architectureGlsl, /vec2\(cavity, mass\)/)
  assert.match(architectureGlsl, /shell = max\(shell, -lowerStair\.x\)/)
  assert.match(architectureGlsl, /shell = min\(shell, lowerStair\.y\)/)
})

test('stacked underground floors replace the terrain solid with architecture geometry', () => {
  assert.match(sceneGlsl, /terrain < 0\.0 && dryStructureInterior\(point\)/)
})

test('portal motion uses a bounded periodic phase and flow field', () => {
  assert.match(architectureGlsl, /float portalTime = mod\(uTime \* uMotionScale, 628\.31854\)/)
  assert.match(lightingGlsl, /float portalTime = mod\(uTime \* uMotionScale, 628\.31854\)/)
  assert.match(lightingGlsl, /vec2 portalFlow = vec2\(sin\(portalTime \* 0\.12\), cos\(portalTime \* 0\.12\)\) \* 1\.35/)
  assert.doesNotMatch(lightingGlsl, /-portalTime \* 0\.12/)
})
