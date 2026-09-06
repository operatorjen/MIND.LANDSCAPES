import * as THREE from 'three'
import { Landscape } from '../../src/render/landscape.js'
import { QUALITY_PROFILES } from '../../src/config/rendering.js'
import { deriveSettings } from '../../src/world/world-state.js'
import { structureLayout, terrainHeightAt } from '../../src/world/spatial-layout.js'
import { mazeRecipe, mazeForLayout, mazeDistance } from '../../src/world/maze.js'
import { mazeGlsl } from '../../src/render/glsl/maze.glsl.js'

const canvas = document.querySelector('canvas')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(64, 64, false)
const settings = deriveSettings([])
settings.water.level = -2.5
settings.generation.structures = 2
settings.generation.mechanicalIntensity = 1
settings.generation.ritualIntensity = 1
settings.maze = mazeRecipe([], 0.314159)
const seed = 0.314159
const layout = structureLayout(-3, -3, settings, seed)
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 900)
camera.position.set(layout.centerX, layout.ground, layout.centerZ)
const scene = new THREE.Scene()
const landscape = new Landscape(scene, camera, settings, seed, { ...QUALITY_PROFILES.medium, level: 'medium' })
const errors = []
renderer.debug.onShaderError = (gl, program, vertex, fragment) => errors.push(gl.getShaderInfoLog(fragment))
try {
  landscape.update(1.25, 0)
  const atlasBefore = landscape.mazeAtlas.data.slice()
  const version = landscape.mazeAtlas.texture.version
  landscape.update(1.25, 0)
  if (landscape.mazeAtlas.texture.version !== version) throw new Error('Stationary frame rebuilt maze atlas')
  let streamedStructureBuilds = 0
  const remember = landscape.mazeAtlas.spatial.remember.bind(landscape.mazeAtlas.spatial)
  landscape.mazeAtlas.spatial.remember = (group, key, compute) => remember(group, key, () => {
    if (group === 'structures') streamedStructureBuilds++
    return compute()
  })
  camera.position.x += 112
  landscape.update(1.25, 0)
  if (streamedStructureBuilds !== 11) throw new Error(`Streaming rebuilt ${streamedStructureBuilds} structures instead of one new column`)
  landscape.mazeAtlas.spatial.remember = remember
  camera.position.x -= 112
  landscape.update(1.25, 0)
  const unchangedVersion = landscape.mazeAtlas.texture.version
  settings.atmosphere.dayCycleSpeed += 0.25
  landscape.update(1.25, 0)
  settings.atmosphere.dayCycleSpeed -= 0.25
  if (landscape.mazeAtlas.texture.version !== unchangedVersion) throw new Error('Visual settings rebuilt maze textures')
  camera.position.x += 112 * 12
  landscape.update(1.25, 0)
  camera.position.x -= 112 * 12
  landscape.update(1.25, 0)
  if (atlasBefore.some((byte, i) => byte !== landscape.mazeAtlas.data[i])) throw new Error('Streaming changed maze topology')
  const probeScene = new THREE.Scene()
  const probeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const material = new THREE.ShaderMaterial({
    uniforms: landscape.uniforms,
    vertexShader: 'void main() { gl_Position = vec4(position, 1.0); }',
    fragmentShader: `precision highp float;
      uniform sampler2D uMazeAtlas;
      uniform vec2 uMazeOrigin;
      ${mazeGlsl}
      void main() {
        vec2 uv = gl_FragCoord.xy / 64.0;
        vec2 point = vec2((uv.x - 0.5) * ${layout.width * 1.1}, -${layout.depth} * (0.1 + uv.y * 0.75));
        vec4 node; vec2 local;
        float distance = mazePlanDistance(point, vec2(-3.0), ${layout.width}, ${layout.depth}, ${layout.variant}, node, local);
        gl_FragColor = vec4(clamp(0.5 + distance / 16.0, 0.0, 1.0), step(distance, 0.0), 0.0, 1.0);
      }`
  })
  const geometry = new THREE.PlaneGeometry(2, 2)
  probeScene.add(new THREE.Mesh(geometry, material))
  renderer.render(probeScene, probeCamera)
  const gl = renderer.getContext(), pixels = new Uint8Array(64 * 64 * 4)
  gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  let maximumError = 0, classificationErrors = 0
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const distance = mazeDistance({ x: ((x + 0.5) / 64 - 0.5) * layout.width * 1.1, z: -layout.depth * (0.1 + (y + 0.5) / 64 * 0.75) }, layout)
    const offset = (y * 64 + x) * 4
    maximumError = Math.max(maximumError, Math.abs(Math.min(8, Math.max(-8, distance)) - (pixels[offset] / 255 - 0.5) * 16))
    if (Math.abs(distance) > 0.05 && (pixels[offset + 1] > 127) !== (distance <= 0)) classificationErrors++
  }
  material.dispose()
  geometry.dispose()
  const originalMaterial = landscape.mesh.material;
  const roomProbe = originalMaterial.clone();
  roomProbe.uniforms = { ...originalMaterial.uniforms, uProbePosition: {value: new THREE.Vector3()}, uProbeWater: {value: new THREE.Vector3()} };
  roomProbe.fragmentShader = originalMaterial.fragmentShader.slice(0, originalMaterial.fragmentShader.lastIndexOf('  void main()')) + `
    uniform vec3 uProbePosition;
    uniform vec3 uProbeWater;
    void main() {
      vec3 distances; float material;
      sampleScene(uProbePosition, material, distances);
      float water = outdoorWaterDistance(uProbeWater, vec3(0.0, -1.0, 0.0));
      gl_FragColor = vec4(step(0.2, distances.x), step(0.04, distances.z), water < 0.0 ? 1.0 : 0.0, 1.0);
    }`;
  landscape.mesh.material = roomProbe;
  renderer.setSize(1, 1, false);
  let dryRooms = 0, dryStairs = 0;
  const roomPixel = new Uint8Array(4);
  for (let x = -5; x <= 5; x++) {
    const building = structureLayout(x, -3, settings, seed);
    if (!building || building.ground - 5.6 >= settings.water.level) continue;
    const stairX = (building.variant > 0.5 ? 1 : -1) * building.width * 0.22;
    const stairSamples = Array.from({length: 13}, (_, index) => ({
      id: `stair-${index}`, x: stairX, z: building.depth * (0.2 - 0.34 * index / 12), stair: true
    }));
    for (const node of [...mazeForLayout(building).nodes, ...stairSamples]) {
      const dx = Math.cos(building.angle) * node.x - Math.sin(building.angle) * node.z;
      const dz = Math.sin(building.angle) * node.x + Math.cos(building.angle) * node.z;
      const worldX = building.centerX + dx, worldZ = building.centerZ + dz;
      const eyeY = node.stair ? terrainHeightAt(worldX, worldZ, settings, seed) + 1.82
        : building.ground - (node.portal ? 2.6 : 3.78);
      camera.position.set(worldX, eyeY, worldZ);
      camera.updateMatrixWorld();
      landscape.update(1.25, 0);
      roomProbe.uniforms.uProbePosition.value.copy(camera.position);
      roomProbe.uniforms.uProbeWater.value.set(camera.position.x, building.ground + 2, camera.position.z);
      renderer.render(scene, camera);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, roomPixel);
      if (roomPixel[0] < 250 || roomPixel[1] < 250 || roomPixel[2] < 250) {
        errors.push(`Hidden or wet room: cell ${x},-3 node ${node.id}: ${[...roomPixel]}`);
      }
      if (node.stair) dryStairs++; else dryRooms++;
    }
  }
  if (dryRooms < 25) errors.push('Insufficient wet-site room coverage');
  landscape.mesh.material = originalMaterial;
  roomProbe.dispose();
  let originDistances, centerHit
  {
    renderer.setSize(240, 156, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    camera.aspect = 240 / 156
    camera.updateProjectionMatrix()
    const maze = mazeForLayout(layout)
    const from = maze.nodes[maze.route[2]], to = maze.nodes[maze.route[3]]
    const world = point => [layout.centerX + Math.cos(layout.angle) * point.x - Math.sin(layout.angle) * point.z, layout.ground - 3.78, layout.centerZ + Math.sin(layout.angle) * point.x + Math.cos(layout.angle) * point.z]
    camera.position.fromArray(world(from))
    camera.lookAt(...world(to))
    camera.updateMatrixWorld()
    landscape.setResolution(240, 156)
    landscape.update(1.25, 0)
    const original = landscape.mesh.material
    const diagnostic = original.clone()
    diagnostic.uniforms = original.uniforms
    diagnostic.fragmentShader = original.fragmentShader.slice(0, original.fragmentShader.lastIndexOf('  void main()')) + `void main() {
      vec3 distances; float material;
      sampleScene(cameraPosition, material, distances);
      gl_FragColor = vec4(distances / 20.0 + 0.5, material / 16.0);
    }`
    landscape.mesh.material = diagnostic
    renderer.setSize(1, 1, false)
    renderer.render(scene, camera)
    const sample = new Uint8Array(4)
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sample)
    originDistances = [...sample].map((value, i) => i < 3 ? (value / 255 - 0.5) * 20 : value / 255 * 16)
    diagnostic.fragmentShader = original.fragmentShader.slice(0, original.fragmentShader.lastIndexOf('  void main()')) + `void main() {
      vec3 position; float material;
      float hit = marchScene(cameraPosition, cameraRayDirection(), -1.0, position, material);
      gl_FragColor = vec4(hit / 32.0, material / 16.0, cameraRayDirection().y * 0.5 + 0.5, 1.0);
    }`
    diagnostic.needsUpdate = true
    renderer.render(scene, camera)
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sample)
    centerHit = { distance: sample[0] / 255 * 32, material: sample[1] / 255 * 16, rayY: sample[2] / 255 * 2 - 1, expectedDirection: camera.getWorldDirection(new THREE.Vector3()).toArray() }
    landscape.mesh.material = original
    diagnostic.dispose()
    if (new URLSearchParams(location.search).has('preview')) {
      if (new URLSearchParams(location.search).has('stairs')) {
        const stairX = (layout.variant > 0.5 ? 1 : -1) * layout.width * 0.22;
        const from = world({x: stairX, z: layout.depth * (0.2 - 0.34 * 0.35)});
        const to = world({x: stairX, z: -layout.depth * 0.14 - 1.2});
        from[1] = terrainHeightAt(from[0], from[2], settings, seed) + 1.82;
        to[1] = layout.ground - 4.0;
        camera.position.fromArray(from);
        camera.lookAt(...to);
        camera.updateMatrixWorld();
      }
      renderer.setSize(800, 522, false)
      camera.aspect = 800 / 522
      camera.updateProjectionMatrix()
      landscape.applyQuality({ ...QUALITY_PROFILES.high, level: 'high' })
      landscape.setResolution(800, 522)
      landscape.update(1.25, 0)
      renderer.render(scene, camera)
      gl.finish()
    }
  }
  finish({ passed: errors.length === 0 && maximumError < 0.07 && classificationErrors === 0 && Math.abs(centerHit.rayY) < 0.01 && centerHit.distance > 0.5 && centerHit.material > 4, maximumError, classificationErrors, stableStreaming: true, streamedStructureBuilds, dryRooms, dryStairs, originDistances, centerHit, errors })
} catch (error) {
  finish({ passed: false, errors: [...errors, error.stack || error.message] })
} finally {
  landscape.dispose()
  renderer.dispose()
}
function finish(result) {
  window.__renderTestResult = result
  document.querySelector('#result').textContent = JSON.stringify(result)
  document.title = result.passed ? 'PASS' : 'FAIL'
}
