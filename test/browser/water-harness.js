import * as THREE from 'three'
import { lightingGlsl } from '../../src/render/glsl/lighting.glsl.js'
import { Landscape } from '../../src/render/landscape.js'
import { QUALITY_PROFILES } from '../../src/config/rendering.js'
import { deriveSettings } from '../../src/world/world-state.js'
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('canvas'), preserveDrawingBuffer: true })
renderer.setSize(64, 64, false)
const gl = renderer.getContext(), errors = []
renderer.debug.onShaderError = (gl, program, vertex, fragment) => errors.push(gl.getShaderInfoLog(fragment))
const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
const helper = lightingGlsl.slice(lightingGlsl.indexOf('  vec2 waterSurfaceGradient'), lightingGlsl.indexOf('  vec3 shadeWater'))
const material = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 2 }, uMotionScale: { value: 1 }, uWind: { value: 0.6 }, uDetailScale: { value: 1 }, uDistance: { value: 2 } },
  vertexShader: 'void main(){gl_Position = vec4(position, 1.0);}',
  fragmentShader: `precision highp float;\n#define SHADER_QUALITY_LEVEL 1\nuniform float uTime, uMotionScale, uWind, uDetailScale, uDistance;
    ${helper}
    void main(){ vec2 slope = waterSurfaceGradient(gl_FragCoord.xy * 0.24, uDistance); gl_FragColor = vec4(0.5 + slope, 0.0, 1.0); }`
})
const geometry = new THREE.PlaneGeometry(2, 2)
scene.add(new THREE.Mesh(geometry, material))
const render = distance => {
  material.uniforms.uDistance.value = distance
  renderer.render(scene, camera)
  const pixels = new Uint8Array(64 * 64 * 4)
  gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  return pixels
}
const energy = pixels => {
  let energy = 0
  for (let i = 0; i < pixels.length; i += 4) energy += (pixels[i] - 127.5) ** 2 + (pixels[i + 1] - 127.5) ** 2
  return energy / (pixels.length / 4)
}
let landscape
try {
  const near = render(2), far = render(100), farther = render(200)
  const nearEnergy = energy(near), farEnergy = energy(far)
  if (nearEnergy < farEnergy * 4) throw new Error('Nearby water does not have stronger ripple detail')
  if (far.some((value, i) => value !== farther[i])) throw new Error('Distant water retained detail transitions')
  const edgeA = render(51.9), edgeB = render(52.1)
  if (edgeA.some((value, i) => Math.abs(value - edgeB[i]) > 1)) throw new Error('Ripple detail pops at the fade boundary')
  material.uniforms.uTime.value = 3
  const moving = render(2)
  if (!near.some((value, i) => value !== moving[i])) throw new Error('Nearby ripples did not animate')
  material.uniforms.uMotionScale.value = 0
  const paused = render(2)
  material.uniforms.uTime.value = 90
  const still = render(2)
  if (paused.some((value, i) => value !== still[i])) throw new Error('Paused water still animates')
  const settings = deriveSettings([])
  settings.generation.structures = 0
  settings.water.level = 3
  const previewScene = new THREE.Scene(), view = new THREE.PerspectiveCamera(65, 800 / 522, 0.05, 900)
  view.position.set(8, 4.4, 0); view.lookAt(-14, 3, 0); view.updateMatrixWorld()
  landscape = new Landscape(previewScene, view, settings, 0.314159, { ...QUALITY_PROFILES.low, level: 'low' })
  landscape.mesh.material.fragmentShader = landscape.mesh.material.fragmentShader.replace('float sceneHit = marchScene(origin, direction, waterDistance, position, material);', 'float sceneHit = -1.0;')
  landscape.uniforms.uDayPhase.value = 3.2
  renderer.setSize(800, 522, false); landscape.setResolution(800, 522); landscape.update(2, 0)
  renderer.render(previewScene, view); gl.finish()
  window.__renderTestResult = { passed: !errors.length, nearEnergy, farEnergy, smoothFade: true, distantSimplification: true, motionVerified: true, errors }
} catch (error) { window.__renderTestResult = { passed: false, errors: [...errors, error.stack || error.message] } }
finally {
  document.querySelector('#result').textContent = JSON.stringify(window.__renderTestResult)
  landscape?.dispose(); material.dispose(); geometry.dispose(); renderer.dispose()
}
