import { mazeRecipe } from './maze.js'

const DATABASE_NAME = 'mind-landscape'
const STORE_NAME = 'worlds'
const ACTIVE_WORLD = 'active'
const GENERATOR_VERSION = '0.10.0'
const DATABASE_VERSION = 1
const SCHEMA_VERSION = 3
const UINT32_MAX = 0xffffffff
const ENTRY_PRESENCE_RATE = 1.12
const COLOR_PRESENCE_BOOST = 1.48
const EXPRESSIVE_BIAS = 0.38
const MAX_GENERATED_SETTING = 2
const RGB_CHANNEL_MAX = 255
const RGB_FALLBACK = 128

const baseSettings = {
  terrain: {
    amplitude: 0.92,
    roughness: 0.16,
    scale: 0.78
  },
  atmosphere: {
    mist: 0.26,
    warmth: 0.08,
    daylight: 0.72,
    dayCycleSpeed: 1,
    wind: 0.12,
    clouds: 0.3,
    weather: 0.14,
    lightDrama: 0.28
  },
  water: {
    level: -0.55
  },
  generation: {
    psychedelicIntensity: 0.08,
    mechanicalIntensity: 0.06,
    ritualIntensity: 0.18,
    mountains: 0.1,
    folds: 0.22,
    valleys: 0.2,
    rivers: 0.16,
    dunes: 0.1,
    forests: 0.14,
    succulents: 0.32,
    shrubs: 0.35,
    structures: 0.18,
    sandyInteriors: 0.16,
    ornateInteriors: 0.18,
    abandonedInteriors: 0.24,
    ceilingVariation: 0.45,
    grasses: 0.24,
    terraces: 0.12,
    chromaticIntensity: 0.55
  },
  palette: {
    ground: '#aaa9a0',
    accent: '#c3b79e',
    sky: '#84999e'
  }
}

const settingRanges = {
  terrain: {
    amplitude: [0.15, 2.5],
    roughness: [0, 1],
    scale: [0.25, 1.8]
  },
  atmosphere: {
    mist: [0, 1],
    warmth: [-1, 1],
    daylight: [0.1, 1],
    dayCycleSpeed: [0, 4],
    wind: [0, 1],
    clouds: [0, 1.5],
    weather: [0, 1.5],
    lightDrama: [0, 1.5]
  },
  water: {
    level: [-2.5, 1.5]
  },
  generation: Object.fromEntries([
    'psychedelicIntensity',
    'mechanicalIntensity',
    'ritualIntensity',
    'mountains',
    'folds',
    'valleys',
    'rivers',
    'dunes',
    'forests',
    'succulents',
    'shrubs',
    'structures',
    'sandyInteriors',
    'ornateInteriors',
    'abandonedInteriors',
    'ceilingVariation',
    'grasses',
    'terraces',
    'chromaticIntensity'
  ].map((name) => [name, [0, MAX_GENERATED_SETTING]]))
}

export class WorldState {
  static async create() {
    const repository = await WorldRepository.open()
    const saved = await repository.load()
    const state = new WorldState(repository, saved || createWorld())
    if (!saved || saved.generatorVersion !== state.document.generatorVersion
      || saved.schemaVersion !== state.document.schemaVersion
      || JSON.stringify(saved.maze) !== JSON.stringify(state.document.maze)) await repository.save(state.document)
    return state
  }

  constructor(repository, document) {
    this.repository = repository
    this.document = normalizeDocument(document)
    this.settings = mergeSettings(this.document.generated, this.document.overrides)
    this.settings.maze = this.document.maze
    this.listeners = new Set()
  }

  get effectiveSettings() {
    return this.settings
  }

  subscribe(listener) {
    this.listeners.add(listener)
    listener(this.document)
    return () => this.listeners.delete(listener)
  }

  async addOrReplace(entry) {
    return this.addOrReplaceMany([entry])
  }

  async addOrReplaceMany(entries) {
    if (!entries.length) return
    const indices = new Map()
    this.document.entries.forEach((entry, index) => {
      if (!indices.has(entry.source.key)) indices.set(entry.source.key, index)
    })
    for (const entry of entries) {
      const index = indices.get(entry.source.key)
      if (index !== undefined) {
        const previous = this.document.entries[index]
        this.document.entries[index] = {
          ...entry,
          id: previous.id,
          createdAt: previous.createdAt,
          updatedAt: new Date().toISOString()
        }
      } else {
        indices.set(entry.source.key, this.document.entries.length)
        this.document.entries.push(entry)
      }
    }
    await this.commit(true)
  }

  async remove(id) {
    this.document.entries = this.document.entries.filter((entry) => entry.id !== id)
    await this.commit(true)
  }

  async setDayCycleSpeed(value) {
    const dayCycleSpeed = clamp(Number(value), 0, 4)
    this.document.overrides.atmosphere = {
      ...this.document.overrides.atmosphere,
      dayCycleSpeed
    }
    await this.commit(false)
  }

  async replace(document) {
    this.document = normalizeDocument(document)
    await this.commit(false)
  }

  async commit(regenerate) {
    if (regenerate) this.document.generated = deriveSettings(this.document.entries)
    if (regenerate) this.document.maze = mazeRecipe(this.document.entries, this.document.seed)
    this.settings = mergeSettings(this.document.generated, this.document.overrides)
    this.settings.maze = this.document.maze
    this.document.updatedAt = new Date().toISOString()
    await this.repository.save(this.document)
    for (const listener of this.listeners) listener(this.document)
  }

  dispose() {
    this.listeners.clear()
    this.repository.dispose()
  }
}

class WorldRepository {
  static open() {
    return new Promise((resolve) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME)
      }

      request.onsuccess = () => resolve(new WorldRepository(request.result))
      request.onerror = () => resolve(new MemoryRepository())
    })
  }

  constructor(database) {
    this.database = database
  }

  load() {
    return this.request('readonly', (store) => store.get(ACTIVE_WORLD))
  }

  save(document) {
    return this.request('readwrite', (store) => store.put(document, ACTIVE_WORLD))
  }

  request(mode, operation) {
    return new Promise((resolve, reject) => {
      const transaction = this.database.transaction(STORE_NAME, mode)
      const request = operation(transaction.objectStore(STORE_NAME))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onabort = () => reject(transaction.error || new Error('World save was aborted.'))
      transaction.onerror = () => reject(transaction.error)
      request.onerror = () => reject(request.error)
    })
  }

  dispose() {
    this.database.close()
  }
}

class MemoryRepository {
  load() {
    return Promise.resolve(null)
  }

  save() {
    return Promise.resolve()
  }

  dispose() {}
}

function createWorld() {
  const now = new Date().toISOString()
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] / UINT32_MAX

  return {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: GENERATOR_VERSION,
    name: 'The unformed place',
    seed,
    createdAt: now,
    updatedAt: now,
    entries: [],
    generated: structuredClone(baseSettings),
    overrides: {}
  }
}

export function normalizeDocument(document) {
  if (!document || typeof document !== 'object') throw new Error('The world document must be an object.')
  const needsRegeneration = document.generatorVersion !== GENERATOR_VERSION

  const world = {
    ...createWorld(),
    ...structuredClone(document),
    entries: Array.isArray(document.entries) ? document.entries : [],
    generated: mergeSettings(baseSettings, document.generated || {}),
    overrides: document.overrides && typeof document.overrides === 'object' ? document.overrides : {}
  }

  world.schemaVersion = SCHEMA_VERSION
  world.generatorVersion = GENERATOR_VERSION
  world.seed = clamp(Number(world.seed), 0, 1)
  world.maze = mazeRecipe(world.entries, world.seed)
  if (needsRegeneration) world.generated = deriveSettings(world.entries)
  return world
}

export function deriveSettings(entries) {
  if (!entries.length) return structuredClone(baseSettings)

  const contributions = entries.map((entry) => entry.contribution)
  const presence = 1 - Math.exp(-entries.length * ENTRY_PRESENCE_RATE)
  const colorPresence = clamp(presence * COLOR_PRESENCE_BOOST, 0, 1)
  const average = (path, fallback) => contributions.reduce((sum, item) => sum + readPath(item, path, fallback), 0) / contributions.length
  const averageOrganic = (path, legacyPath, fallback) => contributions.reduce((sum, item) => {
    return sum + readPath(item, path, readPath(item, legacyPath, fallback))
  }, 0) / contributions.length
  const expressive = (path, fallback) => {
    const values = contributions.map((item) => readPath(item, path, fallback))
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    const strongest = values.reduce((selected, value) => {
      return Math.abs(value - fallback) > Math.abs(selected - fallback) ? value : selected
    }, fallback)
    return mean + (strongest - mean) * EXPRESSIVE_BIAS
  }
  const boosted = (path, fallback, amount) => clamp(expressive(path, fallback) * amount, 0, 2)
  const boostedOrganic = (path, legacyPath, fallback, amount) => clamp(averageOrganic(path, legacyPath, fallback) * amount, 0, 2)

  return {
    terrain: {
      amplitude: mix(baseSettings.terrain.amplitude, boosted('terrain.amplitude', baseSettings.terrain.amplitude, 1.28), presence),
      roughness: mix(baseSettings.terrain.roughness, boosted('terrain.roughness', baseSettings.terrain.roughness, 1.3), presence),
      scale: mix(baseSettings.terrain.scale, average('terrain.scale'), presence)
    },
    atmosphere: {
      mist: mix(baseSettings.atmosphere.mist, average('atmosphere.mist'), presence),
      warmth: mix(baseSettings.atmosphere.warmth, average('atmosphere.warmth'), presence),
      daylight: mix(baseSettings.atmosphere.daylight, average('atmosphere.daylight'), presence),
      dayCycleSpeed: baseSettings.atmosphere.dayCycleSpeed,
      wind: mix(baseSettings.atmosphere.wind, average('atmosphere.wind'), presence),
      clouds: mix(baseSettings.atmosphere.clouds, boosted('atmosphere.clouds', baseSettings.atmosphere.clouds, 1.15), presence),
      weather: mix(baseSettings.atmosphere.weather, boosted('atmosphere.weather', baseSettings.atmosphere.weather, 1.32), presence),
      lightDrama: mix(baseSettings.atmosphere.lightDrama, boosted('atmosphere.lightDrama', baseSettings.atmosphere.lightDrama, 1.28), presence)
    },
    water: {
      level: mix(baseSettings.water.level, average('water.level'), presence)
    },
    generation: {
      psychedelicIntensity: mix(baseSettings.generation.psychedelicIntensity, boosted('generation.psychedelicIntensity', baseSettings.generation.psychedelicIntensity, 1.4), presence),
      mechanicalIntensity: mix(baseSettings.generation.mechanicalIntensity, boosted('generation.mechanicalIntensity', baseSettings.generation.mechanicalIntensity, 1.2), presence),
      ritualIntensity: mix(baseSettings.generation.ritualIntensity, boosted('generation.ritualIntensity', baseSettings.generation.ritualIntensity, 1.3), presence),
      mountains: mix(baseSettings.generation.mountains, boosted('generation.mountains', baseSettings.generation.mountains, 1.58), presence),
      folds: mix(baseSettings.generation.folds, boostedOrganic('generation.folds', 'generation.rings', baseSettings.generation.folds, 1.48), presence),
      valleys: mix(baseSettings.generation.valleys, boostedOrganic('generation.valleys', 'generation.structuralIntensity', baseSettings.generation.valleys, 1.22), presence),
      rivers: mix(baseSettings.generation.rivers, boostedOrganic('generation.rivers', 'generation.rings', baseSettings.generation.rivers, 1.34), presence),
      dunes: mix(baseSettings.generation.dunes, boostedOrganic('generation.dunes', 'generation.terraces', baseSettings.generation.dunes, 1.48), presence),
      forests: mix(baseSettings.generation.forests, boostedOrganic('generation.forests', 'generation.monoliths', baseSettings.generation.forests, 1.36), presence),
      succulents: mix(baseSettings.generation.succulents, boosted('generation.succulents', baseSettings.generation.succulents, 1.42), presence),
      shrubs: mix(baseSettings.generation.shrubs, boosted('generation.shrubs', baseSettings.generation.shrubs, 1.38), presence),
      structures: mix(baseSettings.generation.structures, boosted('generation.structures', baseSettings.generation.structures, 1.48), presence),
      sandyInteriors: mix(baseSettings.generation.sandyInteriors, boosted('generation.sandyInteriors', baseSettings.generation.sandyInteriors, 1.42), presence),
      ornateInteriors: mix(baseSettings.generation.ornateInteriors, boosted('generation.ornateInteriors', baseSettings.generation.ornateInteriors, 1.46), presence),
      abandonedInteriors: mix(baseSettings.generation.abandonedInteriors, boosted('generation.abandonedInteriors', baseSettings.generation.abandonedInteriors, 1.44), presence),
      ceilingVariation: mix(baseSettings.generation.ceilingVariation, boosted('generation.ceilingVariation', baseSettings.generation.ceilingVariation, 1.3), presence),
      grasses: mix(baseSettings.generation.grasses, boostedOrganic('generation.grasses', 'generation.terraces', baseSettings.generation.grasses, 1.24), presence),
      terraces: mix(baseSettings.generation.terraces, boosted('generation.terraces', baseSettings.generation.terraces, 1.32), presence),
      chromaticIntensity: mix(baseSettings.generation.chromaticIntensity, boosted('generation.chromaticIntensity', baseSettings.generation.chromaticIntensity, 1.32), presence)
    },
    palette: {
      ground: blendHex(baseSettings.palette.ground, contributions.map((item) => item.palette.ground), colorPresence),
      accent: blendHex(baseSettings.palette.accent, contributions.map((item) => item.palette.accent), colorPresence),
      sky: blendHex(baseSettings.palette.sky, contributions.map((item) => item.palette.sky), colorPresence)
    }
  }
}

export function mergeSettings(base, overrides) {
  const output = deepMerge(base, overrides)

  for (const [section, ranges] of Object.entries(settingRanges)) {
    for (const [name, [min, max]] of Object.entries(ranges)) {
      output[section][name] = clamp(Number(output[section][name]), min, max)
    }
  }

  return output
}

function deepMerge(base, overrides) {
  const output = structuredClone(base)

  for (const [key, value] of Object.entries(overrides || {})) {
    output[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? deepMerge(output[key] || {}, value)
      : value
  }

  return output
}

function readPath(value, path, fallback = 0) {
  return path.split('.').reduce((current, key) => current?.[key], value) ?? fallback
}

function blendHex(base, colors, amount) {
  const values = colors.map(hexToRgb)
  const average = values.reduce((sum, color) => sum.map((channel, index) => channel + color[index]), [0, 0, 0])
    .map((channel) => channel / values.length)
  const baseColor = hexToRgb(base)
  return rgbToHex(baseColor.map((channel, index) => mix(channel, average[index], amount)))
}

function hexToRgb(hex) {
  const value = String(hex).replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(value)) return [RGB_FALLBACK, RGB_FALLBACK, RGB_FALLBACK]
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16))
}

function rgbToHex(rgb) {
  return `#${rgb.map((channel) => Math.round(clamp(channel, 0, RGB_CHANNEL_MAX)).toString(16).padStart(2, '0')).join('')}`
}

function mix(a, b, amount) {
  return a + (b - a) * amount
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}
