import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isPositionBlocked,
  portalDestinationAt,
  structureLayout,
  terrainHeightAt
} from '../src/world/spatial-layout.js'
import { deriveSettings } from '../src/world/world-state.js'

const SEED = 0.314159
const POSITION_TOLERANCE = 1e-9

function structureSettings() {
  const settings = deriveSettings([])
  settings.water.level = -2.5
  settings.generation.structures = 2
  settings.generation.mechanicalIntensity = 1
  settings.generation.ritualIntensity = 1
  return settings
}

function worldPoint(layout, x, z, y = layout.ground + 1.82) {
  const cosine = Math.cos(layout.angle)
  const sine = Math.sin(layout.angle)
  return {
    x: layout.centerX + cosine * x - sine * z,
    y,
    z: layout.centerZ + sine * x + cosine * z
  }
}

test('terrain height remains stable for a fixed position and seed', () => {
  const settings = deriveSettings([])
  const height = terrainHeightAt(12.5, -7.25, settings, SEED)

  assert.ok(Math.abs(height - 1.6792820399309885) < POSITION_TOLERANCE)
  assert.equal(height, terrainHeightAt(12.5, -7.25, settings, SEED))
})

test('structure layout remains stable for a fixed cell and seed', () => {
  const settings = structureSettings()
  const layout = structureLayout(-3, -3, settings, SEED)

  assert.ok(layout)
  assert.equal(layout.style, 2)
  assert.ok(Math.abs(layout.centerX + 331.10693359375) < POSITION_TOLERANCE)
  assert.ok(Math.abs(layout.centerZ + 343.549072265625) < POSITION_TOLERANCE)
  assert.deepEqual(layout, structureLayout(-3, -3, settings, SEED))
})

test('structure collision preserves walls, nave, and doorway access', () => {
  const settings = structureSettings()
  const layout = structureLayout(-3, -3, settings, SEED)
  const sideWall = worldPoint(layout, layout.width * 0.5, layout.depth * 0.22)
  const nave = worldPoint(layout, 0, 0)
  const doorway = worldPoint(layout, 0, layout.depth * 0.5)

  assert.equal(isPositionBlocked(sideWall, settings, SEED, 0.34), true)
  assert.equal(isPositionBlocked(nave, settings, SEED, 0.34), false)
  assert.equal(isPositionBlocked(doorway, settings, SEED, 0.34), false)
})

test('underground portals resolve to a stable destination', () => {
  const settings = structureSettings()
  const layout = structureLayout(-3, -3, settings, SEED)
  const stairX = (layout.variant > 0.5 ? 1 : -1) * layout.width * 0.22
  const portalZ = -layout.depth * layout.tunnelFactor
  const position = worldPoint(layout, stairX, portalZ, layout.ground - 2)
  const destination = portalDestinationAt(position, settings, SEED)

  assert.ok(destination)
  assert.deepEqual(destination, portalDestinationAt(position, settings, SEED))
  assert.notEqual(destination.x, position.x)
  assert.notEqual(destination.z, position.z)
})
