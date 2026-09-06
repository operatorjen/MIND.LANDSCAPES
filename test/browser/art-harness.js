import * as THREE from 'three'
import { Landscape } from '../../src/render/landscape.js'
import { QUALITY_PROFILES } from '../../src/config/rendering.js'
import { deriveSettings } from '../../src/world/world-state.js'
import { structureLayout } from '../../src/world/spatial-layout.js'
import { mazeRecipe, mazeForLayout } from '../../src/world/maze.js'
import { buildArtPack, artStorage } from '../../src/art/library.js'

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('canvas'), preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(96, 64, false)
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, 1.5, 0.05, 900)
const settings = deriveSettings([]), seed = 0.314159
settings.water.level = -2.5
settings.generation.structures = 2
settings.generation.mechanicalIntensity = 1
settings.generation.ritualIntensity = 1
settings.maze = mazeRecipe([], seed)
const layout = structureLayout(-3, -3, settings, seed)
const landscape = new Landscape(scene, camera, settings, seed, { ...QUALITY_PROFILES.low, level: 'low' })
const errors = []
renderer.debug.onShaderError = (gl, program, vertex, fragment) => errors.push(gl.getShaderInfoLog(fragment))
const gl = renderer.getContext()
const original = landscape.mesh.material
let previous
try {
  const image = document.createElement('canvas')
  image.width = image.height = 256
  const ctx = image.getContext('2d')
  ctx.fillStyle = '#ff397e'
  ctx.beginPath(); ctx.arc(128, 128, 95, 0, Math.PI * 2); ctx.fill()
  ctx.clearRect(90, 65, 76, 126)
  ctx.fillStyle = '#64ffce'; ctx.fillRect(104, 82, 48, 92)
  const png = await new Promise(resolve => image.toBlob(resolve))
  const pack = await buildArtPack([new File([png], 'transparent-test.png', { type: 'image/png' })])
  pack.density = 1
  const bitmap = await createImageBitmap(pack.blob)
  const check = document.createElement('canvas'); check.width = bitmap.width; check.height = bitmap.height
  const checkCtx = check.getContext('2d'); checkCtx.drawImage(bitmap, 0, 0); bitmap.close()
  if (checkCtx.getImageData(10, 10, 1, 1).data[3] !== 0 || checkCtx.getImageData(128, 128, 1, 1).data[3] !== 255) throw new Error('PNG alpha was not preserved')
  previous = await artStorage('get')
  await artStorage('put', pack)
  const reloaded = await artStorage('get')
  if (reloaded.names[0] !== 'transparent-test.png' || reloaded.blob.size !== pack.blob.size) throw new Error('Art did not persist')
  await landscape.artAtlas.setPack(reloaded)
  const world = (x, z, y = layout.ground - 3.78) => new THREE.Vector3(layout.centerX + Math.cos(layout.angle) * x - Math.sin(layout.angle) * z, y, layout.centerZ + Math.sin(layout.angle) * x + Math.cos(layout.angle) * z)
  camera.position.copy(world(0, -layout.depth * 0.3)); camera.lookAt(world(1, -layout.depth * 0.3)); camera.updateMatrixWorld()
  landscape.update(1.25, 0)
  const probe = original.clone()
  probe.uniforms = { ...original.uniforms, uProbeMaterial: { value: 4 }, uProbeFloor: { value: 0 } }
  probe.fragmentShader = original.fragmentShader.slice(0, original.fragmentShader.lastIndexOf('  void main()')) + `
    uniform float uProbeMaterial;
    uniform float uProbeFloor;
    void main() {
      vec2 uv = gl_FragCoord.xy / vec2(96.0, 64.0);
      vec2 local = vec2(0.0, -${layout.depth} * 0.5 + (uv.x - 0.5) * 10.8);
      vec2 planar = rotate2(-${layout.angle}) * local;
      vec3 position = vec3(${layout.centerX} + planar.x, ${layout.ground} - UNDERGROUND_DESCENT + uv.y * 3.2, ${layout.centerZ} + planar.y);
      vec2 n = rotate2(-${layout.angle}) * vec2(1.0, 0.0);
      vec3 normal = uProbeFloor > 0.5 ? vec3(0.0, 1.0, 0.0) : vec3(n.x, 0.0, n.y);
      gl_FragColor = vec4(personalArt(vec3(0.2), position, normal, uProbeMaterial), 1.0);
    }`
  landscape.mesh.material = probe
  const render = () => {
    renderer.render(scene, camera)
    const data = new Uint8Array(96 * 64 * 4)
    gl.readPixels(0, 0, 96, 64, gl.RGBA, gl.UNSIGNED_BYTE, data)
    return data
  }
  const painted = render(), repeated = render()
  if (painted.some((value, i) => value !== repeated[i])) throw new Error('Art changed between stationary frames')
  const count = data => { let changed = 0; for (let i = 0; i < data.length; i += 4) if (Math.max(...data.slice(i, i + 3)) - Math.min(...data.slice(i, i + 3)) > 8) changed++; return changed }
  let muralRuns = 0, previousColumnPainted = false
  for (let x = 0; x < 96; x++) {
    let columnPainted = false
    for (let y = 0; y < 64; y++) {
      const i = (y * 96 + x) * 4
      if (Math.max(...painted.slice(i, i + 3)) - Math.min(...painted.slice(i, i + 3)) > 8) columnPainted = true
    }
    if (columnPainted && !previousColumnPainted) muralRuns++
    previousColumnPainted = columnPainted
  }
  if (muralRuns > 2) throw new Error(`Art repeats too frequently: ${muralRuns} pieces in one hallway strip`)
  const paintedPixels = count(painted)
  if (paintedPixels < 100 || paintedPixels > 4500) throw new Error(`Expected both paint and transparent wall, got ${paintedPixels}`)
  probe.uniforms.uProbeFloor.value = 1
  if (count(render())) throw new Error('Art leaked onto a floor')
  probe.uniforms.uProbeFloor.value = 0
  landscape.artAtlas.configure({ ...pack, enabled: false })
  if (count(render())) throw new Error('Disable did not hide art')
  landscape.artAtlas.configure(pack)
  for (const material of [5, 7, 8, 9, 10, 12]) {
    probe.uniforms.uProbeMaterial.value = material
    if (count(render()) < 100) throw new Error(`Missing art on material ${material}`)
  }
  landscape.mesh.material = original; probe.dispose()
  const maze = mazeForLayout(layout), from = maze.nodes[maze.route[2]], to = maze.nodes[maze.route[3]]
  camera.position.copy(world(from.x, from.z)); camera.lookAt(world(to.x, to.z)); camera.updateMatrixWorld()
  renderer.setSize(800, 522, false); camera.aspect = 800 / 522; camera.updateProjectionMatrix()
  landscape.setResolution(800, 522); landscape.update(1.25, 0)
  renderer.render(scene, camera); gl.finish()
  window.__renderTestResult = { passed: errors.length === 0, alphaPreserved: true, persisted: true, stable: true, floorExcluded: true, disableWorks: true, wallMaterials: 7, paintedPixels, muralRuns, errors }
} catch (error) {
  window.__renderTestResult = { passed: false, errors: [...errors, error.stack || error.message] }
} finally {
  await artStorage('put', previous).catch(() => {})
  document.querySelector('#result').textContent = JSON.stringify(window.__renderTestResult)
  landscape.dispose(); renderer.dispose()
}
