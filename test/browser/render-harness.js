import * as THREE from 'three'
import { QUALITY_LEVELS, QUALITY_PROFILES } from '../../src/config/rendering.js'
import { Landscape } from '../../src/render/landscape.js'
import { deriveSettings } from '../../src/world/world-state.js'
import { structureLayout } from '../../src/world/spatial-layout.js'
import { visualBaselines } from './visual-baselines.js'

const WIDTH = 20
const HEIGHT = 12
const COLUMNS = 5
const ROWS = 3
const MAX_MEAN_DELTA = 8
const MAX_CHANNEL_DELTA = 38
const SEED = 0.314159
const parameters = new URLSearchParams(location.search)
const requestedLevel = parameters.get('level')
const includeVisuals = parameters.has('visual')

const canvas = document.querySelector('#render-target')
const resultNode = document.querySelector('#result')
const errors = []
let renderer

try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setPixelRatio(1)
  renderer.setSize(WIDTH, HEIGHT, false)
  renderer.debug.onShaderError = (_, __, vertexShader, fragmentShader) => {
    const gl = renderer.getContext()
    errors.push(`${gl.getShaderInfoLog(vertexShader) || ''}\n${gl.getShaderInfoLog(fragmentShader) || ''}`.trim())
  }

  const levels = QUALITY_LEVELS.includes(requestedLevel) ? [requestedLevel] : QUALITY_LEVELS
  const compiled = levels.map(compileQuality)
  const signatures = includeVisuals ? Object.fromEntries([
    renderScene('terrain', terrainScene()),
    renderScene('forest', forestScene()),
    renderScene('architecture', architectureScene())
  ]) : {}
  const comparisons = Object.fromEntries(Object.entries(signatures).map(([name, signature]) => [
    name,
    compareSignature(signature, visualBaselines[name])
  ]))
  const update = parameters.has('update')
  const passed = errors.length === 0
    && compiled.every(({ programs }) => programs > 0)
    && (!includeVisuals || update || Object.values(comparisons).every(({ passed: comparisonPassed }) => comparisonPassed))
  finish({ passed, compiled, errors, signatures, comparisons })
} catch (error) {
  finish({ passed: false, errors: [...errors, error.stack || error.message] })
} finally {
  renderer?.dispose()
}

function compileQuality(level) {
  const scene = new THREE.Scene()
  const camera = createCamera([0, 4, 8], [0, 1, -20])
  const settings = terrainScene().settings
  const landscape = new Landscape(scene, camera, settings, SEED, quality(level))
  landscape.setResolution(WIDTH, HEIGHT)
  landscape.update(1.25, 0)
  renderer.compile(scene, camera)
  const programs = renderer.info.programs?.length || 0
  landscape.dispose()
  return { level, programs }
}

function renderScene(name, fixture) {
  const scene = new THREE.Scene()
  const camera = createCamera(fixture.position, fixture.target)
  const landscape = new Landscape(scene, camera, fixture.settings, fixture.seed, visualQuality())
  landscape.setResolution(WIDTH, HEIGHT)
  landscape.update(fixture.time, 0)
  renderer.render(scene, camera)
  const context = renderer.getContext()
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4)
  context.readPixels(0, 0, WIDTH, HEIGHT, context.RGBA, context.UNSIGNED_BYTE, pixels)
  landscape.dispose()
  return [name, signatureForPixels(pixels)]
}

function terrainScene() {
  const settings = structuredClone(deriveSettings([]))
  settings.generation.structures = 0
  settings.generation.forests = 0.15
  settings.generation.shrubs = 0.1
  settings.generation.grasses = 0.4
  return { settings, seed: SEED, time: 1.25, position: [0, 4.2, 8], target: [0, 0.4, -28] }
}

function forestScene() {
  const settings = structuredClone(deriveSettings([]))
  settings.generation.structures = 0
  settings.generation.forests = 2
  settings.generation.shrubs = 1.25
  settings.generation.grasses = 1.5
  return { settings, seed: 0.731, time: 3.4, position: [8, 3.7, 10], target: [1, 3.2, -20] }
}

function architectureScene() {
  const settings = structuredClone(deriveSettings([]))
  settings.water.level = -2.5
  settings.generation.structures = 2
  settings.generation.mechanicalIntensity = 1
  settings.generation.ritualIntensity = 1
  settings.generation.forests = 0.2
  const seed = 0.527
  const layout = findStructure(settings, seed)
  const front = structurePoint(layout, 0, layout.depth * 0.5 + 8)
  const target = structurePoint(layout, 0, 0)
  return {
    settings,
    seed,
    time: 2.1,
    position: [front.x, layout.ground + 4.2, front.z],
    target: [target.x, layout.ground + 4.6, target.z]
  }
}

function findStructure(settings, seed) {
  for (let radius = 0; radius <= 5; radius++) {
    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        const layout = structureLayout(x, z, settings, seed)
        if (layout) return layout
      }
    }
  }
  throw new Error('No deterministic architecture fixture found')
}

function structurePoint(layout, x, z) {
  const cosine = Math.cos(layout.angle)
  const sine = Math.sin(layout.angle)
  return {
    x: layout.centerX + cosine * x - sine * z,
    z: layout.centerZ + sine * x + cosine * z
  }
}

function createCamera(position, target) {
  const camera = new THREE.PerspectiveCamera(70, WIDTH / HEIGHT, 0.05, 900)
  camera.position.fromArray(position)
  camera.lookAt(...target)
  camera.updateMatrixWorld()
  return camera
}

function quality(level) {
  return { ...QUALITY_PROFILES[level], level, mode: level, reducedMotion: false }
}

function visualQuality() {
  return { ...quality('low'), raySteps: 20, viewDistance: 72, detailScale: 0.68 }
}

function signatureForPixels(pixels) {
  const signature = []
  for (let row = 0; row < ROWS; row++) {
    const yStart = Math.floor(row * HEIGHT / ROWS)
    const yEnd = Math.floor((row + 1) * HEIGHT / ROWS)
    for (let column = 0; column < COLUMNS; column++) {
      const xStart = Math.floor(column * WIDTH / COLUMNS)
      const xEnd = Math.floor((column + 1) * WIDTH / COLUMNS)
      const sum = [0, 0, 0]
      let count = 0
      for (let y = yStart; y < yEnd; y++) {
        for (let x = xStart; x < xEnd; x++) {
          const offset = (y * WIDTH + x) * 4
          sum[0] += pixels[offset]
          sum[1] += pixels[offset + 1]
          sum[2] += pixels[offset + 2]
          count++
        }
      }
      signature.push(...sum.map((value) => Math.round(value / count)))
    }
  }
  return signature
}

function compareSignature(actual, expected) {
  if (!expected) return { passed: false, meanDelta: null, maxDelta: null }
  const deltas = actual.map((value, index) => Math.abs(value - expected[index]))
  const meanDelta = deltas.reduce((sum, value) => sum + value, 0) / deltas.length
  const maxDelta = Math.max(...deltas)
  return {
    passed: meanDelta <= MAX_MEAN_DELTA && maxDelta <= MAX_CHANNEL_DELTA,
    meanDelta,
    maxDelta
  }
}

function finish(result) {
  window.__renderTestResult = result
  resultNode.textContent = JSON.stringify(result)
  document.title = result.passed ? 'PASS' : 'FAIL'
}
