import assert from 'node:assert/strict'
import test from 'node:test'
import { vegetationGlsl } from '../src/render/glsl/vegetation.glsl.js'
import { vegetationCommonGlsl } from '../src/render/glsl/vegetation/common.glsl.js'
import { foliageGeometryGlsl } from '../src/render/glsl/vegetation/foliage.glsl.js'
import { forestGeometryGlsl } from '../src/render/glsl/vegetation/forest-geometry.glsl.js'
import { grassGeometryGlsl } from '../src/render/glsl/vegetation/grass-geometry.glsl.js'
import { vegetationPlacementGlsl } from '../src/render/glsl/vegetation/placement.glsl.js'

test('vegetation shader composes subsystem modules in dependency order', () => {
  const modules = [
    vegetationCommonGlsl,
    foliageGeometryGlsl,
    vegetationPlacementGlsl,
    grassGeometryGlsl,
    forestGeometryGlsl
  ]
  let previousIndex = -1

  for (const source of modules) {
    assert.ok(source.trim())
    const index = vegetationGlsl.indexOf(source)
    assert.ok(index > previousIndex)
    previousIndex = index
  }

  assert.match(vegetationGlsl, /float surrealFlowerDistance/)
  assert.match(vegetationGlsl, /float forestDistance/)
})
