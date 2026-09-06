import * as THREE from 'three'
import { Landscape } from '../../src/render/landscape.js'
import { QUALITY_PROFILES } from '../../src/config/rendering.js'
import { raymarchGlsl } from '../../src/render/glsl/raymarch.glsl.js'
import { deriveSettings } from '../../src/world/world-state.js'
import { previousMain, previousRaymarch } from './previous-rendering.js'

const parameters = new URLSearchParams(location.search)
const width = Number(parameters.get('width')) || 64
const height = Number(parameters.get('height')) || 40
const level = parameters.get('level') || 'medium'
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('canvas'), antialias: false, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(width, height, false)
renderer.outputColorSpace = THREE.SRGBColorSpace
const errors = []
renderer.debug.onShaderError = (gl, program, vertex, fragment) => errors.push(gl.getShaderInfoLog(fragment))
const settings = deriveSettings([])
settings.generation.forests = 2
settings.generation.shrubs = 1.25
settings.generation.grasses = 1.5
const fixtures = [
  { name: 'shoreline', position: [0, 4.2, 8], target: [0, 0.4, -28], water: 0.2 },
  { name: 'water', position: [0, 6, 8], target: [0, 0, -8], water: 3 },
  { name: 'forest', position: [8, 3.7, 10], target: [1, 3.2, -20], water: -2.5 },
  { name: 'sky', position: [0, 4.2, 8], target: [0, 20, -28], water: 0.2 },
  { name: 'below-water', position: [0, -1, 8], target: [0, -2, -28], water: 3 }
]
const comparisons = []
try {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(70, width / height, 0.05, 900)
  const landscape = new Landscape(scene, camera, settings, 0.731, { ...QUALITY_PROFILES[level], level })
  landscape.setResolution(width, height)
  const optimized = landscape.mesh.material
  if (parameters.has('without-art')) {
    optimized.fragmentShader = optimized.fragmentShader.replace('surface = personalArt(surface, position, normal, material);', '')
  }
  const previous = optimized.clone()
  previous.uniforms = optimized.uniforms
  const mainStart = optimized.fragmentShader.lastIndexOf('  void main()')
  previous.fragmentShader = optimized.fragmentShader.slice(0, mainStart).replace(raymarchGlsl, previousRaymarch)
    + previousMain.replace('normalize(vWorldPosition - cameraPosition)', 'cameraRayDirection()')
  for (const fixture of fixtures) {
    settings.water.level = fixture.water
    landscape.applySettings(settings, 0.731)
    landscape.update(3.4, 100)
    camera.position.fromArray(fixture.position)
    camera.lookAt(...fixture.target)
    camera.updateMatrixWorld()
    landscape.update(3.4, 0)
    const renderPixels = (material) => {
      landscape.mesh.material = material
      renderer.render(scene, camera)
      const gl = renderer.getContext()
      const pixels = new Uint8Array(width * height * 4)
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      return pixels
    }
    const before = renderPixels(previous)
    const after = renderPixels(optimized)
    let total = 0
    let max = 0
    for (let i = 0; i < before.length; i++) {
      const delta = Math.abs(before[i] - after[i])
      total += delta
      max = Math.max(max, delta)
    }
    const mean = total / before.length
    comparisons.push({ name: fixture.name, mean, max, passed: mean <= 0.1 && max <= 8 })
  }
  previous.dispose()
  landscape.dispose()
  finish({ passed: !errors.length && comparisons.every(({ passed }) => passed), width, height, level, comparisons, errors })
} catch (error) {
  finish({ passed: false, errors: [...errors, error.stack || error.message] })
} finally {
  renderer.dispose()
}
function finish(result) {
  window.__renderTestResult = result
  document.querySelector('#result').textContent = JSON.stringify(result)
  document.title = result.passed ? 'PASS' : 'FAIL'
}
