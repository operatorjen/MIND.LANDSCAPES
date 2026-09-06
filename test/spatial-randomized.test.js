import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isPositionBlocked,
  isUndergroundAt,
  portalDestinationAt,
  structureLayout,
  undergroundPathAt
} from '../src/world/spatial-layout.js'
import {
  STRUCTURE_CELL_JITTER,
  STRUCTURE_CELL_SIZE,
  TUNNEL_FACTOR_MAX,
  TUNNEL_FACTOR_MIN
} from '../src/config/world.js'
import { deriveSettings } from '../src/world/world-state.js'

const CASES = 64
const RADIUS = 0.34

function structureSettings() {
  const settings = deriveSettings([])
  settings.water.level = -2.5
  settings.generation.structures = 2
  settings.generation.mechanicalIntensity = 1
  settings.generation.ritualIntensity = 1
  return settings
}

function randomSource(initial) {
  let state = initial >>> 0
  return () => {
    state = Math.imul(state ^ state >>> 15, 1 | state)
    state ^= state + Math.imul(state ^ state >>> 7, 61 | state)
    return ((state ^ state >>> 14) >>> 0) / 4294967296
  }
}

function worldPoint(layout, x, z, y) {
  const cosine = Math.cos(layout.angle)
  const sine = Math.sin(layout.angle)
  return {
    x: layout.centerX + cosine * x - sine * z,
    y,
    z: layout.centerZ + sine * x + cosine * z
  }
}

function findLayout(settings, seed, random) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const cellX = Math.floor(random() * 25) - 12
    const cellZ = Math.floor(random() * 25) - 12
    const layout = structureLayout(cellX, cellZ, settings, seed)
    if (layout) return layout
  }
  throw new Error(`No structure found for seed ${seed}`)
}

test('randomized structure generation remains deterministic and bounded', () => {
  const settings = structureSettings()
  const random = randomSource(0x5eed1234)

  for (let index = 0; index < CASES; index++) {
    const seed = random()
    const layout = findLayout(settings, seed, random)
    const cellCenterX = layout.cellX * STRUCTURE_CELL_SIZE
    const cellCenterZ = layout.cellZ * STRUCTURE_CELL_SIZE

    assert.deepEqual(layout, structureLayout(layout.cellX, layout.cellZ, settings, seed))
    assert.ok(Math.abs(layout.centerX - cellCenterX) <= STRUCTURE_CELL_JITTER * 0.5)
    assert.ok(Math.abs(layout.centerZ - cellCenterZ) <= STRUCTURE_CELL_JITTER * 0.5)
    assert.ok(layout.tunnelFactor >= TUNNEL_FACTOR_MIN)
    assert.ok(layout.tunnelFactor <= TUNNEL_FACTOR_MAX)
    assert.ok(layout.style >= 0 && layout.style <= 3)
    assert.ok(layout.width > layout.doorWidth + layout.wall * 2)
    assert.ok(layout.depth > layout.width)
  }
})

test('randomized underground paths agree with collision and portal layout', () => {
  const settings = structureSettings()
  const random = randomSource(0xc0111de)

  for (let index = 0; index < CASES; index++) {
    const seed = random()
    const layout = findLayout(settings, seed, random)
    const path = Array.from({ length: 13 }, (_, sample) => undergroundPathAt(layout, sample / 12))
    const start = path[0]
    const end = path.at(-1)

    assert.ok(start.z > end.z)
    for (const sample of path.slice(1, -1)) {
      const position = worldPoint(layout, sample.x, sample.z, layout.ground - 3.4)
      assert.equal(isUndergroundAt(position.x, position.z, settings, seed), true)
      assert.equal(isPositionBlocked(position, settings, seed, RADIUS), false)
    }

    const middle = path[6]
    const wall = worldPoint(layout, layout.width * 0.48, -layout.depth * 0.4, layout.ground - 3.4)
    assert.equal(isPositionBlocked(wall, settings, seed, RADIUS), true)

    const portal = undergroundPathAt(layout, 1)
    const portalPosition = worldPoint(layout, portal.x, portal.z, layout.ground - 2)
    const firstDestination = portalDestinationAt(portalPosition, settings, seed)
    const secondDestination = portalDestinationAt(portalPosition, settings, seed)
    assert.deepEqual(firstDestination, secondDestination)
    assert.ok(firstDestination)
    assert.notEqual(firstDestination.x, portalPosition.x)
    assert.notEqual(firstDestination.z, portalPosition.z)
  }
})
