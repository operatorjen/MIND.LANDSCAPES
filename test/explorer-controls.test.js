import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import * as THREE from '../vendor/three/three.module.min.js'
import { deriveSettings } from '../src/world/world-state.js'
import { structureLayout, undergroundPathAt, portalDestinationAt } from '../src/world/spatial-layout.js'

const source = (await readFile(new URL('../src/input/explorer-controls.js', import.meta.url), 'utf8'))
  .replace("'three'", JSON.stringify(new URL('../vendor/three/three.module.min.js', import.meta.url).href))
  .replace("'../config/navigation.js'", JSON.stringify(new URL('../src/config/navigation.js', import.meta.url).href))
  .replace("'../world/spatial-queries.js'", JSON.stringify(new URL('../src/world/spatial-queries.js', import.meta.url).href))
const { ExplorerControls } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('stationary controls reuse probes while updating height and changed worlds', () => {
  const previousWindow = globalThis.window
  globalThis.window = new EventTarget()
  const settings = deriveSettings([])
  const camera = new THREE.PerspectiveCamera()
  const controls = new ExplorerControls(new EventTarget(), camera, () => settings, () => 0.314159)
  try {
    controls.update(1 / 60)
    const origin = camera.position.clone()
    const originalRemember = controls.spatial.remember.bind(controls.spatial)
    let misses = 0
    controls.spatial.remember = (group, key, compute) => originalRemember(group, key, () => { if (group !== 'portal') misses++; return compute() })
    camera.position.y += 2
    controls.update(1 / 60)
    assert.equal(misses, 0)
    assert.equal(camera.position.x, origin.x)
    assert.equal(camera.position.z, origin.z)
    assert.ok(camera.position.y < origin.y + 2)
    settings.water.level += 5
    controls.update(1 / 60)
    assert.ok(misses > 0)
    assert.ok(camera.position.y >= settings.water.level + 1.58)
  } finally {
    controls.dispose()
    globalThis.window = previousWindow
  }
})

test('stationary controls still traverse a portal when its cooldown expires', () => {
  const previousWindow = globalThis.window
  globalThis.window = new EventTarget()
  const settings = deriveSettings([])
  settings.water.level = -2.5
  settings.generation.structures = 2
  settings.generation.mechanicalIntensity = 1
  settings.generation.ritualIntensity = 1
  const seed = 0.314159
  const camera = new THREE.PerspectiveCamera()
  const controls = new ExplorerControls(new EventTarget(), camera, () => settings, () => seed)
  try {
    const layout = structureLayout(-3, -3, settings, seed)
    const portal = undergroundPathAt(layout, 1)
    camera.position.set(
      layout.centerX + Math.cos(layout.angle) * portal.x - Math.sin(layout.angle) * portal.z,
      layout.ground - 2,
      layout.centerZ + Math.sin(layout.angle) * portal.x + Math.cos(layout.angle) * portal.z
    )
    const destination = portalDestinationAt(camera.position, settings, seed)
    assert.ok(destination)
    controls.portalCooldown = 0.02
    controls.update(0.01)
    assert.notEqual(camera.position.x, destination.x)
    controls.update(0.02)
    assert.notEqual(camera.position.x, destination.x)
    controls.update(0.35)
    assert.ok(controls.portalGlow > 0.5)
    assert.notEqual(camera.position.x, destination.x)
    controls.update(0.31)
    assert.equal(camera.position.x, destination.x)
    assert.equal(camera.position.z, destination.z)
    assert.ok(controls.portalGlow > 0.98)
    controls.update(0.71)
    assert.equal(controls.portalGlow, 0)
    assert.equal(controls.portalTransition, null)
  } finally {
    controls.dispose()
    globalThis.window = previousWindow
  }
})

test('walk and sprint through generated corners without recovery or changing eye height', async () => {
  const { mazeForLayout } = await import('../src/world/maze.js')
  const { isPositionBlocked } = await import('../src/world/spatial-layout.js')
  const previousWindow = globalThis.window
  globalThis.window = new EventTarget()
  try {
    for (const [seed, delta, sprint] of [0.314159, 0.731, 0.527].flatMap(seed => [[seed, 1 / 60, false], [seed, 1 / 30, false], [seed, 0.05, true]])) {
      const settings = deriveSettings([])
      settings.water.level = -2.5
      settings.generation.structures = 2
      settings.generation.mechanicalIntensity = 1
      settings.generation.ritualIntensity = 1
      let layout
      for (let x = -3; x <= 3 && !layout; x++) layout = structureLayout(x, -3, settings, seed)
      assert.ok(layout)
      const maze = mazeForLayout(layout)
      const world = point => new THREE.Vector3(
        layout.centerX + Math.cos(layout.angle) * point.x - Math.sin(layout.angle) * point.z,
        layout.ground - 5.6 + 1.82,
        layout.centerZ + Math.sin(layout.angle) * point.x + Math.cos(layout.angle) * point.z
      )
      const camera = new THREE.PerspectiveCamera()
      const controls = new ExplorerControls(new EventTarget(), camera, () => settings, () => seed)
      try {
        camera.position.copy(world(maze.nodes[maze.route[1]]))
        controls.keys.add('KeyW')
        if (sprint) controls.keys.add('ShiftLeft')
        controls.portalCooldown = 100
        let recoveries = 0
        const escape = controls.escapeCollision.bind(controls)
        controls.escapeCollision = (...args) => {
          const before = camera.position.clone()
          escape(...args)
          if (camera.position.distanceTo(before) > 0.001) recoveries++
        }
        for (const id of maze.route.slice(2, 10)) {
          const target = world(maze.nodes[id])
          let arrived = false
          for (let frame = 0; frame < 300; frame++) {
            const distance = Math.hypot(target.x - camera.position.x, target.z - camera.position.z)
            if (distance < (sprint ? 0.4 : 0.12)) { arrived = true; break }
            controls.yaw = Math.atan2(-(target.x - camera.position.x), -(target.z - camera.position.z))
            controls.update(delta)
            assert.equal(isPositionBlocked(camera.position, settings, seed, 0.3), false)
            assert.ok(Math.abs(camera.position.y - target.y) < 0.001, 'Eye height changed inside the maze')
          }
          assert.ok(arrived, `Stuck at room ${id}, delta ${delta}, sprint ${sprint}; distance ${camera.position.distanceTo(target)}; velocity ${controls.velocity.toArray()}`)
        }
        assert.equal(recoveries, 0)
      } finally { controls.dispose() }
    }
  } finally { globalThis.window = previousWindow }
})

test('slide along a rotated hallway wall and reject probes into the upper floor', async () => {
  const { mazeForLayout } = await import('../src/world/maze.js')
  const previousWindow = globalThis.window
  globalThis.window = new EventTarget()
  const settings = deriveSettings([])
  settings.water.level = -2.5
  settings.generation.structures = 2
  settings.generation.mechanicalIntensity = 1
  settings.generation.ritualIntensity = 1
  const seed = 0.314159, layout = structureLayout(-3, -3, settings, seed)
  const maze = mazeForLayout(layout)
  const from = maze.nodes[maze.route[1]], to = maze.nodes[maze.route[2]]
  const world = (x, z) => ({ x: layout.centerX + Math.cos(layout.angle) * x - Math.sin(layout.angle) * z,
    z: layout.centerZ + Math.sin(layout.angle) * x + Math.cos(layout.angle) * z })
  const start = world(from.x + 0.48, from.z + (to.z - from.z) * 0.45)
  const camera = new THREE.PerspectiveCamera()
  const controls = new ExplorerControls(new EventTarget(), camera, () => settings, () => seed)
  try {
    camera.position.set(start.x, layout.ground - 3.78, start.z)
    const wall = world(from.x + 1.4, from.z + (to.z - from.z) * 0.5)
    assert.equal(controls.isBlockedAt(wall.x, wall.z, settings, seed), true)
    const heading = world(from.x + 0.5, from.z - Math.sqrt(0.75))
    const origin = world(from.x, from.z)
    controls.yaw = Math.atan2(-(heading.x - origin.x), -(heading.z - origin.z))
    controls.keys.add('KeyW')
    controls.portalCooldown = 100
    for (let frame = 0; frame < 40; frame++) controls.update(1 / 60)
    const movementX = camera.position.x - start.x, movementZ = camera.position.z - start.z
    const alongHall = Math.sin(layout.angle) * movementX - Math.cos(layout.angle) * movementZ
    assert.ok(alongHall > 1.1, `Wall sliding stalled after ${alongHall} meters`)
    assert.ok(Math.abs(camera.position.y - (layout.ground - 3.78)) < 0.001)
  } finally {
    controls.dispose()
    globalThis.window = previousWindow
  }
})

test('wet-site stairs can be descended and climbed back out across building rotations', async () => {
  const { mazeForLayout } = await import('../src/world/maze.js')
  const previousWindow = globalThis.window
  globalThis.window = new EventTarget()
  const settings = deriveSettings([])
  settings.generation.structures = 2
  settings.generation.mechanicalIntensity = 1
  settings.generation.ritualIntensity = 1
  const rotations = new Set()
  let checked = 0
  try {
    for (const seed of [0.314159, 0.731, 0.527]) {
      for (let x = -12; x <= 12; x++) {
        const layout = structureLayout(x, -3, settings, seed)
        if (!layout || layout.ground - 5.6 >= settings.water.level) continue
        const camera = new THREE.PerspectiveCamera()
        const controls = new ExplorerControls(new EventTarget(), camera, () => settings, () => seed)
        const world = (x, z) => ({x: layout.centerX + Math.cos(layout.angle) * x - Math.sin(layout.angle) * z,
          z: layout.centerZ + Math.sin(layout.angle) * x + Math.cos(layout.angle) * z})
        const stairX = (layout.variant > 0.5 ? 1 : -1) * layout.width * 0.22
        const top = world(stairX, layout.depth * 0.2 + 0.3)
        const bottom = world(stairX, -layout.depth * 0.14 - 0.5)
        const entry = mazeForLayout(layout).entry
        const room = mazeForLayout(layout).nodes[entry]
        try {
          camera.position.set(top.x, layout.ground + 1.82, top.z)
          controls.keys.add('KeyW')
          controls.portalCooldown = 1000
          for (const target of [bottom, world(room.x, room.z), bottom, top]) {
            let arrived = false
            for (let frame = 0; frame < 600; frame++) {
              if (Math.hypot(target.x - camera.position.x, target.z - camera.position.z) < 0.1) { arrived = true; break }
              controls.yaw = Math.atan2(-(target.x - camera.position.x), -(target.z - camera.position.z))
              controls.update(1 / 60)
            }
            assert.ok(arrived, `Stair route blocked: seed ${seed}, cell ${x}, target ${JSON.stringify(target)}`)
          }
          assert.ok(camera.position.y >= layout.ground + 1.8, 'Did not return to the upper floor')
          rotations.add(Math.floor(layout.variant * 4))
          checked++
        } finally { controls.dispose() }
      }
    }
    assert.ok(checked >= 8, `Only checked ${checked} wet-site buildings`)
    assert.equal(rotations.size, 4)
  } finally { globalThis.window = previousWindow }
})
