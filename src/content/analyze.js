import {
  IMAGE_ALPHA_THRESHOLD,
  IMAGE_ANALYSIS_SIZE,
  MAX_AI_TEXT_LENGTH,
  PALETTE_COLOR_LIMIT,
  QUALITY_LABEL_LIMIT,
  TEXT_EXCERPT_LENGTH,
  TITLE_CHARACTER_LIMIT,
  TITLE_WORD_LIMIT,
  VISION_IMAGE_LIMIT,
  VISION_IMAGE_QUALITY
} from '../config/content.js'

const textTypes = new Set(['text/plain', 'text/markdown'])
const themeWords = {
  water: ['water', 'ocean', 'sea', 'river', 'rain', 'lake', 'tide', 'flow', 'blue'],
  growth: ['tree', 'forest', 'leaf', 'garden', 'grow', 'green', 'root', 'flower', 'moss'],
  stone: ['stone', 'mountain', 'wall', 'ground', 'home', 'old', 'earth', 'cliff'],
  sky: ['sky', 'air', 'cloud', 'light', 'open', 'bird', 'wind', 'star', 'moon'],
  warmth: ['warm', 'sun', 'gold', 'fire', 'love', 'joy', 'summer', 'bright'],
  shadow: ['dark', 'night', 'quiet', 'loss', 'winter', 'cold', 'shadow', 'still'],
  sand: ['sand', 'sandy', 'desert', 'dune', 'dust', 'ochre', 'dry', 'arid'],
  succulent: ['cactus', 'cacti', 'succulent', 'agave', 'aloe', 'yucca', 'saguaro', 'desert'],
  vivid: ['vivid', 'colorful', 'saturated', 'psychedelic', 'neon', 'iridescent', 'radiant', 'intense'],
  ornament: ['ornate', 'pattern', 'damask', 'velvet', 'baroque', 'eclectic', 'ceremony', 'decorative'],
  abandonment: ['abandoned', 'ruin', 'decay', 'empty', 'forgotten', 'derelict', 'urbex', 'rust'],
  urban: ['city', 'concrete', 'building', 'street', 'industrial', 'architecture', 'room', 'corridor', 'monumental', 'brutalist', 'cathedral', 'temple', 'liminal', 'interior']
}

export async function analyzeTransfer(transfer) {
  const files = [...transfer.files]

  if (files.length) {
    const entries = []
    for (const file of files) {
      if (file.type.startsWith('image/')) entries.push(await analyzeImage(file))
      else if (textTypes.has(file.type) || /\.(txt|md)$/i.test(file.name)) entries.push(await analyzeText(await file.text(), file.name))
    }
    return entries
  }

  const text = transfer.getData('text/plain').trim()
  return text ? [await analyzeText(text, titleFromText(text))] : []
}

async function analyzeImage(file) {
  const hash = await hashBlob(file)
  const bitmap = await createImageBitmap(file)
  const size = IMAGE_ANALYSIS_SIZE
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  canvas.width = size
  canvas.height = size
  context.drawImage(bitmap, 0, 0, size, size)
  const visionImage = createVisionImage(bitmap)
  bitmap.close()

  const pixels = context.getImageData(0, 0, size, size).data
  const bins = new Map()
  const luminance = new Float32Array(size * size)
  let brightness = 0
  let saturation = 0
  let warmth = 0
  let greenAffinity = 0
  let count = 0

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < IMAGE_ALPHA_THRESHOLD) continue
    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    const light = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255
    const high = Math.max(red, green, blue)
    const low = Math.min(red, green, blue)
    const key = `${red >> 4},${green >> 4},${blue >> 4}`
    bins.set(key, (bins.get(key) || 0) + 1)
    luminance[index / 4] = light
    brightness += light
    saturation += high ? (high - low) / high : 0
    warmth += (red - blue) / 255
    greenAffinity += Math.max(0, green - Math.max(red, blue)) / 255
    count++
  }

  brightness /= count
  saturation /= count
  warmth /= count
  greenAffinity /= count

  let variance = 0
  let edges = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x
      variance += (luminance[index] - brightness) ** 2
      if (x) edges += Math.abs(luminance[index] - luminance[index - 1])
      if (y) edges += Math.abs(luminance[index] - luminance[index - size])
    }
  }

  const contrast = Math.sqrt(variance / (size * size))
  const edgeDensity = edges / (size * size * 2)
  const colors = [...bins.entries()].sort((a, b) => b[1] - a[1]).slice(0, PALETTE_COLOR_LIMIT).map(([key]) => {
    const [red, green, blue] = key.split(',').map((value) => Number(value) * 16 + 8)
    return rgbToHex(red, green, blue)
  })
  const ground = colors[0] || '#9b9b92'
  const accent = colors.find((color) => colorDistance(color, ground) > 90) || colors[1] || lighten(ground, 0.22)
  const sky = mixColor(lighten(ground, 0.34), warmth < 0 ? '#799aaa' : '#a99b88', 0.35)
  const qualities = rankQualities({
    vivid: saturation,
    quiet: 1 - edgeDensity * 3,
    luminous: brightness,
    weathered: contrast * 2.5,
    warm: 0.5 + warmth,
    intricate: edgeDensity * 4
  })

  return createEntry(file.name, 'image', hash, qualities, {
    brightness: round(brightness),
    contrast: round(contrast),
    saturation: round(saturation),
    edgeDensity: round(edgeDensity),
    warmth: round(warmth),
    greenAffinity: round(greenAffinity),
    palette: colors
  }, {
    terrain: {
      amplitude: clamp(0.55 + contrast * 3.4, 0.35, 1.8),
      roughness: clamp(edgeDensity * 4.2, 0.05, 0.9),
      scale: clamp(1.18 - edgeDensity * 2.1, 0.4, 1.35)
    },
    atmosphere: {
      mist: clamp(0.62 - contrast * 1.8, 0.08, 0.75),
      warmth: clamp(warmth * 1.7, -0.8, 0.8),
      daylight: clamp(0.38 + brightness * 0.65, 0.25, 1),
      wind: clamp(edgeDensity * 3, 0.05, 0.8),
      clouds: clamp(0.18 + (1 - contrast) * 0.52 + edgeDensity, 0.1, 1.2),
      weather: clamp(edgeDensity * 2.4 + contrast * 1.2, 0.05, 1.25),
      lightDrama: clamp(contrast * 3.4 + saturation * 0.45, 0.12, 1.3)
    },
    water: {
      level: clamp(-0.95 + (1 - warmth) * 0.45, -1.25, 0.2)
    },
    generation: {
      psychedelicIntensity: clamp(0.25 + saturation * 1.25 + contrast, 0.2, 1.8),
      mechanicalIntensity: clamp(0.12 + edgeDensity * 3.2, 0.08, 1.35),
      ritualIntensity: clamp(0.28 + (1 - edgeDensity) * 0.45 + saturation * 0.45, 0.2, 1.4),
      mountains: clamp(0.25 + contrast * 3.2, 0.15, 1.7),
      folds: clamp(0.22 + edgeDensity * 3.5 + contrast, 0.12, 1.6),
      valleys: clamp(0.28 + contrast * 1.5 + (1 - edgeDensity * 3) * 0.35, 0.14, 1.5),
      rivers: clamp(0.18 + (0.45 - warmth) * 0.85 + brightness * 0.28, 0.08, 1.45),
      dunes: clamp(0.12 + (0.5 + warmth) * 0.7 + (1 - edgeDensity * 4) * 0.35, 0.06, 1.35),
      forests: clamp(0.1 + edgeDensity * 2.8 + (1 - brightness) * 0.55, 0.06, 1.45),
      succulents: clamp(0.18 + Math.max(0, warmth + 0.12) * 0.9 + (1 - edgeDensity * 3) * 0.28, 0.08, 1.55),
      shrubs: clamp(0.14 + greenAffinity * 5.5 + saturation * 0.38 + (1 - contrast) * 0.18, 0.08, 1.6),
      structures: clamp(0.12 + edgeDensity * 3.1 + contrast * 1.15, 0.08, 1.6),
      sandyInteriors: clamp(0.1 + Math.max(0, warmth) * 0.9 + (1 - saturation) * 0.24, 0.06, 1.35),
      ornateInteriors: clamp(0.08 + saturation * 0.78 + edgeDensity * 2.3, 0.05, 1.5),
      abandonedInteriors: clamp(0.1 + (1 - brightness) * 0.62 + contrast * 1.45, 0.06, 1.5),
      ceilingVariation: clamp(0.18 + edgeDensity * 2.5 + contrast * 0.72, 0.1, 1.55),
      grasses: clamp(0.2 + saturation * 0.5 + (1 - contrast) * 0.38, 0.12, 1.3),
      terraces: clamp(0.16 + (1 - edgeDensity * 3) * 0.62, 0.08, 1.25),
      chromaticIntensity: clamp(0.42 + saturation * 1.45 + contrast * 0.5, 0.32, 1.9)
    },
    palette: { ground, accent, sky }
  }, { type: 'image', image: visionImage })
}

async function analyzeText(text, name) {
  const normalized = text.toLowerCase()
  const words = normalized.match(/[\p{L}\p{N}'-]+/gu) || []
  const sentences = text.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean)
  const themes = Object.fromEntries(Object.entries(themeWords).map(([theme, vocabulary]) => [
    theme,
    vocabulary.reduce((score, word) => score + words.filter((candidate) => candidate === word).length, 0) / Math.max(words.length, 1)
  ]))
  const sentenceLengths = sentences.map((sentence) => sentence.split(/\s+/).length)
  const averageSentence = sentenceLengths.reduce((sum, length) => sum + length, 0) / Math.max(sentenceLengths.length, 1)
  const variation = Math.sqrt(sentenceLengths.reduce((sum, length) => sum + (length - averageSentence) ** 2, 0) / Math.max(sentenceLengths.length, 1))
  const density = clamp(words.length / 500, 0, 1)
  const structure = clamp(variation / 18, 0, 1)
  const semanticTotal = Object.values(themes).reduce((sum, value) => sum + value, 0) || 1
  const water = themes.water / semanticTotal
  const growth = themes.growth / semanticTotal
  const stone = themes.stone / semanticTotal
  const sky = themes.sky / semanticTotal
  const sand = themes.sand / semanticTotal
  const succulent = themes.succulent / semanticTotal
  const vivid = themes.vivid / semanticTotal
  const warmth = themes.warmth / semanticTotal - themes.shadow / semanticTotal
  const hue = (await hashText(text)).slice(0, 6)
  const hashedColor = `#${hue}`
  const ground = mixColor('#98978e', hashedColor, 0.42)
  const accent = mixColor(hashedColor, warmth >= 0 ? '#d1a164' : '#7897b1', 0.4)
  const skyBase = mixColor('#839ba4', sky > growth ? '#8aa8bd' : '#8fa28e', 0.5)
  const skyColor = mixColor(skyBase, hashedColor, 0.28 + Math.min(0.22, vivid * 0.6))
  const qualities = rankQualities({
    flowing: water * 8,
    rooted: (growth + stone) * 5,
    open: sky * 8,
    warm: 0.5 + warmth,
    layered: density,
    irregular: structure
  })
  const hash = await hashText(text)

  return createEntry(name, 'text', hash, qualities, {
    excerpt: text.slice(0, TEXT_EXCERPT_LENGTH),
    words: words.length,
    sentences: sentences.length,
    averageSentence: round(averageSentence),
    variation: round(variation),
    themes: Object.fromEntries(Object.entries(themes).map(([key, value]) => [key, round(value)]))
  }, {
    terrain: {
      amplitude: clamp(0.58 + stone * 2.7 + structure * 0.45, 0.4, 1.9),
      roughness: clamp(0.1 + structure * 0.65 + density * 0.15, 0.05, 0.9),
      scale: clamp(1.15 - density * 0.55 - stone * 0.5, 0.4, 1.4)
    },
    atmosphere: {
      mist: clamp(0.25 + themes.shadow * 5 + water * 0.25, 0.08, 0.8),
      warmth: clamp(warmth * 2.5, -0.85, 0.85),
      daylight: clamp(0.68 + warmth * 0.35 - themes.shadow * 2, 0.25, 1),
      wind: clamp(0.1 + sky * 0.8 + structure * 0.3, 0.05, 0.9),
      clouds: clamp(0.2 + water * 0.7 + themes.shadow * 4 + sky * 0.3, 0.1, 1.25),
      weather: clamp(0.08 + water * 1.2 + themes.shadow * 5 + structure * 0.4, 0.05, 1.3),
      lightDrama: clamp(0.2 + Math.abs(warmth) * 1.3 + structure * 0.65, 0.12, 1.35)
    },
    water: {
      level: clamp(-0.9 + water * 2.2, -1.2, 0.65)
    },
    generation: {
      psychedelicIntensity: clamp(0.25 + structure * 0.9 + Math.abs(warmth), 0.2, 1.7),
      mechanicalIntensity: clamp(0.1 + structure * 0.8 + themes.stone * 5 + themes.urban * 5.2, 0.08, 1.4),
      ritualIntensity: clamp(0.35 + density * 0.45 + (growth + stone + themes.shadow / semanticTotal) * 1.4 + themes.ornament * 3.2, 0.25, 1.7),
      mountains: clamp(0.2 + stone * 2.2 + themes.shadow * 3, 0.12, 1.65),
      folds: clamp(0.18 + structure * 0.72 + stone * 1.4, 0.1, 1.5),
      valleys: clamp(0.2 + water * 1.1 + themes.shadow * 3.5, 0.1, 1.45),
      rivers: clamp(0.1 + water * 3.1 + growth * 0.5, 0.06, 1.65),
      dunes: clamp(0.08 + warmth * 0.8 + sky * 0.5 + sand * 4.2, 0.05, 1.55),
      forests: clamp(0.08 + growth * 3.2 + themes.shadow * 2.2, 0.05, 1.65),
      succulents: clamp(0.08 + succulent * 8.5 + sand * 2.8 + Math.max(0, warmth) * 0.5, 0.04, 1.8),
      shrubs: clamp(0.1 + growth * 3.8 + themes.shadow * 1.2, 0.05, 1.75),
      structures: clamp(0.1 + stone * 2.8 + themes.urban * 7.5 + themes.ornament * 2 + themes.abandonment * 2.5 + structure * 0.9 + density * 0.35, 0.08, 1.7),
      sandyInteriors: clamp(0.08 + themes.sand * 7 + Math.max(0, warmth) * 0.52, 0.05, 1.65),
      ornateInteriors: clamp(0.08 + themes.ornament * 7 + structure * 0.42, 0.05, 1.7),
      abandonedInteriors: clamp(0.1 + themes.abandonment * 7 + themes.urban * 2.2 + themes.shadow * 2.4, 0.06, 1.75),
      ceilingVariation: clamp(0.18 + structure * 0.72 + themes.urban * 2.5 + density * 0.3, 0.1, 1.65),
      grasses: clamp(0.14 + growth * 2.2 + sky * 0.5, 0.08, 1.5),
      terraces: clamp(0.12 + density * 0.7 + stone * 1.1, 0.08, 1.4),
      chromaticIntensity: clamp(0.38 + vivid * 7.5 + structure * 0.45 + Math.abs(warmth) * 0.5, 0.3, 1.9)
    },
    palette: { ground, accent, sky: skyColor }
  }, { type: 'text', text: text.slice(0, MAX_AI_TEXT_LENGTH) })
}

function createEntry(name, type, hash, qualities, analysis, contribution, aiInput) {
  const now = new Date().toISOString()
  const entry = {
    id: crypto.randomUUID(),
    source: {
      key: `${type}:${name}`,
      type,
      name,
      hash
    },
    analysis,
    qualities,
    contribution,
    createdAt: now,
    updatedAt: now
  }
  Object.defineProperty(entry, 'aiInput', { value: aiInput })
  return entry
}

function createVisionImage(bitmap) {
  const limit = VISION_IMAGE_LIMIT
  const scale = Math.min(1, limit / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', VISION_IMAGE_QUALITY)
}

async function hashBlob(blob) {
  return toHex(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))
}

async function hashText(text) {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function rankQualities(values) {
  return Object.entries(values).sort((a, b) => b[1] - a[1]).slice(0, QUALITY_LABEL_LIMIT).map(([quality]) => quality)
}

function titleFromText(text) {
  const words = text.trim().split(/\s+/).slice(0, TITLE_WORD_LIMIT).join(' ')
  return words.length > TITLE_CHARACTER_LIMIT ? `${words.slice(0, TITLE_CHARACTER_LIMIT)}…` : words
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`
}

function colorDistance(first, second) {
  const a = hexToRgb(first)
  const b = hexToRgb(second)
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function mixColor(first, second, amount) {
  const a = hexToRgb(first)
  const b = hexToRgb(second)
  return rgbToHex(...a.map((channel, index) => channel + (b[index] - channel) * amount))
}

function lighten(color, amount) {
  return mixColor(color, '#ffffff', amount)
}

function hexToRgb(hex) {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16))
}

function round(value) {
  return Math.round(value * 1000) / 1000
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
