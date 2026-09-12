import { hashMaze } from './maze.js'
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
  Object.freeze({ id: 'moonbell', label: 'Moonbell', description: 'Pearl bells on slender blue-green stems.', color: '#b9d9ff' }),
  Object.freeze({ id: 'ribbonFern', label: 'Ribbon fern', description: 'Copper-veined leaves that unfold in fans.', color: '#70c9a0' }),
  Object.freeze({ id: 'emberThistle', label: 'Ember thistle', description: 'A dark stalk crowned with warm luminous florets.', color: '#ff8a5b' })
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
  const plantings = Array.isArray(document.plantings) ? document.plantings.filter((plant) => {
    return plant && types.has(plant.species) && Number.isInteger(plant.cellX) && Number.isInteger(plant.cellZ)
  }).map((plant) => ({
    id: String(plant.id || plantingId(plant.cellX, plant.cellZ)),
    cellX: plant.cellX,
    cellZ: plant.cellZ,
    species: plant.species,
    growth: clamp(Number(plant.growth), 0.025, 1),
    plantedAt: String(plant.plantedAt || new Date(0).toISOString())
  })) : []
  const inventory = Object.fromEntries(SEED_TYPES.map(({ id }) => [id, Math.max(0, Math.floor(Number(document.inventory?.[id]) || 0))]))
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

  async useSeed(seed) {
    if (this.document.seed === seed) return false
    this.document = emptyEcologyDocument(seed)
    this.changed()
    await this.repository.save(this.document)
    return true
  }

  async plant(pocket) {
    let species = this.document.selectedSeed
    if (this.document.inventory[species] < 1) species = nextAvailableSeed(this.document.inventory, species)
    if (!pocket || !species || this.plantingAt(pocket.cellX, pocket.cellZ)) return null
    this.document.selectedSeed = species
    const plant = {
      id: plantingId(pocket.cellX, pocket.cellZ),
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
    if (visibleChange || matured) this.changed(false)
    return visibleChange || matured
  }

  plantingAt(cellX, cellZ) {
    return this.document.plantings.find((plant) => plant.cellX === cellX && plant.cellZ === cellZ) || null
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
  return ecology.document.plantings.flatMap((plant) => {
    const pocket = plantingPocket(plant.cellX, plant.cellZ, settings, seed, cache)
    return pocket ? [{ ...pocket, plant }] : []
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

export function seedBagForLayout(layout, cache) {
  if (!layout) return null
  if (cache) return cache.remember('seedBag', layout, () => seedBagForLayout(layout))
  const side = layout.variant > 0.5 ? 1 : -1
  const localX = side * layout.width * 0.22
  const localZ = -layout.depth * 0.14 - 2.4
  const cosine = Math.cos(layout.angle)
  const sine = Math.sin(layout.angle)
  const typeIndex = hashMaze(`${layout.cellX},${layout.cellZ}:${layout.mazeRecipe.seed}:seed-bag`) % SEED_TYPES.length
  return {
    id: `bag:${layout.cellX}:${layout.cellZ}`,
    cellX: layout.cellX,
    cellZ: layout.cellZ,
    x: layout.centerX + cosine * localX - sine * localZ,
    y: layout.ground - UNDERGROUND_DESCENT + 0.42,
    z: layout.centerZ + sine * localX + cosine * localZ,
    species: SEED_TYPES[typeIndex].id,
    type: SEED_TYPES[typeIndex]
  }
}

export function nearestSeedBag(position, settings, seed, ecology, cache) {
  const baseX = Math.floor((position.x + STRUCTURE_CELL_SIZE * 0.5) / STRUCTURE_CELL_SIZE)
  const baseZ = Math.floor((position.z + STRUCTURE_CELL_SIZE * 0.5) / STRUCTURE_CELL_SIZE)
  let nearest = null
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const bag = seedBagForLayout(structureLayout(baseX + dx, baseZ + dz, settings, seed, cache), cache)
    if (!bag || ecology.hasBag(bag.id)) continue
    const distance = Math.hypot(position.x - bag.x, position.y - bag.y, position.z - bag.z)
    if (distance <= BAG_REACH && (!nearest || distance < nearest.distance)) nearest = { ...bag, distance }
  }
  return nearest
}

export function daylightAmount(dayPhase, daylightSetting) {
  return (0.5 + 0.5 * Math.sin(dayPhase)) * 0.84 + daylightSetting * 0.16
}

export function plantingId(cellX, cellZ) {
  return `plant:${cellX}:${cellZ}`
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
