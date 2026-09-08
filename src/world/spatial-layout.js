import { mazeRearMargin } from '../config/navigation.js'
import { mazeRecipe, mazeForLayout, mazeDistance, mazeCollisionDistance, mazeRouteAt, portalArrival, hashMaze, courtyardExitForLayout } from './maze.js'
import {
  STAIR_WIDTH,
  STRUCTURE_CELL_SIZE,
  STRUCTURE_CELL_JITTER,
  STRUCTURE_VEGETATION_CLEARANCE,
  STRUCTURE_WATER_CLEARANCE,
  STAIR_STEP_COUNT,
  TREE_CELL_SIZE,
  TREE_CELL_JITTER,
  TUNNEL_FACTOR_MAX,
  TUNNEL_FACTOR_MIN,
  UNDERGROUND_CLEARANCE,
  UNDERGROUND_DESCENT,
  VEGETATION_WATER_CLEARANCE,
  WORLD_SEED_SCALE
} from '../config/world.js'

const DOORWAY_TOLERANCE = 0.12
const NEIGHBORHOOD_RADIUS = 1
const STRUCTURE_CELL_HALF = STRUCTURE_CELL_SIZE * 0.5

export function terrainHeightAt(x, z, settings, seed, cache) {
  if (!cache) return computeTerrainHeightAt(x, z, settings, seed)
  return cache.remember('terrain', `${x},${z}`, () => computeTerrainHeightAt(x, z, settings, seed, cache))
}

function computeTerrainHeightAt(x, z, settings, seed, cache) {
  const terrainHeight = terrainBaseHeightAt(x, z, settings, seed)
  return gradeStructureGroundAt(x, z, terrainHeight, settings, seed, cache)
}

export function walkingSurfaceAt(x, z, eyeY, settings, seed, cache) {
  const floor = terrainHeightAt(x, z, settings, seed, cache)
  const cellX = Math.floor((x + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)
  const cellZ = Math.floor((z + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)
  const layout = structureLayout(cellX, cellZ, settings, seed, cache)
  if (!layout || eyeY < layout.ground + 0.1) return floor
  const local = structureLocal(x - layout.centerX, z - layout.centerZ, layout.angle)
  const stairs = undergroundLayout(layout)
  const onStairs = Math.abs(local.x - stairs.stairX) < stairs.stairWidth
    && local.z <= stairs.stairStart && local.z >= stairs.stairEnd
  return !onStairs && Math.abs(local.x) < layout.width * 0.5
    && local.z < stairs.stairEnd + 0.2 && local.z > -layout.depth * 0.78 - mazeRearMargin(layout.depth)
    ? layout.ground : floor
}

function terrainBaseHeightAt(x, z, settings, seed) {
  const shaderSeed = gpuMultiply(seed, WORLD_SEED_SCALE)
  const scale = settings.terrain.scale
  const roughness = settings.terrain.roughness
  const folds = settings.generation.folds
  const folded = foldedPoint(x, z, folds)
  let height = terrainFoundationHeightAt(x, z, settings)
  const river = Math.min(1, riverMask(x, z, settings.generation.rivers))
  const detail = (fbm(folded.x * 0.045 * scale + shaderSeed, folded.z * 0.045 * scale + shaderSeed, shaderSeed) - 0.5) * roughness * 2.6
  const ridgeNoise = fbm(folded.x * 0.018 * scale - shaderSeed * 0.3, folded.z * 0.018 * scale - shaderSeed * 0.3, shaderSeed)
  height += detail + Math.abs(ridgeNoise * 2 - 1) ** 2 * roughness * 1.2
  height += (Math.min(height, settings.water.level - 0.28) - height) * river
  const terraces = Math.min(0.28, settings.generation.terraces * 0.16)
  return mix(height, Math.floor(height * 3) / 3, terraces)
}

function terrainFoundationHeightAt(x, z, settings) {
  const scale = settings.terrain.scale
  const folded = foldedPoint(x, z, settings.generation.folds)
  const broad = Math.sin(folded.x * 0.038 * scale) * 0.8 + Math.cos(folded.z * 0.031 * scale) * 0.68
  const crossed = Math.sin((folded.x + folded.z) * 0.017 * scale) * 0.5 + Math.cos((folded.x - folded.z) * 0.023 * scale) * 0.35
  const mountainField = 0.5 + 0.5 * Math.sin(folded.x * 0.014 + Math.cos(folded.z * 0.011) * 2)
  const peaks = mountainField ** 7 * settings.generation.mountains * 7.8
  const valleyField = Math.abs(Math.sin(folded.x * 0.025 + Math.sin(folded.z * 0.012) * 2.2))
  const valleys = (1 - valleyField) ** 6 * settings.generation.valleys * 3.4
  const duneRegion = (0.5 + 0.5 * Math.sin(folded.z * 0.008 + folded.x * 0.004)) ** 3
  const duneWave = 0.5 + 0.5 * Math.sin(folded.x * 0.42 + Math.sin(folded.z * 0.06) * 2.4)
  const dunes = duneWave * duneRegion * Math.sqrt(Math.max(settings.generation.dunes, 0)) * 1.45
  const height = (broad + crossed) * settings.terrain.amplitude * 1.55 + peaks - valleys + dunes - 0.2
  const river = Math.min(1, riverMask(x, z, settings.generation.rivers))
  return mix(height, Math.min(height, settings.water.level - 0.28), river)
}

function gradeStructureGroundAt(x, z, terrainHeight, settings, seed, cache) {
  const cellX = Math.floor((x + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)
  const cellZ = Math.floor((z + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)
  const layout = structureLayout(cellX, cellZ, settings, seed, cache)
  if (!layout) return terrainHeight

  const local = structureLocal(x - layout.centerX, z - layout.centerZ, layout.angle)
  const edge = Math.max(
    Math.abs(local.x) - layout.width * 0.62 - 0.6,
    Math.abs(local.z) - layout.depth * 0.58 - 0.6
  )
  const grade = 1 - smoothstep(0, 6, edge)
  const gradedHeight = mix(terrainHeight, layout.ground, grade)
  return structureFloorHeight(local, layout, gradedHeight)
}

function structureFloorHeight(local, layout, surfaceHeight) {
  const underground = undergroundLayout(layout)

  if (Math.abs(local.x - underground.stairX) < underground.stairWidth
    && local.z <= underground.stairStart
    && local.z >= underground.stairEnd) {
    const progress = clamp((underground.stairStart - local.z) / (underground.stairStart - underground.stairEnd), 0, 1)
    const stepped = Math.floor(progress * STAIR_STEP_COUNT) / STAIR_STEP_COUNT
    surfaceHeight = Math.min(surfaceHeight, layout.ground - stepped * underground.descent)
  }

  if (Math.abs(local.x) < layout.width * 0.5 && local.z < underground.stairEnd + 0.2
    && local.z > -layout.depth * 0.78 - mazeRearMargin(layout.depth)) {
    surfaceHeight = Math.min(surfaceHeight, layout.ground - underground.descent)
  }

  return surfaceHeight
}

export function portalDestinationAt(position, settings, seed, cache) {
  const baseCellX = Math.floor((position.x + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)
  const baseCellZ = Math.floor((position.z + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)

  for (let offsetX = -NEIGHBORHOOD_RADIUS; offsetX <= NEIGHBORHOOD_RADIUS; offsetX++) {
    for (let offsetZ = -NEIGHBORHOOD_RADIUS; offsetZ <= NEIGHBORHOOD_RADIUS; offsetZ++) {
      const source = structureLayout(baseCellX + offsetX, baseCellZ + offsetZ, settings, seed, cache)
      if (!source) continue
      const local = structureLocal(position.x - source.centerX, position.z - source.centerZ, source.angle)
      if (position.y >= source.ground - 0.8 || Math.abs(local.x) > source.width * 0.5 || local.z > -source.depth * 0.14) continue
      const maze = mazeForLayout(source)
      const gardenExit = courtyardExitForLayout(source)
      if (gardenExit && Math.hypot(local.x - gardenExit.x, local.z - gardenExit.z) < 0.48
        && position.y > source.ground - 5.0 && position.y < source.ground - 2.0) {
        // A deliberate, one-way threshold; use the existing covered transition.
        for (const distance of [7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 1.2]) {
          const outside = structureWorld(0, source.depth * 0.5 + distance, source)
          const ground = terrainHeightAt(outside.x, outside.z, settings, seed, cache)
          if (ground < settings.water.level + 0.3
            || isPositionBlocked({ ...outside, y: ground + 1.82 }, settings, seed, 0.34, cache)
            || isUndergroundAt(outside.x, outside.z, settings, seed, cache)) continue
          return { x: outside.x, z: outside.z, yaw: Math.atan2(-(outside.x - source.centerX), -(outside.z - source.centerZ)), rotation: 0, kind: 'courtyard-exit' }
        }
      }
      const portalIndex = maze.portals.findIndex(node => Math.hypot(local.x - node.x, local.z - node.z) < 0.68)
      if (portalIndex < 0) continue
      const destination = findPortalDestination(source, portalIndex, settings, seed, cache)
      if (!destination) return null
      const arrivalIndex = destination === source ? portalIndex + 1 : hashMaze(`${source.mazeRecipe.seed}:${source.cellX},${source.cellZ}:${portalIndex}:arrival`)
      const arrival = portalArrival(destination, arrivalIndex)
      const exit = structureWorld(arrival.x, arrival.z, destination)
      const worldDirection = structureWorld(arrival.x + arrival.dx, arrival.z + arrival.dz, destination)
      return {
        x: exit.x,
        z: exit.z,
        yaw: Math.atan2(-(worldDirection.x - exit.x), -(worldDirection.z - exit.z)),
        rotation: destination.angle - source.angle + Math.PI
      }
    }
  }

  return null
}

export function isUndergroundAt(x, z, settings, seed, cache) {
  const baseCellX = Math.floor((x + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)
  const baseCellZ = Math.floor((z + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)

  for (let offsetX = -NEIGHBORHOOD_RADIUS; offsetX <= NEIGHBORHOOD_RADIUS; offsetX++) {
    for (let offsetZ = -NEIGHBORHOOD_RADIUS; offsetZ <= NEIGHBORHOOD_RADIUS; offsetZ++) {
      const layout = structureLayout(baseCellX + offsetX, baseCellZ + offsetZ, settings, seed, cache)
      if (!layout) continue
      const local = structureLocal(x - layout.centerX, z - layout.centerZ, layout.angle)
      const underground = undergroundLayout(layout)
      const onStairs = Math.abs(local.x - underground.stairX) < underground.stairWidth
        && local.z < underground.stairStart - 0.05
        && local.z >= underground.stairEnd
      const inChamber = local.z < underground.stairEnd + 0.2 && mazeDistance(local, layout) < 0
      if (onStairs || inChamber) return true
    }
  }

  return false
}

function findPortalDestination(source, portalIndex, settings, seed, cache) {
  const identity = `${source.mazeRecipe.seed}:${source.cellX},${source.cellZ}:${portalIndex}`
  const reach = source.mazeRecipe.reach
  for (let attempt = 0; attempt < 96; attempt++) {
    const x = hashMaze(`${identity}:${attempt}:x`) % (reach * 2 + 1) - reach
    const z = hashMaze(`${identity}:${attempt}:z`) % (reach * 2 + 1) - reach
    if (Math.max(Math.abs(x), Math.abs(z)) < 2) continue
    const destination = structureLayout(source.cellX + x, source.cellZ + z, settings, seed, cache)
    if (destination) return destination
  }
  for (let x = -reach; x <= reach; x++) for (let z = -reach; z <= reach; z++) {
    if (x === 0 && z === 0) continue
    const destination = structureLayout(source.cellX + x, source.cellZ + z, settings, seed, cache)
    if (destination) return destination
  }
  return source
}

function undergroundLayout(layout) {
  const stairEnd = -layout.depth * 0.14
  return {
    stairX: (layout.variant > 0.5 ? 1 : -1) * layout.width * 0.22,
    stairStart: layout.depth * 0.2,
    stairEnd,
    stairWidth: STAIR_WIDTH,
    descent: UNDERGROUND_DESCENT
  }
}

export function undergroundPathAt(layout, progress) {
  return mazeRouteAt(layout, progress)
}

export function isPositionBlocked(position, settings, seed, radius = 0.34, cache) {
  return isBlockedByStructure(position, settings, seed, radius, cache) || isBlockedByTree(position, settings, seed, radius, cache)
}

function isBlockedByTree(position, settings, seed, radius, cache) {
  const shaderSeed = gpuMultiply(seed, WORLD_SEED_SCALE)
  const baseCellX = Math.floor((position.x + TREE_CELL_SIZE * 0.5) / TREE_CELL_SIZE)
  const baseCellZ = Math.floor((position.z + TREE_CELL_SIZE * 0.5) / TREE_CELL_SIZE)

  for (let offsetX = -NEIGHBORHOOD_RADIUS; offsetX <= NEIGHBORHOOD_RADIUS; offsetX++) {
    for (let offsetZ = -NEIGHBORHOOD_RADIUS; offsetZ <= NEIGHBORHOOD_RADIUS; offsetZ++) {
      const cellX = baseCellX + offsetX
      const cellZ = baseCellZ + offsetZ
      const center = treeCenter(cellX, cellZ, shaderSeed)
      const vegetation = vegetationAt(cellX, cellZ, center, settings, shaderSeed, seed, cache)
      if (!vegetation) continue

      const ground = vegetation.ground
      const { age, kind, species } = vegetation
      const vertical = position.y - ground

      if (kind === 'succulent') {
        const subtype = hash21(cellX + 93.1, cellZ + 93.1, shaderSeed)
        const height = subtype < 0.56 ? mix(2.1, 6.4, hash21(cellX + 96.4, cellZ + 96.4, shaderSeed)) : mix(0.9, 1.8, age)
        if (vertical < -0.2 || vertical > height) continue
        const plantRadius = subtype < 0.56
          ? mix(0.2, 0.42, hash21(cellX + 98.7, cellZ + 98.7, shaderSeed))
          : mix(0.42, 0.82, age)
        if (Math.hypot(position.x - center.x, position.z - center.z) < plantRadius + radius) return true
        continue
      }

      if (kind === 'shrub') {
        const height = mix(1.25, 3.15, age)
        if (vertical < -0.2 || vertical > height) continue
        if (Math.hypot(position.x - center.x, position.z - center.z) < 0.22 * age + radius) return true
        continue
      }

      let height = mix(4, 8.2, age)
      if (species < 0.24) height = mix(7.4, 12.8, age)
      else if (species < 0.5) height = mix(4.2, 7.7, age)
      else if (species < 0.88) height = mix(5.6, 10.4, age)
      else height = mix(4.8, 8.8, age)

      if (vertical < -0.4 || vertical > height) continue
      const baseRadius = species < 0.24 ? 0.3 : species < 0.5 ? 0.46 : species < 0.88 ? 0.62 : 0.32
      const trunkRadius = mix(baseRadius * age * 1.4, 0.11, Math.min(1, Math.max(0, vertical / height))) + radius
      if (Math.hypot(position.x - center.x, position.z - center.z) < trunkRadius) return true
    }
  }

  return false
}

function vegetationAt(cellX, cellZ, center, settings, shaderSeed, seed, cache) {
  if (!cache) return computeVegetationAt(cellX, cellZ, center, settings, shaderSeed, seed)
  return cache.remember('vegetation', `${cellX},${cellZ}`, () => computeVegetationAt(cellX, cellZ, center, settings, shaderSeed, seed, cache))
}

function computeVegetationAt(cellX, cellZ, center, settings, shaderSeed, seed, cache) {
  const random = hash21(cellX + shaderSeed * 0.07, cellZ + shaderSeed * 0.07, shaderSeed)
  const moisture = Math.exp(-Math.abs(center.x - riverCenter(center.z)) * 0.08)
  const cluster = noise21(center.x * 0.018 + shaderSeed * 0.031, center.z * 0.018 + shaderSeed * 0.031, shaderSeed)
  const grove = smoothstep(0.36, 0.72, cluster + moisture * 0.18)
  const duneBiome = duneBiomeAt(center.x, center.z, settings, shaderSeed)
  const meadowBiome = meadowBiomeAt(center.x, center.z, duneBiome, settings, shaderSeed)
  const treeWeight = settings.generation.forests * (0.1 + grove * 1.2 + moisture * 0.28) * (1 - duneBiome * 0.74)
  const succulentWeight = settings.generation.succulents * duneBiome * 1.5
  const shrubWeight = settings.generation.shrubs * meadowBiome * (0.82 + moisture * 0.3)
  const vegetationWeight = treeWeight + succulentWeight + shrubWeight
  const chance = Math.min(0.88, vegetationWeight * 0.72)
  if (random > chance) return null

  const structureCellX = Math.floor((center.x + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)
  const structureCellZ = Math.floor((center.z + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)
  const structure = structureLayout(structureCellX, structureCellZ, settings, seed, cache)
  if (structure && Math.hypot(center.x - structure.centerX, center.z - structure.centerZ) < STRUCTURE_VEGETATION_CLEARANCE) return null
  const ground = terrainHeightAt(center.x, center.z, settings, seed, cache)
  if (ground < settings.water.level + VEGETATION_WATER_CLEARANCE) return null

  const kindSelector = hash21(cellX + 84.3, cellZ + 84.3, shaderSeed) * Math.max(vegetationWeight, 0.001)
  const speciesRoll = hash21(cellX + 42.6, cellZ + 42.6, shaderSeed)
  return {
    ground,
    age: mix(0.72, 1.24, hash21(cellX + 8.7, cellZ + 8.7, shaderSeed)),
    kind: kindSelector < succulentWeight ? 'succulent' : kindSelector < succulentWeight + shrubWeight ? 'shrub' : 'tree',
    species: meadowBiome > 0.45 ? mix(0.52, 0.86, speciesRoll) : speciesRoll
  }
}

function duneBiomeAt(x, z, settings, shaderSeed) {
  const folded = foldedPoint(x, z, settings.generation.folds)
  const macroBiome = fbm(folded.x * 0.011 + shaderSeed * 0.19, folded.z * 0.011 + shaderSeed * 0.19, shaderSeed)
  const duneField = (0.5 + 0.5 * Math.sin(folded.z * 0.008 + folded.x * 0.004)) ** 3
  const riverDistance = Math.abs(x - riverCenter(z))
  const moisture = Math.exp(-riverDistance * riverDistance * 0.035)
  const duneBias = clamp(0.16 + settings.generation.dunes * 0.62 + Math.max(settings.atmosphere.warmth, 0) * 0.14, 0, 1.25)
  return smoothstep(0.5, 0.78, duneField * 0.64 + macroBiome * 0.32 + duneBias * 0.35 - moisture * 0.28)
}

function meadowBiomeAt(x, z, duneBiome, settings, shaderSeed) {
  const folded = foldedPoint(x, z, settings.generation.folds)
  const meadowField = fbm(folded.x * 0.019 - shaderSeed * 0.27, folded.z * 0.019 - shaderSeed * 0.27, shaderSeed)
  const riverDistance = Math.abs(x - riverCenter(z))
  const moisture = Math.exp(-riverDistance * riverDistance * 0.035)
  return smoothstep(0.37, 0.72, meadowField + moisture * 0.24 + settings.generation.grasses * 0.16 - duneBiome * 0.58)
}

function isBlockedByStructure(position, settings, seed, radius, cache) {
  const baseCellX = Math.floor((position.x + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)
  const baseCellZ = Math.floor((position.z + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)

  for (let offsetX = -NEIGHBORHOOD_RADIUS; offsetX <= NEIGHBORHOOD_RADIUS; offsetX++) {
    for (let offsetZ = -NEIGHBORHOOD_RADIUS; offsetZ <= NEIGHBORHOOD_RADIUS; offsetZ++) {
      const layout = structureLayout(baseCellX + offsetX, baseCellZ + offsetZ, settings, seed, cache)
      if (!layout) continue
      const local = structureLocal(position.x - layout.centerX, position.z - layout.centerZ, layout.angle)
      if (isBlockedByUnderground(local, position.y, layout, radius)) return true
      const elevation = position.y - layout.ground + 0.5
      if (elevation < -radius || elevation > layout.height + radius) continue

      const outerX = layout.width * 0.5
      const outerZ = layout.depth * 0.5
      const insideOuter = Math.abs(local.x) < outerX + radius && Math.abs(local.z) < outerZ + radius
      const insideNave = Math.abs(local.x) < outerX - layout.wall - radius && Math.abs(local.z) < outerZ - layout.wall - radius
      const belowDoor = elevation < layout.doorHeight - radius
      const passageDepth = layout.wall * 2 + radius + DOORWAY_TOLERANCE
      const endDoor = belowDoor
        && Math.abs(local.x) < layout.doorWidth * 0.5 - radius + DOORWAY_TOLERANCE
        && Math.abs(Math.abs(local.z) - outerZ) < passageDepth
      const sideDoor = belowDoor
        && Math.abs(local.x - outerX) < passageDepth
        && Math.abs(local.z) < layout.doorWidth * 0.44 - radius + DOORWAY_TOLERANCE
      if (insideOuter && !insideNave && !endDoor && !sideDoor) return true

      const pylonX = outerX + layout.pylonX * 0.55
      const pylonZ = layout.depth * 0.27
      if (elevation < layout.height * 0.72 + radius) {
        for (const x of [-pylonX, pylonX]) {
          for (const z of [-pylonZ, pylonZ]) {
            if (insideRectangle(local.x, local.z, x, z, layout.pylonX, layout.pylonZ, radius)) return true
          }
        }
      }

      if (elevation < layout.height * 0.48 + radius) {
        const approachZ = outerZ + 3.2
        if (insideRectangle(local.x, local.z, -layout.doorWidth * 0.9, approachZ, 0.58, 2.6, radius)) return true
        if (insideRectangle(local.x, local.z, layout.doorWidth * 0.9, approachZ, 0.58, 2.6, radius)) return true
      }
    }
  }

  return false
}

export function mazeWallNormalAt(position, settings, seed, cache) {
  const cellX = Math.floor((position.x + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)
  const cellZ = Math.floor((position.z + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)
  const layout = structureLayout(cellX, cellZ, settings, seed, cache)
  if (!layout || position.y >= layout.ground - 0.8) return null
  const local = structureLocal(position.x - layout.centerX, position.z - layout.centerZ, layout.angle)
  const distance = mazeCollisionDistance(local, layout)
  if (distance >= 999) return null
  const epsilon = 0.025
  const dx = mazeCollisionDistance({ x: local.x + epsilon, z: local.z }, layout)
    - mazeCollisionDistance({ x: local.x - epsilon, z: local.z }, layout)
  const dz = mazeCollisionDistance({ x: local.x, z: local.z + epsilon }, layout)
    - mazeCollisionDistance({ x: local.x, z: local.z - epsilon }, layout)
  const length = Math.hypot(dx, dz)
  const cosine = Math.cos(layout.angle), sine = Math.sin(layout.angle)
  return {
    x: length < 0.00001 ? 0 : (cosine * dx - sine * dz) / length,
    z: length < 0.00001 ? 0 : (sine * dx + cosine * dz) / length,
    cosine,
    sine
  }
}

function isBlockedByUnderground(local, worldY, layout, radius) {
  const underground = undergroundLayout(layout)
  const vertical = worldY - (layout.ground - underground.descent)
  if (vertical < -radius || vertical > UNDERGROUND_CLEARANCE + radius) return false

  const stairSpan = local.z <= underground.stairStart + radius
    && local.z >= underground.stairEnd - radius
  const insideStairPassage = Math.abs(local.x - underground.stairX) < underground.stairWidth
  if (stairSpan && insideStairPassage) return false
  const stairWall = Math.abs(local.x - underground.stairX) >= underground.stairWidth - radius
    && Math.abs(local.x - underground.stairX) < underground.stairWidth + layout.wall + radius
  if (stairSpan && stairWall && local.z > underground.stairEnd + 0.2) return true
  if (local.z > underground.stairEnd + 0.2 || local.z < -layout.depth * 0.78 - mazeRearMargin(layout.depth)
    || Math.abs(local.x) > layout.width * 0.5 + radius) return false
  return mazeCollisionDistance(local, layout) > -radius

}

export function structureLayout(cellX, cellZ, settings, seed, cache) {
  if (!cache) return computeStructureLayout(cellX, cellZ, settings, seed)
  return cache.remember('structures', `${cellX},${cellZ}`, () => computeStructureLayout(cellX, cellZ, settings, seed, cache))
}

function computeStructureLayout(cellX, cellZ, settings, seed, cache) {
  const shaderSeed = gpuMultiply(seed, WORLD_SEED_SCALE)
  const presence = Math.min(0.82, 0.1 + settings.generation.structures * 0.68 + settings.generation.mechanicalIntensity * 0.16 + settings.generation.ritualIntensity * 0.12)
  const randomX = gpuAdd(cellX, gpuMultiply(shaderSeed, 0.043))
  const randomZ = gpuAdd(cellZ, gpuMultiply(shaderSeed, 0.043))
  const random = hash21(randomX, randomZ, shaderSeed)
  if (random > presence) return null

  const centerX = cellX * STRUCTURE_CELL_SIZE + (hash21(gpuAdd(cellX, 31.4), gpuAdd(cellZ, 31.4), shaderSeed) - 0.5) * STRUCTURE_CELL_JITTER
  const centerZ = cellZ * STRUCTURE_CELL_SIZE + (hash21(gpuAdd(cellX, 68.1), gpuAdd(cellZ, 68.1), shaderSeed) - 0.5) * STRUCTURE_CELL_JITTER
  const ground = terrainFoundationHeightAt(centerX, centerZ, settings)
  if (ground < settings.water.level + STRUCTURE_WATER_CLEARANCE) return null

  const variant = hash21(gpuAdd(cellX, 17.8), gpuAdd(cellZ, 17.8), shaderSeed)
  const widthExpression = clamp(settings.generation.mechanicalIntensity * 0.55 + settings.generation.structures * 0.2, 0, 1)
  const depthExpression = clamp(settings.generation.ritualIntensity * 0.4 + settings.generation.structures * 0.24, 0, 1)
  const heightExpression = clamp(settings.generation.structures * 0.28 + settings.generation.mechanicalIntensity * 0.22 + settings.generation.ritualIntensity * 0.16, 0, 1)
  const styleProfile = structureStyleAt(cellX, cellZ, settings, shaderSeed)
  const width = mix(15, 23, hash21(gpuAdd(cellX, 4.9), gpuAdd(cellZ, 4.9), shaderSeed)) * mix(0.9, 1.18, widthExpression)
  const depth = mix(28, 44, hash21(gpuAdd(cellX, 11.3), gpuAdd(cellZ, 11.3), shaderSeed)) * mix(0.9, 1.2, depthExpression)
  const height = mix(16, 29, hash21(gpuAdd(cellX, 24.7), gpuAdd(cellZ, 24.7), shaderSeed)) * mix(0.88, 1.32, heightExpression)
  const wall = mix(1.05, 1.75, variant) * mix(0.92, 1.18, clamp(settings.generation.mechanicalIntensity * 0.38, 0, 1))
  const doorWidth = mix(3, 4.6, clamp(settings.generation.ritualIntensity * 0.58 + variant * 0.32, 0, 1))
  return {
    cellX,
    cellZ,
    mazeRecipe: settings.maze || mazeRecipe([], seed),
    centerX,
    centerZ,
    ground,
    variant,
    style: styleProfile.style,
    tunnelFactor: styleProfile.tunnelFactor,
    width,
    depth,
    height,
    wall,
    doorWidth,
    doorHeight: mix(3.8, 5.4, variant),
    pylonX: mix(1.1, 1.9, variant),
    pylonZ: mix(2.2, 3.8, variant),
    angle: (Math.floor(variant * 4) + 0.5) * Math.PI * 0.5
  }
}

function structureStyleAt(cellX, cellZ, settings, shaderSeed) {
  const styleRoll = fract(gpuAdd(
    gpuAdd(
      gpuAdd(hash21(gpuAdd(cellX, 155.4), gpuAdd(cellZ, 155.4), shaderSeed), gpuMultiply(settings.generation.mechanicalIntensity, 0.21)),
      gpuMultiply(settings.generation.ritualIntensity, 0.33)
    ),
    gpuAdd(gpuMultiply(settings.generation.ornateInteriors, 0.17), gpuMultiply(settings.generation.abandonedInteriors, 0.13))
  ))
  const tunnelRoll = fract(gpuAdd(
    gpuAdd(hash21(gpuAdd(cellX, 233.1), gpuAdd(cellZ, 233.1), shaderSeed), gpuMultiply(settings.generation.sandyInteriors, 0.16)),
    gpuAdd(gpuMultiply(settings.generation.ornateInteriors, 0.24), gpuMultiply(settings.generation.psychedelicIntensity, 0.18))
  ))

  return {
    style: Math.floor(styleRoll * 4),
    tunnelFactor: mix(TUNNEL_FACTOR_MIN, TUNNEL_FACTOR_MAX, tunnelRoll)
  }
}

function treeCenter(cellX, cellZ, shaderSeed) {
  return {
    x: cellX * TREE_CELL_SIZE + (hash21(gpuAdd(cellX, 2.7), gpuAdd(cellZ, 2.7), shaderSeed) - 0.5) * TREE_CELL_JITTER,
    z: cellZ * TREE_CELL_SIZE + (hash21(gpuAdd(cellX, 9.2), gpuAdd(cellZ, 9.2), shaderSeed) - 0.5) * TREE_CELL_JITTER
  }
}

function structureLocal(x, z, angle) {
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return { x: cosine * x + sine * z, z: -sine * x + cosine * z }
}

function structureWorld(x, z, layout) {
  const cosine = Math.cos(layout.angle)
  const sine = Math.sin(layout.angle)
  return {
    x: layout.centerX + cosine * x - sine * z,
    z: layout.centerZ + sine * x + cosine * z
  }
}

function insideRectangle(x, z, centerX, centerZ, halfX, halfZ, radius) {
  return Math.abs(x - centerX) < halfX + radius && Math.abs(z - centerZ) < halfZ + radius
}

function foldedPoint(x, z, folds) {
  return {
    x: x + Math.sin(z * 0.022 + Math.sin(x * 0.006) * 2) * folds * 7,
    z: z + Math.sin(x * 0.019 - Math.cos(z * 0.007) * 2) * folds * 6
  }
}

function riverCenter(z) {
  return Math.sin(z * 0.024) * 7 + Math.sin(z * 0.009) * 5 + Math.sin(z * 0.004) * 3
}

function riverMask(x, z, rivers) {
  const distance = Math.abs(x - riverCenter(z))
  return Math.exp(-distance * distance * 0.11) * rivers
}

function fbm(x, z, seed) {
  let value = 0
  let weight = 0.5
  for (let octave = 0; octave < 5; octave++) {
    value += noise21(x, z, seed) * weight
    const nextX = (0.82 * x + 0.57 * z) * 2.03 + 17.4
    z = (-0.57 * x + 0.82 * z) * 2.03 + 17.4
    x = nextX
    weight *= 0.5
  }
  return value
}

function noise21(x, z, seed) {
  const cellX = Math.floor(x)
  const cellZ = Math.floor(z)
  const localX = smooth(fract(x))
  const localZ = smooth(fract(z))
  return mix(
    mix(hash21(cellX, cellZ, seed), hash21(cellX + 1, cellZ, seed), localX),
    mix(hash21(cellX, cellZ + 1, seed), hash21(cellX + 1, cellZ + 1, seed), localX),
    localZ
  )
}

function hash21(x, z, seed) {
  x = fract(gpuMultiply(x, 123.34))
  z = fract(gpuMultiply(z, 456.21))
  const bias = gpuAdd(45.32, gpuMultiply(seed, 0.001))
  const value = gpuAdd(gpuMultiply(x, gpuAdd(x, bias)), gpuMultiply(z, gpuAdd(z, bias)))
  return fract(gpuMultiply(gpuAdd(x, value), gpuAdd(z, value)))
}

function gpuAdd(a, b) {
  return Math.fround(Math.fround(a) + Math.fround(b))
}

function gpuMultiply(a, b) {
  return Math.fround(Math.fround(a) * Math.fround(b))
}

function fract(value) {
  return value - Math.floor(value)
}

function smooth(value) {
  return value * value * (3 - 2 * value)
}

function smoothstep(low, high, value) {
  const amount = Math.min(1, Math.max(0, (value - low) / (high - low)))
  return amount * amount * (3 - 2 * amount)
}

function mix(start, end, amount) {
  return start + (end - start) * amount
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
