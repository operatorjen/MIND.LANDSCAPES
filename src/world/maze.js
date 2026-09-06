import { MAZE_HALL_HALF_WIDTH, MAZE_ROOM_MIN_HALF_WIDTH } from '../config/navigation.js'
export { MAZE_HALL_HALF_WIDTH } from '../config/navigation.js'
export const MAZE_VERSION = 1
export const MAZE_SIZE = 5
const DIRECTIONS = [
  { dx: 1, dz: 0, bit: 1, opposite: 2 },
  { dx: -1, dz: 0, bit: 2, opposite: 1 },
  { dx: 0, dz: 1, bit: 4, opposite: 8 },
  { dx: 0, dz: -1, bit: 8, opposite: 4 }
]
const layouts = new Map()
const layoutObjects = new WeakMap()

export function hashMaze(value) {
  let hash = 2166136261
  for (const character of String(value)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return hash >>> 0
}

export function mazeRecipe(entries, worldSeed) {
  const sources = entries.map(entry => JSON.stringify({ hash: entry.source?.hash || '', contribution: entry.contribution || {} })).sort()
  const fingerprint = hashMaze(sources.join('|'))
  const contributions = sources.map(source => JSON.parse(source).contribution)
  const mean = (name) => entries.length ? contributions.reduce((sum, contribution) => sum + (Number(contribution.generation?.[name]) || 0), 0) / entries.length : 0.3
  return {
    version: MAZE_VERSION,
    seed: hashMaze(`${worldSeed}:${fingerprint}:maze-v1`),
    fingerprint,
    turnBias: clamp(0.5 + mean('psychedelicIntensity') * 0.2 + mean('abandonedInteriors') * 0.12 - mean('mechanicalIntensity') * 0.12, 0.25, 0.92),
    loops: clamp(0.04 + mean('ritualIntensity') * 0.08 + mean('psychedelicIntensity') * 0.08, 0.04, 0.3),
    rooms: clamp(0.15 + mean('ornateInteriors') * 0.28 + mean('sandyInteriors') * 0.15, 0.15, 0.85),
    reach: Math.round(clamp(4 + mean('psychedelicIntensity') * 3 + mean('abandonedInteriors') * 2, 4, 12))
  }
}

export function mazeForLayout(layout) {
  if (layoutObjects.has(layout)) return layoutObjects.get(layout)
  const recipe = layout.mazeRecipe
  const key = `${JSON.stringify(recipe)}:${layout.cellX},${layout.cellZ}:${layout.width},${layout.depth},${layout.variant}`
  if (layouts.has(key)) {
    const maze = layouts.get(key)
    layoutObjects.set(layout, maze)
    return maze
  }
  const random = randomSource(hashMaze(`${recipe.seed}:${layout.cellX},${layout.cellZ}`))
  const side = layout.variant > 0.5 ? 1 : -1
  const stepX = layout.width * 0.17
  const startZ = -layout.depth * 0.14 - 1.2
  const endZ = -layout.depth * 0.78
  const stepZ = (startZ - endZ) / (MAZE_SIZE - 1)
  const entry = side > 0 ? 3 : 1
  const nodes = Array.from({ length: MAZE_SIZE ** 2 }, (_, id) => ({
    id, mask: 0,
    x: (id % MAZE_SIZE - 2) * stepX + side * layout.width * 0.05,
    z: startZ - Math.floor(id / MAZE_SIZE) * stepZ,
    room: Math.round((0.28 + (random() < recipe.rooms ? random() * 0.15 : 0)) * 255),
    portal: 0
  }))
  const visited = new Set([entry])
  const stack = [{ id: entry, direction: -1 }]
  while (stack.length) {
    const current = stack.at(-1)
    let choices = neighbors(current.id).filter(({ id }) => !visited.has(id))
    if (!choices.length) { stack.pop(); continue }
    const turns = choices.filter(({ direction }) => direction !== current.direction)
    if (turns.length && random() < recipe.turnBias) choices = turns
    const next = choices[Math.floor(random() * choices.length)]
    connect(nodes, current.id, next)
    visited.add(next.id)
    stack.push({ id: next.id, direction: next.direction })
  }
  for (const node of nodes) {
    for (const next of neighbors(node.id)) {
      if (next.id > node.id && !(node.mask & DIRECTIONS[next.direction].bit) && random() < recipe.loops) connect(nodes, node.id, next)
    }
  }
  const paths = pathsFrom(nodes, entry)
  const distant = nodes.filter(node => paths[node.id].length >= 5).sort((a, b) => paths[b.id].length - paths[a.id].length || a.id - b.id)
  const first = distant[0]
  const second = distant.find(node => Math.abs(node.x - first.x) + Math.abs(node.z - first.z) > stepX + stepZ) || distant[1]
  const portals = [first, second].filter(Boolean)
  portals.forEach((node, index) => { node.portal = index + 1 })
  const maze = { nodes, portals, entry, stepX, stepZ, startZ, paths, route: paths[first.id], halfWidth: MAZE_HALL_HALF_WIDTH }
  if (layouts.size >= 256) layouts.delete(layouts.keys().next().value)
  layouts.set(key, maze)
  layoutObjects.set(layout, maze)
  return maze
}

export function mazeDistance(local, layout) {
  if (Math.abs(local.x) > layout.width * 0.5 + 2 || local.z > -layout.depth * 0.14 + 0.2 || local.z < -layout.depth * 0.78 - 2.5) return 1000
  const maze = mazeForLayout(layout)
  const side = layout.variant > 0.5 ? 1 : -1
  const column = clamp(Math.round((local.x - side * layout.width * 0.05) / maze.stepX + 2), 0, 4)
  const row = clamp(Math.round((maze.startZ - local.z) / maze.stepZ), 0, 4)
  const node = maze.nodes[row * MAZE_SIZE + column]
  const x = local.x - node.x
  const z = local.z - node.z
  const room = Math.max(MAZE_ROOM_MIN_HALF_WIDTH, Math.min(maze.stepX, maze.stepZ) * node.room / 255)
  let distance = box2(x, z, room, room)
  if (node.mask & 1) distance = Math.min(distance, box2(x - maze.stepX / 2, z, maze.stepX / 2, maze.halfWidth))
  if (node.mask & 2) distance = Math.min(distance, box2(x + maze.stepX / 2, z, maze.stepX / 2, maze.halfWidth))
  if (node.mask & 4) distance = Math.min(distance, box2(x, z - maze.stepZ / 2, maze.halfWidth, maze.stepZ / 2))
  if (node.mask & 8) distance = Math.min(distance, box2(x, z + maze.stepZ / 2, maze.halfWidth, maze.stepZ / 2))
  const stairEnd = -layout.depth * 0.14
  return Math.min(distance, box2(local.x - side * layout.width * 0.22, local.z - (stairEnd + maze.startZ) / 2, 1.45, (stairEnd - maze.startZ) / 2 + 0.2))
}

export function mazeCollisionDistance(local, layout) {
  const visibleDistance = mazeDistance(local, layout)
  if (visibleDistance >= 0) return visibleDistance
  const maze = mazeForLayout(layout)
  if (!maze.walls) maze.walls = mazeBoundary(layout, maze)
  let squared = Infinity
  for (const wall of maze.walls) {
    const along = wall.vertical ? local.z : local.x
    const across = (wall.vertical ? local.x : local.z) - wall.fixed
    const end = along - clamp(along, wall.low, wall.high)
    squared = Math.min(squared, across * across + end * end)
  }
  return -Math.sqrt(squared)
}

function mazeBoundary(layout, maze) {
  const rectangles = []
  const add = (x, z, hx, hz) => rectangles.push({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz })
  for (const node of maze.nodes) {
    const room = Math.max(MAZE_ROOM_MIN_HALF_WIDTH, Math.min(maze.stepX, maze.stepZ) * node.room / 255)
    add(node.x, node.z, room, room)
    if (node.mask & 1) add(node.x + maze.stepX / 2, node.z, maze.stepX / 2, maze.halfWidth)
    if (node.mask & 8) add(node.x, node.z - maze.stepZ / 2, maze.halfWidth, maze.stepZ / 2)
  }
  const stairEnd = -layout.depth * 0.14
  add((layout.variant > 0.5 ? 1 : -1) * layout.width * 0.22,
    (stairEnd + maze.startZ) / 2, 1.45, (stairEnd - maze.startZ) / 2 + 0.2)
  const stairStart = layout.depth * 0.2
  add((layout.variant > 0.5 ? 1 : -1) * layout.width * 0.22,
    (stairStart + stairEnd) / 2, 1.45, (stairStart - stairEnd) / 2 + 0.18)
  const walls = []
  for (const rectangle of rectangles) {
    for (const vertical of [true, false]) for (const positive of [false, true]) {
      const min = vertical ? 'x0' : 'z0', max = vertical ? 'x1' : 'z1'
      const lowKey = vertical ? 'z0' : 'x0', highKey = vertical ? 'z1' : 'x1'
      const fixed = rectangle[positive ? max : min]
      let intervals = [[rectangle[lowKey], rectangle[highKey]]]
      for (const other of rectangles) {
        if (other === rectangle) continue
        const covered = positive ? other[min] <= fixed && other[max] > fixed
          : other[min] < fixed && other[max] >= fixed
        if (!covered) continue
        intervals = intervals.flatMap(([low, high]) => {
          if (other[highKey] <= low || other[lowKey] >= high) return [[low, high]]
          const remainder = []
          if (other[lowKey] > low) remainder.push([low, other[lowKey]])
          if (other[highKey] < high) remainder.push([other[highKey], high])
          return remainder
        })
      }
      for (const [low, high] of intervals) walls.push({ vertical, fixed, low, high })
    }
  }
  return walls
}

export function mazeRouteAt(layout, progress) {
  const maze = mazeForLayout(layout)
  const points = [{ x: (layout.variant > 0.5 ? 1 : -1) * layout.width * 0.22, z: -layout.depth * 0.14 }, ...maze.route.map(id => maze.nodes[id])]
  const lengths = points.slice(1).map((point, i) => Math.hypot(point.x - points[i].x, point.z - points[i].z))
  let remaining = clamp(progress, 0, 1) * lengths.reduce((a, b) => a + b, 0)
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const amount = remaining / lengths[i]
      return { x: points[i].x + (points[i + 1].x - points[i].x) * amount, z: points[i].z + (points[i + 1].z - points[i].z) * amount }
    }
    remaining -= lengths[i]
  }
}

export function portalArrival(layout, portalIndex) {
  const maze = mazeForLayout(layout)
  const node = maze.portals[portalIndex % maze.portals.length]
  const next = neighbors(node.id).find(next => node.mask & DIRECTIONS[next.direction].bit)
  const destination = maze.nodes[next.id]
  const length = Math.hypot(destination.x - node.x, destination.z - node.z)
  const dx = (destination.x - node.x) / length
  const dz = (destination.z - node.z) / length
  return { x: node.x + dx * 1.15, z: node.z + dz * 1.15, dx, dz }
}

function neighbors(id) {
  const x = id % MAZE_SIZE, z = Math.floor(id / MAZE_SIZE)
  return DIRECTIONS.flatMap((direction, index) => {
    const nx = x + direction.dx, nz = z - direction.dz
    return nx >= 0 && nx < MAZE_SIZE && nz >= 0 && nz < MAZE_SIZE ? [{ id: nz * MAZE_SIZE + nx, direction: index }] : []
  })
}
function connect(nodes, from, next) {
  nodes[from].mask |= DIRECTIONS[next.direction].bit
  nodes[next.id].mask |= DIRECTIONS[next.direction].opposite
}
function pathsFrom(nodes, entry) {
  const paths = { [entry]: [entry] }, queue = [entry]
  for (const id of queue) for (const next of neighbors(id)) {
    if ((nodes[id].mask & DIRECTIONS[next.direction].bit) && !paths[next.id]) {
      paths[next.id] = [...paths[id], next.id]
      queue.push(next.id)
    }
  }
  return paths
}
function randomSource(seed) {
  let state = seed >>> 0
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296 }
}
function box2(x, z, hx, hz) {
  const dx = Math.abs(x) - hx, dz = Math.abs(z) - hz
  return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0)
}
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)) }
