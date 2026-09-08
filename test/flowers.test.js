import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveSettings } from '../src/world/world-state.js'
import { terrainHeightAt, walkingSurfaceAt, isPositionBlocked } from '../src/world/spatial-layout.js'
import { MATERIAL, MATERIAL_BOUNDARY } from '../src/config/materials.js'
import { materialCatalog } from '../src/render/materials/catalog.js'

test('flower coverage does not add collision or change the walking surface', () => {
  const bare = deriveSettings([])
  Object.assign(bare.generation, { grasses: 0, forests: 0, shrubs: 0, succulents: 0, structures: 0 })
  const floral = structuredClone(bare)
  floral.generation.grasses = 2
  for (let x = -30; x <= 30; x += 5) for (let z = -30; z <= 30; z += 5) {
    const y = terrainHeightAt(x, z, bare, 0.314159) + 1.82
    const p = { x, y, z }
    assert.equal(isPositionBlocked(p, floral, 0.314159), isPositionBlocked(p, bare, 0.314159))
    assert.deepEqual(walkingSurfaceAt(x, z, y, floral, 0.314159), walkingSurfaceAt(x, z, y, bare, 0.314159))
  }
})

test('all four flower materials use the shared ground-growth shading range', () => {
  const ids = ['dahlia', 'rhododendron', 'rose', 'sunflower', 'flowerDisk'].map(key => MATERIAL[key])
  assert.equal(new Set(ids).size, 5)
  for (const id of ids) assert.ok(id > MATERIAL.grass && id < MATERIAL_BOUNDARY.grass)
  const flowers = materialCatalog.find(item => item.key === 'surreal-flowers')
  for (const species of ['dahlia', 'rhododendron', 'rose', 'sunflower']) assert.ok(flowers.outputs.includes(species))
})
