import { hashMaze, mazeForLayout } from './maze.js'
import { terrainHeightAt, structureLayout } from './spatial-layout.js'
import { STRUCTURE_CELL_SIZE, UNDERGROUND_DESCENT } from '../config/world.js'
import { isCultivationCell, plantingCenter } from './ecology-layout.js'

export { isCultivationCell, plantingCenter } from './ecology-layout.js'

export const ECOLOGY_ATLAS_RADIUS = 5
export const ECOLOGY_ATLAS_CELLS = ECOLOGY_ATLAS_RADIUS * 2 + 1
export const PLANTING_RADIUS = 4.6
export const PLANTING_REACH = 5.4
export const BAG_REACH = 2
export const FULL_GROWTH_LIGHT_SECONDS = 240

export const SEED_TYPES = Object.freeze([
  Object.freeze({ id: 'moonbell', label: 'Moonbell', description: 'Pearl bells on slender blue-green stems.', color: '#b9d9ff', form: 0 }),
  Object.freeze({ id: 'ribbonFern', label: 'Ribbon fern', description: 'Copper-veined leaves that unfold in fans.', color: '#70c9a0', form: 1 }),
  Object.freeze({ id: 'emberThistle', label: 'Ember thistle', description: 'A dark stalk crowned with warm luminous florets.', color: '#ff8a5b', form: 2 }),
  Object.freeze({ id: 'silverlace', label: 'Silverlace', description: 'Lavender bells veined with fernlike silver.', color: '#c8b8ff', form: 0, requires: ['moonbell', 'ribbonFern'] }),
  Object.freeze({ id: 'cinderbloom', label: 'Cinderbloom', description: 'Rose-coral florets held above copper-green leaves.', color: '#ff6f91', form: 2, requires: ['ribbonFern', 'emberThistle'] }),
  Object.freeze({ id: 'auroraCup', label: 'Aurora cup', description: 'Cool turquoise cups with ember-gold throats.', color: '#73e0d1', form: 0, requires: ['moonbell', 'emberThistle'] }),
  Object.freeze({ id: 'ghostLantern', label: 'Ghost lantern', description: 'Iridescent white bells fading into dusk violet.', color: '#d9efff', form: 0, requires: ['silverlace', 'moonbell'] }),
  Object.freeze({ id: 'copperVeil', label: 'Copper veil', description: 'Layered jade fronds crossed by warm metallic veins.', color: '#d39a62', form: 1, requires: ['silverlace', 'ribbonFern'] }),
  Object.freeze({ id: 'hearthPlume', label: 'Hearth plume', description: 'Amber plumes rising from wine-dark foliage.', color: '#ffb347', form: 2, requires: ['cinderbloom', 'emberThistle'] }),
  Object.freeze({ id: 'prismReed', label: 'Prism reed', description: 'Sea-green fronds with cool spectral tips.', color: '#72d7ff', form: 1, requires: ['auroraCup', 'ribbonFern'] }),
  Object.freeze({ id: 'velvetStar', label: 'Velvet star', description: 'Plum florets opening toward pale rose centers.', color: '#c77dff', form: 2, requires: ['cinderbloom', 'moonbell'] }),
  Object.freeze({ id: 'glassFern', label: 'Glass fern', description: 'Translucent mint leaflets edged in soft copper.', color: '#8ef0c7', form: 1, requires: ['copperVeil', 'auroraCup'] }),
  Object.freeze({ id: 'eclipseRose', label: 'Eclipse rose', description: 'Midnight petals ignited by a sunset-gold heart.', color: '#ff7096', form: 0, requires: ['ghostLantern', 'hearthPlume'] })
])

export function nextAvailableSeed(inventory, selectedSeed) {
  const start = SEED_TYPES.findIndex(({ id }) => id === selectedSeed)
  for (let offset = 1; offset <= SEED_TYPES.length; offset++) {
    const type = SEED_TYPES[(start + offset + SEED_TYPES.length) % SEED_TYPES.length]
    if ((inventory[type.id] || 0) > 0) return type.id
  }
  return null
}

export function emptyEcologyDocument(seed) {
  return {
    version: 1,
    seed,
    inventory: Object.fromEntries(SEED_TYPES.map(({ id }) => [id, 0])),
    selectedSeed: SEED_TYPES[0].id,
    collectedBags: [],
    buildingVisits: {},
    discoveredPockets: [],
    plantings: [],
    stats: {
      bagsCollected: 0,
      seedsPlanted: 0,
      plantsMatured: 0,
      sunlightSeconds: 0,
      collectedByType: Object.fromEntries(SEED_TYPES.map(({ id }) => [id, 0])),
      plantedByType: Object.fromEntries(SEED_TYPES.map(({ id }) => [id, 0]))
    }
  }
}

export function normalizeEcologyDocument(document, seed) {
  const base = emptyEcologyDocument(seed)
  if (!document || document.seed !== seed) return base
  const types = new Set(SEED_TYPES.map(({ id }) => id))
  const collectedBags = Array.isArray(document.collectedBags) ? [...new Set(document.collectedBags.map(String))] : []
  const discoveredKeys = new Set()
  const discoveredPockets = Array.isArray(document.discoveredPockets) ? document.discoveredPockets.filter((pocket) => {
    if (!pocket || !Number.isInteger(pocket.cellX) || !Number.isInteger(pocket.cellZ)) return false
    const key = plantingId(pocket.cellX, pocket.cellZ)
    if (discoveredKeys.has(key) || !isCultivationCell(pocket.cellX, pocket.cellZ, seed)) return false
    discoveredKeys.add(key)
    return true
  }).map(({ cellX, cellZ }) => ({ cellX, cellZ })) : []
  const plantings = []
  const plotSpecies = new Map()
  for (const plant of Array.isArray(document.plantings) ? document.plantings : []) {
    if (!plant || !types.has(plant.species) || !Number.isInteger(plant.cellX) || !Number.isInteger(plant.cellZ)) continue
    const key = plantingId(plant.cellX, plant.cellZ)
    const species = plotSpecies.get(key) || new Set()
    if (species.size >= 2 || species.has(plant.species)) continue
    const slot = species.size
    species.add(plant.species)
    plotSpecies.set(key, species)
    plantings.push({
      id: plantingId(plant.cellX, plant.cellZ, slot),
      cellX: plant.cellX,
      cellZ: plant.cellZ,
      species: plant.species,
      growth: clamp(Number(plant.growth), 0.025, 1),
      plantedAt: String(plant.plantedAt || new Date(0).toISOString())
    })
  }
  const inventory = Object.fromEntries(SEED_TYPES.map(({ id }) => [id, Math.max(0, Math.floor(Number(document.inventory?.[id]) || 0))]))
  const buildingVisits = Object.fromEntries(Object.entries(document.buildingVisits || {}).flatMap(([key, visits]) => {
    const value = Math.max(0, Math.floor(Number(visits) || 0))
    return /^-?\d+:-?\d+$/.test(key) && value ? [[key, value]] : []
  }))
  const storedSelection = types.has(document.selectedSeed) ? document.selectedSeed : SEED_TYPES[0].id
  const selectedSeed = inventory[storedSelection] > 0 ? storedSelection : nextAvailableSeed(inventory, storedSelection) || storedSelection
  return {
    ...base,
    ...structuredClone(document),
    version: 1,
    seed,
    inventory,
    selectedSeed,
    collectedBags,
    buildingVisits,
    discoveredPockets,
    plantings,
    stats: {
      bagsCollected: Math.max(collectedBags.length, Math.floor(Number(document.stats?.bagsCollected) || 0)),
      seedsPlanted: Math.max(plantings.length, Math.floor(Number(document.stats?.seedsPlanted) || 0)),
      plantsMatured: Math.max(0, Math.floor(Number(document.stats?.plantsMatured) || 0)),
      sunlightSeconds: Math.max(0, Number(document.stats?.sunlightSeconds) || 0),
      collectedByType: Object.fromEntries(SEED_TYPES.map(({ id }) => [id, Math.max(0, Math.floor(Number(document.stats?.collectedByType?.[id]) || 0))])),
      plantedByType: Object.fromEntries(SEED_TYPES.map(({ id }) => [id, Math.max(0, Math.floor(Number(document.stats?.plantedByType?.[id]) || 0))]))
    }
  }
}

export class EcologyState {
  static async create(seed) {
    const repository = await EcologyRepository.open()
    const state = new EcologyState(repository, normalizeEcologyDocument(await repository.load(), seed))
    await repository.save(state.document)
    return state
  }

  constructor(repository, document) {
    this.repository = repository
    this.document = document
    this.listeners = new Set()
    this.revision = 1
    this.bagRevision = 1
  }

  subscribe(listener) {
    this.listeners.add(listener)
    listener(this.document)
    return () => this.listeners.delete(listener)
  }

  selectSeed(species) {
    if (!SEED_TYPES.some((type) => type.id === species)) return false
    this.document.selectedSeed = species
    this.changed()
    this.checkpoint().catch(() => {})
    return true
  }

  async collectBag(bag) {
    if (!bag || this.document.collectedBags.includes(bag.id)) return false
    this.document.collectedBags.push(bag.id)
    this.document.inventory[bag.species]++
    if (this.document.inventory[this.document.selectedSeed] < 1) {
      this.document.selectedSeed = nextAvailableSeed(this.document.inventory, this.document.selectedSeed) || this.document.selectedSeed
    }
    this.document.stats.bagsCollected++
    this.document.stats.collectedByType[bag.species]++
    this.bagRevision++
    this.changed()
    await this.repository.save(this.document)
    return true
  }

  discoverPocket(pocket) {
    if (!pocket || this.isPocketDiscovered(pocket.cellX, pocket.cellZ)) return false
    this.document.discoveredPockets.push({ cellX: pocket.cellX, cellZ: pocket.cellZ })
    this.changed()
    this.checkpoint().catch(() => {})
    return true
  }

  visitBuilding(layout) {
    if (!layout) return false
    const key = buildingKey(layout.cellX, layout.cellZ)
    this.document.buildingVisits[key] = (this.document.buildingVisits[key] || 0) + 1
    this.bagRevision++
    this.changed()
    this.checkpoint().catch(() => {})
    return true
  }

  async useSeed(seed) {
    if (this.document.seed === seed) return false
    this.document = emptyEcologyDocument(seed)
    this.bagRevision++
    this.changed()
    await this.repository.save(this.document)
    return true
  }

  async plant(pocket) {
    let species = this.document.selectedSeed
    if (this.document.inventory[species] < 1) species = nextAvailableSeed(this.document.inventory, species)
    const plot = pocket ? this.plantingsAt(pocket.cellX, pocket.cellZ) : []
    if (!pocket || !species || plot.length >= 2 || plot.some((plant) => plant.species === species)) return null
    this.document.selectedSeed = species
    const plant = {
      id: plantingId(pocket.cellX, pocket.cellZ, plot.length),
      cellX: pocket.cellX,
      cellZ: pocket.cellZ,
      species,
      growth: 0.025,
      plantedAt: new Date().toISOString()
    }
    this.document.inventory[species]--
    if (this.document.inventory[species] < 1) {
      this.document.selectedSeed = nextAvailableSeed(this.document.inventory, species) || species
    }
    this.document.plantings.push(plant)
    this.document.stats.seedsPlanted++
    this.document.stats.plantedByType[species]++
    this.changed()
    await this.repository.save(this.document)
    return plant
  }

  advanceGrowth(delta, daylight) {
    const sunlight = Math.max(0, Number(delta) || 0) * smoothstep(0.2, 0.66, daylight)
    if (!sunlight || !this.document.plantings.some((plant) => plant.growth < 1)) return false
    let matured = 0
    let visibleChange = false
    for (const plant of this.document.plantings) {
      if (plant.growth >= 1) continue
      const before = Math.round(plant.growth * 255)
      plant.growth = Math.min(1, plant.growth + sunlight / FULL_GROWTH_LIGHT_SECONDS)
      if (plant.growth === 1) matured++
      if (Math.round(plant.growth * 255) !== before) visibleChange = true
    }
    this.document.stats.sunlightSeconds += sunlight
    this.document.stats.plantsMatured += matured
    if (matured) this.bagRevision++
    if (visibleChange || matured) this.changed(false)
    return visibleChange || matured
  }

  plantingAt(cellX, cellZ) {
    return this.document.plantings.find((plant) => plant.cellX === cellX && plant.cellZ === cellZ) || null
  }

  plantingsAt(cellX, cellZ) {
    return this.document.plantings.filter((plant) => plant.cellX === cellX && plant.cellZ === cellZ)
  }

  isPocketDiscovered(cellX, cellZ) {
    return this.document.discoveredPockets.some((pocket) => pocket.cellX === cellX && pocket.cellZ === cellZ)
  }

  hasBag(id) {
    return this.document.collectedBags.includes(id)
  }

  async checkpoint() {
    await this.repository.save(this.document)
  }

  changed(notify = true) {
    this.revision++
    if (notify) for (const listener of this.listeners) listener(this.document)
  }

  dispose() {
    this.checkpoint().catch(() => {})
    this.listeners.clear()
    this.repository.dispose()
  }
}

export function plantingPocket(cellX, cellZ, settings, seed, cache) {
  if (cache) return cache.remember('plantingPocket', `${cellX},${cellZ}`, () => plantingPocket(cellX, cellZ, settings, seed))
  if (!isCultivationCell(cellX, cellZ, seed)) return null
  const center = plantingCenter(cellX, cellZ, seed)
  return { cellX, cellZ, ...center, y: terrainHeightAt(center.x, center.z, settings, seed, cache) }
}

export function nearestPlantingPocket(position, settings, seed, cache) {
  const baseX = Math.floor((position.x + STRUCTURE_CELL_SIZE * 0.5) / STRUCTURE_CELL_SIZE)
  const baseZ = Math.floor((position.z + STRUCTURE_CELL_SIZE * 0.5) / STRUCTURE_CELL_SIZE)
  let nearest = null
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const pocket = plantingPocket(baseX + dx, baseZ + dz, settings, seed, cache)
    if (!pocket) continue
    const distance = Math.hypot(position.x - pocket.x, position.z - pocket.z)
    if (distance <= PLANTING_REACH && (!nearest || distance < nearest.distance)) nearest = { ...pocket, distance }
  }
  return nearest
}

export function nearestAvailablePlantingPocket(position, settings, seed, ecology, cache, maxRadius = 12) {
  return findNearestPlantingPocket(position, settings, seed, ecology, cache, maxRadius, false)
}

export function nearestUndiscoveredPlantingPocket(position, settings, seed, ecology, cache, maxRadius = 12) {
  return findNearestPlantingPocket(position, settings, seed, ecology, cache, maxRadius, true)
}

export function discoveredAvailablePlantingPockets(settings, seed, ecology, cache) {
  return ecology.document.discoveredPockets.flatMap(({ cellX, cellZ }) => {
    if (ecology.plantingAt(cellX, cellZ)) return []
    const pocket = plantingPocket(cellX, cellZ, settings, seed, cache)
    return pocket ? [pocket] : []
  })
}

export function plantedPlantingPockets(settings, seed, ecology, cache) {
  const seen = new Set()
  return ecology.document.plantings.flatMap((plant) => {
    const id = plantingId(plant.cellX, plant.cellZ)
    if (seen.has(id)) return []
    seen.add(id)
    const pocket = plantingPocket(plant.cellX, plant.cellZ, settings, seed, cache)
    return pocket ? [{ ...pocket, plants: ecology.plantingsAt(plant.cellX, plant.cellZ) }] : []
  })
}

function findNearestPlantingPocket(position, settings, seed, ecology, cache, maxRadius, undiscoveredOnly) {
  const baseX = Math.floor((position.x + STRUCTURE_CELL_SIZE * 0.5) / STRUCTURE_CELL_SIZE)
  const baseZ = Math.floor((position.z + STRUCTURE_CELL_SIZE * 0.5) / STRUCTURE_CELL_SIZE)
  let nearest = null
  let foundRadius = -1
  for (let radius = 0; radius <= maxRadius; radius++) {
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      if (radius && Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue
      const cellX = baseX + dx
      const cellZ = baseZ + dz
      if (!isCultivationCell(cellX, cellZ, seed) || ecology.plantingAt(cellX, cellZ)) continue
      if (undiscoveredOnly && ecology.isPocketDiscovered(cellX, cellZ)) continue
      const center = plantingCenter(cellX, cellZ, seed)
      const distance = Math.hypot(position.x - center.x, position.z - center.z)
      if (!nearest || distance < nearest.distance) nearest = { cellX, cellZ, ...center, distance }
    }
    if (nearest && foundRadius < 0) foundRadius = radius
    if (foundRadius >= 0 && radius > foundRadius) break
  }
  if (!nearest) return null
  return { ...nearest, y: terrainHeightAt(nearest.x, nearest.z, settings, seed, cache) }
}

export function seedBagForLayout(layout, ecology, cache) {
  return seedBagsForLayout(layout, ecology, cache)[0] || null
}

export function seedBagsForLayout(layout, ecology, cache) {
  if (!layout) return []
  const generation = ecology?.document.buildingVisits?.[buildingKey(layout.cellX, layout.cellZ)] || 0
  const cacheKey = `${layout.cellX},${layout.cellZ}:${generation}`
  const bags = cache
    ? cache.remember('seedBags', cacheKey, () => [0, 1].map((floor) => seedBagCandidateForLayout(layout, generation, floor)))
    : [0, 1].map((floor) => seedBagCandidateForLayout(layout, generation, floor))
  return bags.flatMap((bag) => {
    if (!bag) return []
    if (seedTypeUnlocked(bag.type, ecology)) return [bag]
    const type = SEED_TYPES[hashIndex(hashMaze(`${bag.id}:base-fallback`), 3)]
    return [{ ...bag, species: type.id, type }]
  })
}

function seedBagCandidateForLayout(layout, generation, floor) {
  const maze = mazeForLayout(layout, floor)
  const nodes = maze.nodes.filter((node) => node.id !== maze.entry && !node.portal && !node.courtyardTile && !node.lowerStair)
  if (!nodes.length) return null
  const identity = `${layout.cellX},${layout.cellZ}:${layout.mazeRecipe.seed}:${generation}:${floor}`
  const typeRoll = hashMaze(`${identity}:seed-type`)
  const typeIndex = !floor || hashFraction(typeRoll) < 0.5
    ? hashIndex(typeRoll, 3) : 3 + hashIndex(hashMaze(`${identity}:hybrid-type`), SEED_TYPES.length - 3)
  const type = SEED_TYPES[typeIndex]
  const node = nodes[hashIndex(hashMaze(`${identity}:seed-node`), nodes.length)]
  const cosine = Math.cos(layout.angle)
  const sine = Math.sin(layout.angle)
  return {
    id: `bag:${layout.cellX}:${layout.cellZ}:${generation}:${floor}`,
    cellX: layout.cellX,
    cellZ: layout.cellZ,
    node: node.id,
    floor,
    x: layout.centerX + cosine * node.x - sine * node.z,
    y: layout.ground - UNDERGROUND_DESCENT * (floor + 1) + 0.42,
    z: layout.centerZ + sine * node.x + cosine * node.z,
    species: type.id,
    type
  }
}

export function seedTypeUnlocked(type, ecology) {
  if (!type?.requires?.length) return true
  if (!ecology) return false
  const plots = new Map()
  for (const plant of ecology.document.plantings) {
    if (plant.growth < 1) continue
    const key = plantingId(plant.cellX, plant.cellZ)
    if (!plots.has(key)) plots.set(key, new Set())
    plots.get(key).add(plant.species)
  }
  return [...plots.values()].some((species) => type.requires.every((required) => species.has(required)))
}

export function nearestSeedBag(position, settings, seed, ecology, cache) {
  const baseX = Math.floor((position.x + STRUCTURE_CELL_SIZE * 0.5) / STRUCTURE_CELL_SIZE)
  const baseZ = Math.floor((position.z + STRUCTURE_CELL_SIZE * 0.5) / STRUCTURE_CELL_SIZE)
  let nearest = null
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const bags = seedBagsForLayout(structureLayout(baseX + dx, baseZ + dz, settings, seed, cache), ecology, cache)
    for (const bag of bags) {
      if (ecology.hasBag(bag.id)) continue
      const distance = Math.hypot(position.x - bag.x, position.y - bag.y, position.z - bag.z)
      if (distance <= BAG_REACH && (!nearest || distance < nearest.distance)) nearest = { ...bag, distance }
    }
  }
  return nearest
}

export function daylightAmount(dayPhase, daylightSetting) {
  return (0.5 + 0.5 * Math.sin(dayPhase)) * 0.84 + daylightSetting * 0.16
}

export function plantingId(cellX, cellZ, slot = 0) {
  return `plant:${cellX}:${cellZ}${slot ? `:${slot}` : ''}`
}

function buildingKey(cellX, cellZ) {
  return `${cellX}:${cellZ}`
}

function hashFraction(value) {
  return value / 4294967296
}

function hashIndex(value, length) {
  return Math.min(length - 1, Math.floor(hashFraction(value) * length))
}

function smoothstep(low, high, value) {
  const amount = clamp((value - low) / (high - low), 0, 1)
  return amount * amount * (3 - 2 * amount)
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, Number.isFinite(value) ? value : low))
}

const ECOLOGY_DATABASE = 'mind-landscape-ecology'
const ECOLOGY_STORE = 'state'
const ECOLOGY_ACTIVE = 'active'

class EcologyRepository {
  static open() {
    return new Promise((resolve) => {
      const request = indexedDB.open(ECOLOGY_DATABASE, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(ECOLOGY_STORE)
      request.onsuccess = () => resolve(new EcologyRepository(request.result))
      request.onerror = () => resolve(new MemoryEcologyRepository())
    })
  }

  constructor(database) { this.database = database }

  load() { return this.request('readonly', (store) => store.get(ECOLOGY_ACTIVE)) }

  save(document) { return this.request('readwrite', (store) => store.put(structuredClone(document), ECOLOGY_ACTIVE)) }

  request(mode, operation) {
    return new Promise((resolve, reject) => {
      const transaction = this.database.transaction(ECOLOGY_STORE, mode)
      const request = operation(transaction.objectStore(ECOLOGY_STORE))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onabort = () => reject(transaction.error || new Error('The ecology save was aborted.'))
      transaction.onerror = () => reject(transaction.error)
      request.onerror = () => reject(request.error)
    })
  }

  dispose() { this.database.close() }
}

class MemoryEcologyRepository {
  load() { return Promise.resolve(null) }
  save() { return Promise.resolve() }
  dispose() {}
}
