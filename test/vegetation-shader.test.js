import assert from 'node:assert/strict'
import test from 'node:test'
import { vegetationGlsl } from '../src/render/glsl/vegetation.glsl.js'
import { vegetationCommonGlsl } from '../src/render/glsl/vegetation/common.glsl.js'
import { foliageGeometryGlsl } from '../src/render/glsl/vegetation/foliage.glsl.js'
import { forestGeometryGlsl } from '../src/render/glsl/vegetation/forest-geometry.glsl.js'
import { grassGeometryGlsl } from '../src/render/glsl/vegetation/grass-geometry.glsl.js'
import { vegetationPlacementGlsl } from '../src/render/glsl/vegetation/placement.glsl.js'
import { lightingGlsl } from '../src/render/glsl/lighting.glsl.js'

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

test('tree foliage morphs efficient distant crowns into nearby sphere clusters', () => {
  assert.match(foliageGeometryGlsl, /float grapeLeafClusterDistance/)
  assert.match(foliageGeometryGlsl, /float sphereDetail = smoothstep\(0\.34, 0\.82, detail\)/)
  assert.match(foliageGeometryGlsl, /float cluster = ellipsoidDistance/)
  assert.equal((foliageGeometryGlsl.match(/leafSphereDistance\(local,/g) || []).length, 5)
  assert.match(foliageGeometryGlsl, /radius \* 0\.66/)
  assert.match(foliageGeometryGlsl, /radius \* 1\.12/)
  assert.doesNotMatch(foliageGeometryGlsl, /deciduousLeafDistance/)
})

test('nearby tree spheres use the berry palette', () => {
  assert.match(lightingGlsl, /vec3 pomegranate = vec3\(1\.0, 0\.012, 0\.055\)/)
  assert.match(lightingGlsl, /vec3 hotPink = vec3\(1\.48, 0\.035, 0\.54\)/)
  assert.match(lightingGlsl, /vec3 mutedGreen = vec3\(0\.24, 0\.5, 0\.23\)/)
  assert.match(lightingGlsl, /dot\(position, vec3\(1\.07, 0\.83, 0\.91\)\)/)
  assert.match(lightingGlsl, /mix\(pomegranate, hotPink, smoothstep/)
  assert.match(lightingGlsl, /mix\(berryColor, mutedGreen, smoothstep/)
  assert.doesNotMatch(lightingGlsl, /berryIdentity < /)
  assert.match(lightingGlsl, /mix\(1\.0, 0\.18, berryDetail\)/)
})

test('outdoor water keeps nearby detail and skips distant ripple and sky work', () => {
  assert.match(lightingGlsl, /vec2 waterSurfaceGradient\(vec2 point, float detail, float micro\)/)
  assert.match(lightingGlsl, /if \(detail <= 0\.002\) return vec2\(0\.0\)/)
  assert.match(lightingGlsl, /waterSurfaceGradient\(position\.xz, rippleDetail, microDetail\)/)
  assert.match(lightingGlsl, /float reflectionDetail = 1\.0 - smoothstep\(24\.0, 70\.0 \* uDetailScale, distanceFromCamera\)/)
  assert.match(lightingGlsl, /vec3 hazeColor = aerialHazeColor\(direction\)/)
  assert.match(lightingGlsl, /vec3 reflectionColor = hazeColor/)
  assert.match(lightingGlsl, /if \(reflectionDetail > 0\.002\)/)
  assert.match(lightingGlsl, /mix\(reflectionColor, skyColor\(reflected\), reflectionDetail\)/)
  assert.match(lightingGlsl, /return mix\(color, hazeColor, fog\)/)
})
