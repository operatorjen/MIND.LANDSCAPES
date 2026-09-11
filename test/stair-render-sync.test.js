import assert from 'node:assert/strict'
import test from 'node:test'
import { STAIR_WIDTH } from '../src/config/world.js'
import { architectureGlsl } from '../src/render/glsl/architecture.glsl.js'
import { mazeGlsl } from '../src/render/glsl/maze.glsl.js'
import { concreteAggregateGlsl } from '../src/render/materials/concrete-aggregate.glsl.js'

test('rendered stair openings share the collision passage width', () => {
  assert.equal(STAIR_WIDTH, 1.55)
  assert.match(architectureGlsl, /vec3\(STAIR_WIDTH, 3\.35, stairHalfDepth\)/)
  assert.match(mazeGlsl, new RegExp(`vec2\\(${STAIR_WIDTH.toFixed(2)},`))
})

test('non-power-of-two concrete texture repeats in shader coordinates', () => {
  assert.match(concreteAggregateGlsl, /texture2D\(uConcreteHeightMap, fract\(textureCoordinate\)\)/)
  assert.match(concreteAggregateGlsl, /texture2D\(uConcreteHeightMap, fract\(textureCoordinate \* 2\.17/)
})
