import { PLAYER_RADIUS, MAZE_HALL_HALF_WIDTH, MAZE_ROOM_MIN_HALF_WIDTH } from '../src/config/navigation.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import { mazeRecipe, mazeForLayout, mazeDistance, mazeCollisionDistance, portalArrival, courtyardExitForLayout } from '../src/world/maze.js'
import { structureLayout, terrainHeightAt, walkingSurfaceAt, isPositionBlocked, portalDestinationAt } from '../src/world/spatial-layout.js'
import { deriveSettings, normalizeDocument, WorldState } from '../src/world/world-state.js'

function settingsFor(seed) {
  const settings = deriveSettings([])
  settings.water.level = -2.5
  settings.generation.structures = 2
  settings.maze = mazeRecipe([], seed)
  return settings
}
function worldPoint(layout, point, y = layout.ground - 3.78) {
  return { x: layout.centerX + Math.cos(layout.angle) * point.x - Math.sin(layout.angle) * point.z,
    z: layout.centerZ + Math.sin(layout.angle) * point.x + Math.cos(layout.angle) * point.z, y }
}

test('maze recipes follow media identity and mood, and survive serialization', () => {
  const calm = { source: { hash: 'calm-text' }, contribution: { generation: { mechanicalIntensity: 1, psychedelicIntensity: 0.1, ornateInteriors: 0.1 } } }
  const vivid = { source: { hash: 'vivid-image' }, contribution: { generation: { psychedelicIntensity: 1.8, abandonedInteriors: 1.3, ornateInteriors: 1.5 } } }
  const a = mazeRecipe([calm], 0.5), b = mazeRecipe([vivid], 0.5)
  assert.notEqual(a.seed, b.seed)
  assert.ok(b.turnBias > a.turnBias)
  assert.ok(b.rooms > a.rooms)
  assert.ok(b.gardenLushness > a.gardenLushness)
  assert.ok(b.gardenStyle >= 1 && b.gardenStyle <= 3)
  assert.ok(b.reach > a.reach)
  assert.deepEqual(mazeRecipe([calm, vivid], 0.5), mazeRecipe([vivid, calm], 0.5))
  const saved = normalizeDocument({ seed: 0.5, entries: [{ ...calm, contribution: { ...deriveSettings([]), generation: calm.contribution.generation } }] })
  assert.deepEqual(normalizeDocument(JSON.parse(JSON.stringify(saved))).maze, saved.maze)
  assert.ok(JSON.stringify(saved.maze).length < 300)
})

test('each building has at most one reachable courtyard away from its portal orbs', () => {
  let courtyards = 0
  let expandedCourtyards = 0
  const styles = new Set()
  for (let sample = 1; sample <= 80; sample++) {
    const seed = sample / 81
    const settings = settingsFor(seed)
    const layout = structureLayout(sample % 9 - 4, Math.floor(sample / 9) - 4, settings, seed)
    if (!layout) continue
    const maze = mazeForLayout(layout)
    const gardenNodes = maze.nodes.filter(node => node.courtyard)
    assert.ok(gardenNodes.length <= 1)
    assert.equal(gardenNodes.length, 1)
    const garden = gardenNodes[0]
    assert.equal(garden.portal, 0)
    assert.notEqual(garden.id, maze.entry)
    assert.ok(maze.paths[garden.id].length >= 3)
    assert.ok([6, 9, 12].includes(maze.courtyardTiles.length))
    if (maze.courtyardTiles.length === 12) expandedCourtyards++
    assert.ok(maze.courtyardTiles.every(node => node.portal === 0 && node.courtyardTile > 0))
    assert.deepEqual(maze.courtyardRoute, maze.paths[garden.id])
    assert.ok(mazeDistance(garden, layout) < -0.46)
    styles.add(garden.courtyard)
    courtyards++
  }
  assert.ok(courtyards > 30)
  assert.ok(expandedCourtyards > courtyards * 0.5)
  assert.ok(styles.size >= 2)
})

test('every maze room and door is connected, traversable, and has collision clearance', () => {
  let checked = 0, branches = 0, turns = 0
  for (let sample = 1; sample <= 80; sample++) {
    const seed = sample / 81, settings = settingsFor(seed)
    const layout = structureLayout(sample % 9 - 4, Math.floor(sample / 9) - 4, settings, seed)
    if (!layout) continue
    const maze = mazeForLayout(layout)
    assert.equal(Object.keys(maze.paths).length, 25)
    assert.equal(maze.portals.length, 2)
    for (const node of maze.nodes) {
      assert.ok(mazeDistance(node, layout) < -0.46)
      if (node.mask.toString(2).replaceAll('0', '').length >= 3) branches++
      const point = worldPoint(layout, node)
      assert.ok(Math.abs(terrainHeightAt(point.x, point.z, settings, seed) - (layout.ground - 5.6)) < 1e-8)
      assert.equal(isPositionBlocked(point, settings, seed, 0.46), false)
      for (const [bit, offset] of [[1, 1], [2, -1], [4, -5], [8, 5]]) {
        if (!(node.mask & bit)) continue
        const neighbor = maze.nodes[node.id + offset]
        assert.ok(neighbor)
        for (let i = 0; i <= 10; i++) {
          const local = { x: node.x + (neighbor.x - node.x) * i / 10, z: node.z + (neighbor.z - node.z) * i / 10 }
          assert.ok(mazeDistance(local, layout) < -0.46)
          assert.equal(isPositionBlocked(worldPoint(layout, local), settings, seed, 0.46), false)
        }
      }
    }
    for (let i = 2; i < maze.route.length; i++) if (maze.route[i] - maze.route[i - 1] !== maze.route[i - 1] - maze.route[i - 2]) turns++
    for (let portal = 0; portal < 2; portal++) {
      const arrival = portalArrival(layout, portal)
      assert.ok(mazeDistance(arrival, layout) < -0.46)
      assert.equal(portalDestinationAt(worldPoint(layout, arrival), settings, seed), null)
      const destination = portalDestinationAt(worldPoint(layout, maze.portals[portal]), settings, seed)
      assert.ok(destination)
      assert.deepEqual(destination, portalDestinationAt(worldPoint(layout, maze.portals[portal]), settings, seed))
      const ground = terrainHeightAt(destination.x, destination.z, settings, seed)
      assert.equal(isPositionBlocked({ ...destination, y: ground + 1.82 }, settings, seed, 0.46), false)
    }
    checked++
  }
  assert.ok(checked > 30)
  assert.ok(branches > checked)
  assert.ok(turns > checked * 2)
})

test('media edits persist a new recipe while ordinary settings edits retain links', async () => {
  let saved
  const repository = { save: async document => { saved = JSON.parse(JSON.stringify(document)) }, dispose() {} }
  const state = new WorldState(repository, { seed: 0.731, entries: [] })
  const before = state.document.maze
  await state.addOrReplace({ id: 'media', source: { key: 'test', hash: 'first' }, contribution: deriveSettings([]) })
  assert.notEqual(saved.maze.seed, before.seed)
  const influenced = saved.maze
  await state.setDayCycleSpeed(2)
  assert.deepEqual(saved.maze, influenced)
  const reload = new WorldState(repository, saved)
  assert.deepEqual(reload.effectiveSettings.maze, influenced)
  await state.remove('media')
  assert.deepEqual(saved.maze, before)
})


test('upper-floor walkers stay above the maze and stairs select the lower floor', () => {
  const seed = 0.314159, settings = settingsFor(seed)
  const layout = structureLayout(-3, -3, settings, seed)
  const node = mazeForLayout(layout).nodes[12]
  const point = worldPoint(layout, node)
  assert.equal(walkingSurfaceAt(point.x, point.z, layout.ground + 1.82, settings, seed), layout.ground)
  assert.ok(Math.abs(walkingSurfaceAt(point.x, point.z, layout.ground - 3.78, settings, seed) - (layout.ground - 5.6)) < 1e-8)
  const stairs = worldPoint(layout, { x: (layout.variant > 0.5 ? 1 : -1) * layout.width * 0.22, z: layout.depth * 0.05 })
  assert.ok(walkingSurfaceAt(stairs.x, stairs.z, layout.ground + 1.82, settings, seed) < layout.ground)
})


test('cylinder clearance uses exposed corners rather than overlapping room seams', () => {
  let formerlyBlocked = 0
  for (const seed of [0.314159, 0.731, 0.527]) {
    const settings = settingsFor(seed)
    for (let cell = -3; cell <= 3; cell++) {
      const layout = structureLayout(cell, -3, settings, seed)
      if (!layout) continue
      const maze = mazeForLayout(layout)
      for (const node of maze.nodes) {
        if (!(node.mask & 1)) continue
        const room = Math.max(MAZE_ROOM_MIN_HALF_WIDTH, Math.min(maze.stepX, maze.stepZ) * node.room / 255)
        const point = { x: node.x + room - 0.22, z: node.z + MAZE_HALL_HALF_WIDTH - 0.23 }
        if (mazeDistance(point, layout) <= -0.3) continue
        for (let angle = 0; angle < 360; angle++) {
          const radians = angle * Math.PI / 180
          assert.ok(mazeDistance({ x: point.x + Math.cos(radians) * 0.3,
            z: point.z + Math.sin(radians) * 0.3 }, layout) < 0)
        }
        assert.ok(mazeCollisionDistance(point, layout) < -0.3)
        assert.equal(isPositionBlocked(worldPoint(layout, point), settings, seed, 0.3), false)
        formerlyBlocked++
        const wall = { x: node.x + maze.stepX * 0.5, z: node.z + MAZE_HALL_HALF_WIDTH - 0.07 }
        if (!node.courtyardTile && !maze.nodes[node.id + 1]?.courtyardTile
          && mazeDistance({ x: wall.x, z: wall.z + 0.3 }, layout) > 0) {
          assert.ok(mazeCollisionDistance(wall, layout) > -0.3)
        }
      }
    }
  }
  assert.ok(formerlyBlocked > 20, `Only exercised ${formerlyBlocked} seams`)
})


test('every generated connection admits the player with generous lateral clearance', () => {
  assert.equal(MAZE_HALL_HALF_WIDTH * 2, 2.4)
  let connections = 0
  for (const seed of [0.314159, 0.731, 0.527]) {
    const settings = settingsFor(seed)
    for (let cell = -3; cell <= 3; cell++) {
      const layout = structureLayout(cell, -3, settings, seed)
      if (!layout) continue
      const maze = mazeForLayout(layout)
      for (const node of maze.nodes) for (const [bit, dx, dz] of [[1, maze.stepX, 0], [8, 0, -maze.stepZ]]) {
        if (!(node.mask & bit)) continue
        for (const offset of [-0.82, 0, 0.82]) for (let step = 0; step <= 20; step++) {
          const point = { x: node.x + dx * step / 20 + (dz ? offset : 0),
            z: node.z + dz * step / 20 + (dx ? offset : 0) }
          assert.ok(mazeCollisionDistance(point, layout) <= -PLAYER_RADIUS,
            'A hallway or its room opening pinches the player')
        }
        connections++
      }
    }
  }
  assert.ok(connections > 100)
})


test('stair landing joins the maze without an invisible collision end cap', () => {
  let checked = 0
  for (const seed of [0.314159, 0.731, 0.527]) {
    const settings = settingsFor(seed)
    for (let cell = -3; cell <= 3; cell++) {
      const layout = structureLayout(cell, -3, settings, seed)
      if (!layout) continue
      const x = (layout.variant > 0.5 ? 1 : -1) * layout.width * 0.22
      const end = -layout.depth * 0.14
      for (let step = 0; step <= 40; step++) {
        const point = { x, z: end + 0.6 - step * 0.04 }
        const world = worldPoint(layout, point)
        assert.equal(isPositionBlocked(world, settings, seed, PLAYER_RADIUS), false,
          `Stair landing blocked at offset ${point.z - end}`)
      }
      checked++
    }
  }
  assert.ok(checked > 5)
})

test('courtyard internal tile seams have full-room clearance and solid outer margins', () => {
  let seams = 0, margins = 0
  for (let sample = 1; sample <= 40; sample++) {
    const seed = sample / 81, settings = settingsFor(seed)
    const layout = structureLayout(sample % 9 - 4, Math.floor(sample / 9) - 4, settings, seed)
    if (!layout) continue
    const maze = mazeForLayout(layout)
    for (const a of maze.courtyardTiles) for (const b of maze.courtyardTiles) {
      const adjacent = Math.abs(a.x - b.x) < 0.001 && Math.abs(Math.abs(a.z - b.z) - maze.stepZ) < 0.001
        || Math.abs(a.z - b.z) < 0.001 && Math.abs(Math.abs(a.x - b.x) - maze.stepX) < 0.001
      if (!adjacent) continue
      const midpoint = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
      assert.ok(mazeDistance(midpoint, layout) < -PLAYER_RADIUS, 'Internal tile edge became a phantom wall')
      assert.equal(isPositionBlocked(worldPoint(layout, midpoint), settings, seed), false)
      seams++
    }
    const rear = Math.min(...maze.nodes.map(node => node.z - (node.courtyardTile ? maze.stepZ * 0.51 : Math.max(MAZE_ROOM_MIN_HALF_WIDTH, Math.min(maze.stepX, maze.stepZ) * node.room / 255))))
    const point = worldPoint(layout, { x: maze.courtyardCenter.x, z: rear - 0.2 })
    assert.equal(isPositionBlocked(point, settings, seed), true, 'Rear collision bounds ended before the wall')
    assert.ok(Math.abs(terrainHeightAt(point.x, point.z, settings, seed) - (layout.ground - 5.6)) < 0.001, 'Terrain raised the player through a boundary')
    margins++
  }
  assert.ok(seams > 100 && margins > 20)
})


test('marked courtyard thresholds return to clear outdoor ground without retriggering', () => {
  let exits = 0
  for (let sample = 1; sample <= 80; sample++) {
    const seed = sample / 81, settings = settingsFor(seed)
    const layout = structureLayout(sample % 9 - 4, Math.floor(sample / 9) - 4, settings, seed)
    if (!layout) continue
    const threshold = courtyardExitForLayout(layout)
    assert.ok(threshold)
    const origin = worldPoint(layout, threshold)
    assert.equal(isPositionBlocked(origin, settings, seed), false)
    const destination = portalDestinationAt(origin, settings, seed)
    assert.equal(destination?.kind, 'courtyard-exit')
    const y = terrainHeightAt(destination.x, destination.z, settings, seed) + 1.82
    assert.ok(y > settings.water.level + 1.82)
    assert.equal(isPositionBlocked({ ...destination, y }, settings, seed), false)
    assert.equal(portalDestinationAt({ ...destination, y }, settings, seed), null)
    exits++
  }
  assert.ok(exits > 30)
})
