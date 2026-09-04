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
const PORTAL_SEARCH_RADIUS = 10
const NEIGHBORHOOD_RADIUS = 1
const STRUCTURE_CELL_HALF = STRUCTURE_CELL_SIZE * 0.5

export function terrainHeightAt(x, z, settings, seed) {
  const terrainHeight = terrainBaseHeightAt(x, z, settings, seed)
  return gradeStructureGroundAt(x, z, terrainHeight, settings, seed)
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

function gradeStructureGroundAt(x, z, terrainHeight, settings, seed) {
  const cellX = Math.floor((x + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)
  const cellZ = Math.floor((z + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)
  const layout = structureLayout(cellX, cellZ, settings, seed)
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

  if (local.z <= underground.chamberStart && local.z >= underground.chamberEnd) {
    const corridorX = undergroundCenterXAt(local.z, underground, layout)
    if (Math.abs(local.x - corridorX) < underground.chamberHalfX) {
      surfaceHeight = Math.min(surfaceHeight, layout.ground - underground.descent)
    }
  }

  return surfaceHeight
}

export function portalDestinationAt(position, settings, seed) {
  const baseCellX = Math.floor((position.x + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)
  const baseCellZ = Math.floor((position.z + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)

  for (let offsetX = -NEIGHBORHOOD_RADIUS; offsetX <= NEIGHBORHOOD_RADIUS; offsetX++) {
    for (let offsetZ = -NEIGHBORHOOD_RADIUS; offsetZ <= NEIGHBORHOOD_RADIUS; offsetZ++) {
      const source = structureLayout(baseCellX + offsetX, baseCellZ + offsetZ, settings, seed)
      if (!source) continue
      const local = structureLocal(position.x - source.centerX, position.z - source.centerZ, source.angle)
      const underground = undergroundLayout(source)
      const portalX = undergroundCenterXAt(underground.portalZ, underground, source)
      const atPortal = Math.abs(local.x - portalX) < underground.chamberHalfX - 0.45
        && local.z <= underground.portalZ + 0.9
        && local.z >= underground.portalZ - 0.35
        && position.y < source.ground - 0.8
      if (!atPortal) continue

      const destination = findPortalDestination(source, settings, seed)
      if (!destination) return null
      const destinationUnderground = undergroundLayout(destination)
      const exitZ = destinationUnderground.portalZ + 1.55
      const exit = structureWorld(
        undergroundCenterXAt(exitZ, destinationUnderground, destination),
        exitZ,
        destination
      )
      return {
        x: exit.x,
        z: exit.z,
        rotation: destination.angle - source.angle + Math.PI
      }
    }
  }

  return null
}

export function isUndergroundAt(x, z, settings, seed) {
  const baseCellX = Math.floor((x + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)
  const baseCellZ = Math.floor((z + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)

  for (let offsetX = -NEIGHBORHOOD_RADIUS; offsetX <= NEIGHBORHOOD_RADIUS; offsetX++) {
    for (let offsetZ = -NEIGHBORHOOD_RADIUS; offsetZ <= NEIGHBORHOOD_RADIUS; offsetZ++) {
      const layout = structureLayout(baseCellX + offsetX, baseCellZ + offsetZ, settings, seed)
      if (!layout) continue
      const local = structureLocal(x - layout.centerX, z - layout.centerZ, layout.angle)
      const underground = undergroundLayout(layout)
      const onStairs = Math.abs(local.x - underground.stairX) < underground.stairWidth
        && local.z < underground.stairStart - 0.05
        && local.z >= underground.stairEnd
      const corridorX = undergroundCenterXAt(local.z, underground, layout)
      const inChamber = Math.abs(local.x - corridorX) < underground.chamberHalfX
        && local.z <= underground.chamberStart
        && local.z >= underground.chamberEnd
      if (onStairs || inChamber) return true
    }
  }

  return false
}

function findPortalDestination(source, settings, seed) {
  const offsets = [
    [1, 0], [1, 1], [0, 1], [-1, 1],
    [-1, 0], [-1, -1], [0, -1], [1, -1]
  ]
  const shift = Math.floor(source.variant * offsets.length)

  for (let radius = 1; radius <= PORTAL_SEARCH_RADIUS; radius++) {
    for (let index = 0; index < offsets.length; index++) {
      const offset = offsets[(index + shift) % offsets.length]
      const destination = structureLayout(
        source.cellX + offset[0] * radius,
        source.cellZ + offset[1] * radius,
        settings,
        seed
      )
      if (destination) return destination
    }
  }

  return null
}

function undergroundLayout(layout) {
  const stairEnd = -layout.depth * 0.14
  const chamberEnd = -layout.depth * Math.min(0.84, layout.tunnelFactor + 0.25)
  return {
    stairX: (layout.variant > 0.5 ? 1 : -1) * layout.width * 0.22,
    stairStart: layout.depth * 0.2,
    stairEnd,
    stairWidth: STAIR_WIDTH,
    chamberHalfX: layout.width * 0.2,
    chamberStart: stairEnd + 0.2,
    portalZ: chamberEnd + 0.62,
    chamberEnd,
    descent: UNDERGROUND_DESCENT
  }
}

function undergroundCenterXAt(z, underground, layout) {
  const progress = clamp(
    (underground.chamberStart - z) / (underground.chamberStart - underground.chamberEnd),
    0,
    1
  )
  const envelope = smoothstep(0, 0.18, progress)
  const phase = layout.variant * Math.PI * 2 + layout.style * 1.17
  const primary = Math.sin(progress * 5.2 + phase) - Math.sin(phase)
  const secondaryPhase = phase * 0.61
  const secondary = Math.sin(progress * 10.7 + secondaryPhase) - Math.sin(secondaryPhase)
  const offset = envelope * underground.chamberHalfX * 0.32 * (primary * 0.68 + secondary * 0.24)
  return underground.stairX + offset
}

export function undergroundPathAt(layout, progress) {
  const underground = undergroundLayout(layout)
  const amount = clamp(progress, 0, 1)
  const z = mix(underground.chamberStart, underground.chamberEnd, amount)
  return {
    x: undergroundCenterXAt(z, underground, layout),
    z
  }
}

export function isPositionBlocked(position, settings, seed, radius = 0.34) {
  return isBlockedByStructure(position, settings, seed, radius) || isBlockedByTree(position, settings, seed, radius)
}

function isBlockedByTree(position, settings, seed, radius) {
  const shaderSeed = gpuMultiply(seed, WORLD_SEED_SCALE)
  const baseCellX = Math.floor((position.x + TREE_CELL_SIZE * 0.5) / TREE_CELL_SIZE)
  const baseCellZ = Math.floor((position.z + TREE_CELL_SIZE * 0.5) / TREE_CELL_SIZE)

  for (let offsetX = -NEIGHBORHOOD_RADIUS; offsetX <= NEIGHBORHOOD_RADIUS; offsetX++) {
    for (let offsetZ = -NEIGHBORHOOD_RADIUS; offsetZ <= NEIGHBORHOOD_RADIUS; offsetZ++) {
      const cellX = baseCellX + offsetX
      const cellZ = baseCellZ + offsetZ
      const center = treeCenter(cellX, cellZ, shaderSeed)
      const vegetation = vegetationAt(cellX, cellZ, center, settings, shaderSeed, seed)
      if (!vegetation) continue

      const ground = terrainHeightAt(center.x, center.z, settings, seed)
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

function vegetationAt(cellX, cellZ, center, settings, shaderSeed, seed) {
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
  const structure = structureLayout(structureCellX, structureCellZ, settings, seed)
  if (structure && Math.hypot(center.x - structure.centerX, center.z - structure.centerZ) < STRUCTURE_VEGETATION_CLEARANCE) return null
  if (terrainHeightAt(center.x, center.z, settings, seed) < settings.water.level + VEGETATION_WATER_CLEARANCE) return null

  const kindSelector = hash21(cellX + 84.3, cellZ + 84.3, shaderSeed) * Math.max(vegetationWeight, 0.001)
  const speciesRoll = hash21(cellX + 42.6, cellZ + 42.6, shaderSeed)
  return {
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

function isBlockedByStructure(position, settings, seed, radius) {
  const baseCellX = Math.floor((position.x + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)
  const baseCellZ = Math.floor((position.z + STRUCTURE_CELL_HALF) / STRUCTURE_CELL_SIZE)

  for (let offsetX = -NEIGHBORHOOD_RADIUS; offsetX <= NEIGHBORHOOD_RADIUS; offsetX++) {
    for (let offsetZ = -NEIGHBORHOOD_RADIUS; offsetZ <= NEIGHBORHOOD_RADIUS; offsetZ++) {
      const layout = structureLayout(baseCellX + offsetX, baseCellZ + offsetZ, settings, seed)
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

function isBlockedByUnderground(local, worldY, layout, radius) {
  const underground = undergroundLayout(layout)
  const vertical = worldY - (layout.ground - underground.descent)
  if (vertical < -radius || vertical > UNDERGROUND_CLEARANCE + radius) return false

  const stairSpan = local.z <= underground.stairStart + radius
    && local.z >= underground.stairEnd - radius
  const chamberSpan = local.z <= underground.chamberStart + radius
    && local.z >= underground.chamberEnd - radius
  const stairWall = Math.abs(local.x - underground.stairX) >= underground.stairWidth - radius
    && Math.abs(local.x - underground.stairX) < underground.stairWidth + layout.wall + radius
  const corridorX = undergroundCenterXAt(local.z, underground, layout)
  const chamberWall = Math.abs(local.x - corridorX) >= underground.chamberHalfX - radius
    && Math.abs(local.x - corridorX) < underground.chamberHalfX + layout.wall + radius

  return stairSpan && stairWall || chamberSpan && chamberWall
}

export function structureLayout(cellX, cellZ, settings, seed) {
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
