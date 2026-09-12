import assert from 'node:assert/strict'
import test from 'node:test'
import { SpatialQueries } from '../src/world/spatial-queries.js'
import { deriveSettings } from '../src/world/world-state.js'
import { structureLayout } from '../src/world/spatial-layout.js'
import {
  EcologyState,
  FULL_GROWTH_LIGHT_SECONDS,
  SEED_TYPES,
  daylightAmount,
  discoveredAvailablePlantingPockets,
  isCultivationCell,
  normalizeEcologyDocument,
  nearestAvailablePlantingPocket,
  nearestUndiscoveredPlantingPocket,
  nextAvailableSeed,
  plantingCenter,
  plantingPocket,
  plantedPlantingPockets,
  seedBagForLayout
} from '../src/world/ecology.js'
import { ecologyMapGlsl } from '../src/render/glsl/ecology-map.glsl.js'
import { plantedGeometryGlsl } from '../src/render/glsl/vegetation/planted-geometry.glsl.js'
import { architectureGlsl } from '../src/render/glsl/architecture.glsl.js'

const seed = 0.314159

function repository() {
  return { saves: 0, save: async function () { this.saves++ }, dispose() {} }
}

function findCell(predicate) {
  for (let z = -20; z <= 20; z++) for (let x = -20; x <= 20; x++) if (predicate(x, z)) return { cellX: x, cellZ: z }
  throw new Error('No matching ecology cell was generated.')
}

test('cultivation pockets remain building-free and above water as the generated world changes', () => {
  const cell = findCell((x, z) => isCultivationCell(x, z, seed))
  const sparse = deriveSettings([])
  const dense = structuredClone(sparse)
  Object.assign(dense.generation, { structures: 2, mechanicalIntensity: 2, ritualIntensity: 2, mountains: 2, valleys: 2 })
  dense.water.level = 1.5
  assert.equal(structureLayout(cell.cellX, cell.cellZ, sparse, seed), null)
  assert.equal(structureLayout(cell.cellX, cell.cellZ, dense, seed), null)
  const first = plantingPocket(cell.cellX, cell.cellZ, sparse, seed)
  const changed = plantingPocket(cell.cellX, cell.cellZ, dense, seed)
  assert.deepEqual({ x: first.x, z: first.z }, { x: changed.x, z: changed.z })
  assert.ok(changed.y >= dense.water.level + 0.61)
  const cache = new SpatialQueries()
  cache.update(sparse, seed)
  const cached = plantingPocket(cell.cellX, cell.cellZ, sparse, seed, cache)
  assert.deepEqual(cached, first)
  assert.equal(plantingPocket(cell.cellX, cell.cellZ, sparse, seed, cache), cached)
  cache.update(dense, seed)
  assert.deepEqual(plantingPocket(cell.cellX, cell.cellZ, dense, seed, cache), changed)
})

test('seed bags are deterministic interior items attached only to generated buildings', () => {
  const settings = deriveSettings([])
  settings.generation.structures = 2
  const cell = findCell((x, z) => structureLayout(x, z, settings, seed))
  const layout = structureLayout(cell.cellX, cell.cellZ, settings, seed)
  const first = seedBagForLayout(layout)
  const second = seedBagForLayout(structureLayout(cell.cellX, cell.cellZ, settings, seed))
  assert.deepEqual(first, second)
  assert.ok(SEED_TYPES.some(({ id }) => id === first.species))
  assert.ok(first.y < layout.ground - 4)
  assert.equal(seedBagForLayout(null), null)
  const cache = new SpatialQueries()
  cache.update(settings, seed)
  const cached = seedBagForLayout(layout, cache)
  assert.deepEqual(cached, first)
  assert.equal(seedBagForLayout(layout, cache), cached)
  cache.update(settings, seed + 1)
  assert.equal(cache.maps.size, 0)
})

test('collected bags become inventory, planting consumes one seed, and daylight matures plants once', async () => {
  const store = repository()
  const state = new EcologyState(store, normalizeEcologyDocument(null, seed))
  const type = SEED_TYPES[1]
  const bag = { id: 'bag:1:2', species: type.id }
  assert.equal(await state.collectBag(bag), true)
  assert.equal(await state.collectBag(bag), false)
  assert.equal(state.document.inventory[type.id], 1)
  assert.equal(state.document.selectedSeed, type.id)
  const pocket = { cellX: 4, cellZ: 7 }
  assert.ok(await state.plant(pocket))
  assert.equal(await state.plant(pocket), null)
  assert.equal(state.document.inventory[type.id], 0)
  state.advanceGrowth(FULL_GROWTH_LIGHT_SECONDS * 2, 1)
  state.advanceGrowth(FULL_GROWTH_LIGHT_SECONDS, 1)
  assert.equal(state.plantingAt(4, 7).growth, 1)
  assert.equal(state.document.stats.plantsMatured, 1)
  assert.equal(state.document.stats.bagsCollected, 1)
  assert.equal(state.document.stats.seedsPlanted, 1)
  assert.ok(store.saves >= 2)
})

test('seed selection advances round-robin as each type runs out', async () => {
  const state = new EcologyState(repository(), normalizeEcologyDocument({
    version: 1,
    seed,
    inventory: { moonbell: 1, ribbonFern: 1, emberThistle: 1 },
    selectedSeed: 'moonbell',
    collectedBags: [],
    plantings: [],
    stats: {}
  }, seed))
  assert.equal(nextAvailableSeed(state.document.inventory, 'moonbell'), 'ribbonFern')
  assert.equal((await state.plant({ cellX: 1, cellZ: 1 })).species, 'moonbell')
  assert.equal(state.document.selectedSeed, 'ribbonFern')
  assert.equal((await state.plant({ cellX: 2, cellZ: 2 })).species, 'ribbonFern')
  assert.equal(state.document.selectedSeed, 'emberThistle')
  assert.equal((await state.plant({ cellX: 3, cellZ: 3 })).species, 'emberThistle')
  assert.equal(await state.plant({ cellX: 4, cellZ: 4 }), null)
})

test('growth pauses at deep night and ecology geometry is atlas-backed and distance-bounded', () => {
  const state = new EcologyState(repository(), normalizeEcologyDocument({
    version: 1,
    seed,
    inventory: { moonbell: 0, ribbonFern: 0, emberThistle: 0 },
    selectedSeed: 'moonbell',
    collectedBags: [],
    plantings: [{ cellX: 0, cellZ: 0, species: 'moonbell', growth: 0.2 }],
    stats: {}
  }, seed))
  const before = state.document.plantings[0].growth
  state.advanceGrowth(60, daylightAmount(Math.PI * 1.5, 0.72))
  assert.equal(state.document.plantings[0].growth, before)
  assert.match(ecologyMapGlsl, /texture2D\(uEcologyAtlas/)
  assert.match(plantedGeometryGlsl, /cameraDistance > 68\.0 \* uDetailScale/)
  assert.match(plantedGeometryGlsl, /float plantedDistance/)
  assert.match(plantedGeometryGlsl, /#if SHADER_QUALITY_LEVEL|uDetailScale/)
  assert.match(architectureGlsl, /MATERIAL_SEED_BAG/)
})

test('planting centers and cultivation decisions remain deterministic', () => {
  for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) {
    assert.equal(isCultivationCell(x, z, seed), isCultivationCell(x, z, seed))
    assert.deepEqual(plantingCenter(x, z, seed), plantingCenter(x, z, seed))
  }
})

test('the planting beacon chooses the nearest available unoccupied pocket', () => {
  const settings = deriveSettings([])
  const ecology = new EcologyState(repository(), normalizeEcologyDocument(null, seed))
  const position = { x: 0, y: 2, z: 0 }
  const first = nearestAvailablePlantingPocket(position, settings, seed, ecology)
  assert.ok(first)
  ecology.document.plantings.push({ cellX: first.cellX, cellZ: first.cellZ, species: 'moonbell', growth: 0.2 })
  const second = nearestAvailablePlantingPocket(position, settings, seed, ecology)
  assert.ok(second)
  assert.notDeepEqual({ cellX: second.cellX, cellZ: second.cellZ }, { cellX: first.cellX, cellZ: first.cellZ })
  assert.ok(second.distance >= first.distance)
})

test('discovered planting pockets persist as beacon destinations while a new pocket remains targeted', async () => {
  const settings = deriveSettings([])
  const store = repository()
  const ecology = new EcologyState(store, normalizeEcologyDocument(null, seed))
  const position = { x: 0, y: 2, z: 0 }
  const discovered = nearestAvailablePlantingPocket(position, settings, seed, ecology)
  assert.equal(ecology.discoverPocket(discovered), true)
  assert.equal(ecology.discoverPocket(discovered), false)
  await Promise.resolve()
  assert.deepEqual(ecology.document.discoveredPockets, [{ cellX: discovered.cellX, cellZ: discovered.cellZ }])
  assert.deepEqual(discoveredAvailablePlantingPockets(settings, seed, ecology)
    .map(({ cellX, cellZ }) => ({ cellX, cellZ })), [{ cellX: discovered.cellX, cellZ: discovered.cellZ }])
  const unexplored = nearestUndiscoveredPlantingPocket(position, settings, seed, ecology)
  assert.ok(unexplored)
  assert.notDeepEqual({ cellX: unexplored.cellX, cellZ: unexplored.cellZ }, { cellX: discovered.cellX, cellZ: discovered.cellZ })
  ecology.document.plantings.push({ cellX: discovered.cellX, cellZ: discovered.cellZ, species: 'moonbell', growth: 0.2 })
  assert.deepEqual(discoveredAvailablePlantingPockets(settings, seed, ecology), [])
  assert.deepEqual(plantedPlantingPockets(settings, seed, ecology).map(({ cellX, cellZ, plant }) => ({
    cellX,
    cellZ,
    species: plant.species
  })), [{ cellX: discovered.cellX, cellZ: discovered.cellZ, species: 'moonbell' }])
  assert.equal(store.saves, 1)
})
