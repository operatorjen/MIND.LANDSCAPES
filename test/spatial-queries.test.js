import assert from 'node:assert/strict'
import test from 'node:test'
import { SpatialQueries } from '../src/world/spatial-queries.js'
import { isPositionBlocked, isUndergroundAt, portalDestinationAt, terrainHeightAt, structureLayout, undergroundPathAt } from '../src/world/spatial-layout.js'
import { deriveSettings } from '../src/world/world-state.js'

function compare(queries, settings, seed, x, z) {
  const height = terrainHeightAt(x, z, settings, seed)
  assert.equal(queries.terrainHeightAt(x, z), height)
  assert.equal(queries.isUndergroundAt(x, z), isUndergroundAt(x, z, settings, seed))
  for (const y of [height + 1.82, height - 2, height + 8]) {
    const position = { x, y, z }
    for (const radius of [0.34, 0.46]) {
      assert.equal(queries.isPositionBlocked(position, radius), isPositionBlocked(position, settings, seed, radius))
    }
    assert.deepEqual(queries.portalDestinationAt(position), portalDestinationAt(position, settings, seed))
  }
}

test('cached queries match uncached terrain, vegetation and buildings across cells', () => {
  const settings = deriveSettings([])
  settings.generation.forests = 2
  settings.generation.shrubs = 2
  settings.generation.succulents = 2
  const queries = new SpatialQueries()
  for (const seed of [0.314159, 0.731, 0.527]) {
    queries.update(settings, seed)
    for (let i = 0; i < 120; i++) compare(queries, settings, seed, i * 2.37 - 140, Math.sin(i * 0.7) * 130)
    compare(queries, settings, seed, 0, 7)
    compare(queries, settings, seed, 0, 7)
  }
})

test('cache invalidates in-place world changes and seed changes', () => {
  const settings = deriveSettings([])
  const queries = new SpatialQueries()
  queries.update(settings, 0.314159)
  compare(queries, settings, 0.314159, 12.5, -7.25)
  const before = queries.terrainHeightAt(12.5, -7.25)
  settings.terrain.amplitude += 3
  settings.water.level = -2.5
  settings.generation.structures = 2
  queries.update(settings, 0.314159)
  assert.notEqual(queries.terrainHeightAt(12.5, -7.25), before)
  compare(queries, settings, 0.314159, 12.5, -7.25)
  queries.update(settings, 0.731)
  compare(queries, settings, 0.731, 12.5, -7.25)
})

test('cache preserves underground portal destinations and remains bounded', () => {
  const settings = deriveSettings([])
  settings.water.level = -2.5
  settings.generation.structures = 2
  settings.generation.mechanicalIntensity = 1
  settings.generation.ritualIntensity = 1
  const seed = 0.314159
  const queries = new SpatialQueries()
  queries.update(settings, seed)
  const layout = structureLayout(-3, -3, settings, seed)
  const portal = undergroundPathAt(layout, 1)
  const position = {
    x: layout.centerX + Math.cos(layout.angle) * portal.x - Math.sin(layout.angle) * portal.z,
    z: layout.centerZ + Math.sin(layout.angle) * portal.x + Math.cos(layout.angle) * portal.z,
    y: layout.ground - 2
  }
  assert.ok(queries.portalDestinationAt(position))
  assert.deepEqual(queries.portalDestinationAt(position), portalDestinationAt(position, settings, seed))
  for (let i = 0; i < 1500; i++) queries.terrainHeightAt(i * 13, i * -7)
  for (const map of queries.maps.values()) assert.ok(map.size <= 512)
  compare(queries, settings, seed, position.x, position.z)
})

test('visual-only changes preserve spatial caches while maze edits invalidate them', () => {
  const settings = deriveSettings([])
  settings.maze = { seed: 7, rooms: 0.4, loops: 0.1, turnBias: 0.5, reach: 4 }
  const queries = new SpatialQueries()
  assert.equal(queries.update(settings, 0.5), true)
  queries.terrainHeightAt(0, 0)
  const terrain = queries.maps.get('terrain')
  settings.atmosphere.dayCycleSpeed = 3
  settings.palette.accent = '#eeeeee'
  assert.equal(queries.update(settings, 0.5), false)
  assert.equal(queries.maps.get('terrain'), terrain)
  settings.atmosphere.warmth += 0.1
  assert.equal(queries.update(settings, 0.5), true)
  settings.maze.rooms = 0.8
  assert.equal(queries.update(settings, 0.5), true)
  assert.equal(queries.maps.size, 0)
  delete settings.maze
  assert.equal(queries.update(settings, 0.5), true)
})

test('stationary portal lookups are reused and height changes remain distinct', () => {
  const queries = new SpatialQueries()
  queries.update(deriveSettings([]), 0.314159)
  const position = { x: 0, y: 4, z: 8 }
  queries.portalDestinationAt(position)
  const cache = queries.maps.get('portal')
  queries.portalDestinationAt(position)
  assert.equal(cache.size, 1)
  queries.portalDestinationAt({ ...position, y: 2 })
  assert.equal(cache.size, 2)
})
