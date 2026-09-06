import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deriveSettings,
  mergeSettings,
  normalizeDocument
} from '../src/world/world-state.js'

const contribution = {
  terrain: {
    amplitude: 1.7,
    roughness: 0.72,
    scale: 0.48
  },
  atmosphere: {
    mist: 0.64,
    warmth: -0.35,
    daylight: 0.42,
    wind: 0.7,
    clouds: 1.1,
    weather: 0.9,
    lightDrama: 1.2
  },
  water: {
    level: 0.2
  },
  generation: {
    psychedelicIntensity: 1.4,
    mechanicalIntensity: 1.2,
    ritualIntensity: 0.9,
    mountains: 1.6,
    folds: 1.1,
    valleys: 0.8,
    rivers: 1.3,
    dunes: 0.7,
    forests: 1.5,
    succulents: 0.6,
    shrubs: 1.2,
    structures: 1.7,
    sandyInteriors: 0.5,
    ornateInteriors: 1.6,
    abandonedInteriors: 0.4,
    ceilingVariation: 1.3,
    grasses: 1.1,
    terraces: 0.7,
    chromaticIntensity: 1.8
  },
  palette: {
    ground: '#402030',
    accent: '#ef9320',
    sky: '#283080'
  }
}

test('world settings derive deterministically from the same influences', () => {
  const entries = [{ contribution }, { contribution: structuredClone(contribution) }]

  assert.deepEqual(deriveSettings(entries), deriveSettings(structuredClone(entries)))
})

test('empty influences restore independent base settings', () => {
  const first = deriveSettings([])
  const second = deriveSettings([])

  first.terrain.amplitude = 99
  assert.notEqual(first.terrain.amplitude, second.terrain.amplitude)
  assert.equal(second.terrain.amplitude, 0.92)
})

test('settings overrides merge deeply and clamp supported ranges', () => {
  const base = deriveSettings([])
  const merged = mergeSettings(base, {
    terrain: { amplitude: 99 },
    atmosphere: { warmth: -99, dayCycleSpeed: 2.5 },
    generation: { structures: Number.NaN },
    palette: { accent: '#ff00aa' }
  })

  assert.equal(merged.terrain.amplitude, 2.5)
  assert.equal(merged.terrain.roughness, base.terrain.roughness)
  assert.equal(merged.atmosphere.warmth, -1)
  assert.equal(merged.atmosphere.dayCycleSpeed, 2.5)
  assert.equal(merged.generation.structures, 0)
  assert.equal(merged.palette.accent, '#ff00aa')
})

test('document normalization repairs schema fields and preserves overrides', () => {
  const normalized = normalizeDocument({
    schemaVersion: 0,
    generatorVersion: 'outdated',
    seed: 4,
    entries: 'invalid',
    overrides: { atmosphere: { dayCycleSpeed: 3 } }
  })

  assert.equal(normalized.schemaVersion, 3)
  assert.equal(normalized.generatorVersion, '0.10.0')
  assert.equal(normalized.seed, 1)
  assert.deepEqual(normalized.entries, [])
  assert.deepEqual(normalized.overrides, { atmosphere: { dayCycleSpeed: 3 } })
  assert.deepEqual(normalized.generated, deriveSettings([]))
})

test('batch imports preserve sequential world results with one save and notification', async () => {
  const { WorldState } = await import('../src/world/world-state.js')
  let saves = 0, notifications = 0
  const repository = { save: async () => { saves++ }, dispose() {} }
  const document = normalizeDocument({ seed: 0.314159, entries: [] })
  const batched = new WorldState(repository, document)
  const sequential = new WorldState({ save: async () => {}, dispose() {} }, document)
  batched.subscribe(() => { notifications++ })
  const entry = (key, id) => ({ id, createdAt: '2026-01-01', source: { key, hash: key }, contribution: deriveSettings([]) })
  const entries = [entry('a', 'first-a'), entry('b', 'b'), entry('a', 'second-a')]
  await batched.addOrReplaceMany(entries)
  for (const value of entries) await sequential.addOrReplace(value)
  assert.equal(saves, 1)
  assert.equal(notifications, 2)
  assert.deepEqual(batched.document.generated, sequential.document.generated)
  assert.deepEqual(batched.document.maze, sequential.document.maze)
  assert.deepEqual(batched.document.entries.map(({ updatedAt, ...entry }) => entry), sequential.document.entries.map(({ updatedAt, ...entry }) => entry))
  assert.equal(batched.document.entries[0].id, 'first-a')
})
