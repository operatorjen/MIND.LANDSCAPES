import { MAX_INTERPRETATION_SUMMARY_LENGTH, QUALITY_LABEL_LIMIT } from '../config/content.js'

const moodNames = [
  'serene', 'ominous', 'radiant', 'nocturnal', 'organic', 'arid', 'aquatic',
  'monumental', 'ornate', 'antique', 'industrial', 'abandoned', 'ritual', 'surreal', 'turbulent'
]

export async function enhanceEntriesWithAI(entries) {
  const analyzable = entries.filter((entry) => entry.aiInput)
  if (!analyzable.length) return { entries, usedAI: false }

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: analyzable.map((entry) => ({
          key: entry.source.key,
          name: entry.source.name,
          type: entry.aiInput.type,
          text: entry.aiInput.text,
          image: entry.aiInput.image,
          localAnalysis: entry.analysis
        }))
      })
    })

    if (!response.ok) return { entries, usedAI: false }
    const payload = await response.json()
    const interpretations = new Map((payload.items || []).map((item) => [item.key, item]))
    let interpreted = 0

    for (const entry of entries) {
      const interpretation = interpretations.get(entry.source.key)
      if (!interpretation) continue
      applyMoodInterpretation(entry, interpretation, payload.model)
      interpreted++
    }

    return { entries, usedAI: interpreted > 0, model: payload.model }
  } catch {
    return { entries, usedAI: false }
  }
}

export function applyMoodInterpretation(entry, interpretation, model = 'openai') {
  const mood = Object.fromEntries(moodNames.map((name) => [name, clamp(Number(interpretation.moods?.[name]) || 0, 0, 1)]))
  const generation = entry.contribution.generation
  const atmosphere = entry.contribution.atmosphere
  const terrain = entry.contribution.terrain
  const palette = interpretation.palette || {}

  terrain.amplitude = blend(terrain.amplitude, 0.45 + mood.monumental * 1.5 + mood.ominous * 0.35, 0.5, 0.3, 2.1)
  terrain.roughness = blend(terrain.roughness, 0.08 + mood.turbulent * 0.5 + mood.industrial * 0.2, 0.42, 0.04, 0.92)
  terrain.scale = blend(terrain.scale, 1.25 - mood.monumental * 0.62 - mood.surreal * 0.18, 0.4, 0.35, 1.45)

  atmosphere.mist = blend(atmosphere.mist, 0.12 + mood.serene * 0.38 + mood.nocturnal * 0.2, 0.48, 0.05, 0.9)
  atmosphere.warmth = blend(atmosphere.warmth, mood.radiant * 0.82 + mood.arid * 0.28 - mood.nocturnal * 0.72, 0.55, -0.9, 0.9)
  atmosphere.daylight = blend(atmosphere.daylight, 0.32 + mood.radiant * 0.62 - mood.nocturnal * 0.24, 0.52, 0.18, 1)
  atmosphere.wind = blend(atmosphere.wind, 0.06 + mood.ominous * 0.42 + mood.aquatic * 0.18, 0.4, 0.04, 0.9)
  atmosphere.clouds = blend(atmosphere.clouds, 0.12 + mood.ominous * 0.72 + mood.aquatic * 0.32, 0.46, 0.08, 1.3)
  atmosphere.weather = blend(atmosphere.weather, 0.06 + mood.ominous * 0.82 + mood.nocturnal * 0.2, 0.48, 0.04, 1.35)
  atmosphere.lightDrama = blend(atmosphere.lightDrama, 0.16 + mood.radiant * 0.46 + mood.ominous * 0.62 + mood.ritual * 0.28, 0.56, 0.08, 1.45)

  entry.contribution.water.level = blend(entry.contribution.water.level, -1.05 + mood.aquatic * 1.35, 0.35, -1.25, 0.55)
  generation.psychedelicIntensity = blend(generation.psychedelicIntensity, 0.12 + mood.surreal * 1.5 + mood.ritual * 0.28, 0.62, 0.08, 1.85)
  generation.mechanicalIntensity = blend(generation.mechanicalIntensity, 0.05 + mood.industrial * 1.35 + mood.monumental * 0.2, 0.58, 0.04, 1.65)
  generation.ritualIntensity = blend(generation.ritualIntensity, 0.1 + mood.ritual * 1.25 + mood.antique * 0.28, 0.6, 0.08, 1.75)
  generation.mountains = blend(generation.mountains, 0.08 + mood.monumental * 1.42 + mood.ominous * 0.28, 0.54, 0.06, 1.75)
  generation.folds = blend(generation.folds, 0.12 + mood.surreal * 0.82 + mood.monumental * 0.42, 0.48, 0.08, 1.65)
  generation.valleys = blend(generation.valleys, 0.1 + mood.serene * 0.52 + mood.ominous * 0.38, 0.42, 0.06, 1.5)
  generation.rivers = blend(generation.rivers, 0.06 + mood.aquatic * 1.5 + mood.organic * 0.18, 0.56, 0.04, 1.7)
  generation.dunes = blend(generation.dunes, 0.04 + mood.arid * 1.55 + mood.serene * 0.12, 0.58, 0.03, 1.6)
  generation.forests = blend(generation.forests, 0.04 + mood.organic * 1.55 + mood.antique * 0.12, 0.58, 0.03, 1.7)
  generation.succulents = blend(generation.succulents, 0.04 + mood.arid * 1.65 + mood.organic * 0.3, 0.7, 0.03, 1.9)
  generation.shrubs = blend(generation.shrubs, 0.05 + mood.organic * 1.58 + mood.serene * 0.22, 0.66, 0.03, 1.9)
  generation.structures = blend(generation.structures, 0.08 + mood.monumental * 1.15 + mood.industrial * 0.5 + mood.ritual * 0.2, 0.6, 0.05, 1.75)
  generation.sandyInteriors = blend(generation.sandyInteriors, 0.04 + mood.arid * 1.58 + mood.antique * 0.18, 0.68, 0.03, 1.8)
  generation.ornateInteriors = blend(generation.ornateInteriors, 0.04 + mood.ornate * 1.18 + mood.antique * 0.58 + mood.ritual * 0.22, 0.72, 0.03, 1.9)
  generation.abandonedInteriors = blend(generation.abandonedInteriors, 0.04 + mood.abandoned * 1.28 + mood.industrial * 0.48 + mood.ominous * 0.18, 0.72, 0.03, 1.9)
  generation.ceilingVariation = blend(generation.ceilingVariation, 0.18 + mood.monumental * 0.5 + mood.ornate * 0.42 + mood.abandoned * 0.48, 0.6, 0.08, 1.7)
  generation.grasses = blend(generation.grasses, 0.08 + mood.organic * 1.22 + mood.serene * 0.22, 0.48, 0.05, 1.5)
  generation.terraces = blend(generation.terraces, 0.08 + mood.monumental * 0.58 + mood.arid * 0.36, 0.42, 0.05, 1.4)
  generation.chromaticIntensity = blend(generation.chromaticIntensity, 0.42 + mood.surreal * 1.12 + mood.radiant * 0.72 + mood.ritual * 0.28, 0.7, 0.28, 2)

  entry.contribution.palette = {
    ground: blendColor(entry.contribution.palette.ground, validColor(palette.ground, entry.contribution.palette.ground), 0.68),
    accent: blendColor(entry.contribution.palette.accent, validColor(palette.accent, entry.contribution.palette.accent), 0.78),
    sky: blendColor(entry.contribution.palette.sky, validColor(palette.sky, entry.contribution.palette.sky), 0.7)
  }
  entry.analysis.interpretation = {
    source: 'openai',
    model,
    summary: String(interpretation.summary || '').slice(0, MAX_INTERPRETATION_SUMMARY_LENGTH),
    moods: mood
  }
  entry.qualities = Object.entries(mood).sort((a, b) => b[1] - a[1]).slice(0, QUALITY_LABEL_LIMIT).map(([name]) => name)
  return entry
}

function blend(current, target, amount, min, max) {
  return clamp(current + (target - current) * amount, min, max)
}

function blendColor(first, second, amount) {
  const a = hexToRgb(first)
  const b = hexToRgb(second)
  return rgbToHex(...a.map((channel, index) => channel + (b[index] - channel) * amount))
}

function hexToRgb(hex) {
  const value = validColor(hex, '#808080').slice(1)
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16))
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`
}

function validColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value.toLowerCase() : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
