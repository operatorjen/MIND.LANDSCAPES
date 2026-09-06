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
