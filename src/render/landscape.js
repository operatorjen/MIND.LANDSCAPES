import * as THREE from 'three'
import {
  DAY_PHASE_RATE,
  SKY_VOLUME_SIZE,
  UNIFORM_RESPONSE
} from '../config/rendering.js'
import { fragmentShaders, vertexShader } from './shaders.js'
import { ArtAtlas } from './art-atlas.js'
import { MazeAtlas } from './maze-atlas.js'
import {
  createUniformState,
  createUniformTargets,
  dayPhaseForSeed,
  instantUniforms,
  smoothColorUniforms,
  smoothNumberUniforms
} from './uniforms.js'

export class Landscape {
  constructor(scene, camera, settings, seed, quality) {
    this.camera = camera
    this.settings = settings
    this.seed = seed
    this.quality = quality
    const state = createUniformState(settings, seed, quality)
    this.targets = state.targets
    this.uniforms = state.uniforms
    this.mazeAtlas = new MazeAtlas(this.uniforms)
    this.artAtlas = new ArtAtlas(this.uniforms)
    this.concreteHeightMap = new THREE.TextureLoader().load('/assets/textures/concrete-height.png')
    this.concreteHeightMap.wrapS = THREE.ClampToEdgeWrapping
    this.concreteHeightMap.wrapT = THREE.ClampToEdgeWrapping
    this.concreteHeightMap.minFilter = THREE.LinearFilter
    this.concreteHeightMap.magFilter = THREE.LinearFilter
    this.concreteHeightMap.generateMipmaps = false
    this.concreteHeightMap.colorSpace = THREE.NoColorSpace
    this.uniforms.uConcreteHeightMap.value = this.concreteHeightMap
    this.sunlitOvergrowthMap = new THREE.TextureLoader().load('/assets/textures/sunlit-overgrowth-mask.png')
    this.sunlitOvergrowthMap.wrapS = THREE.RepeatWrapping
    this.sunlitOvergrowthMap.wrapT = THREE.RepeatWrapping
    this.sunlitOvergrowthMap.minFilter = THREE.LinearMipmapLinearFilter
    this.sunlitOvergrowthMap.magFilter = THREE.LinearFilter
    this.sunlitOvergrowthMap.colorSpace = THREE.NoColorSpace
    this.uniforms.uSunlitOvergrowthMap.value = this.sunlitOvergrowthMap
    this.materials = new Map()
    this.geometry = new THREE.BoxGeometry(SKY_VOLUME_SIZE, SKY_VOLUME_SIZE, SKY_VOLUME_SIZE)
    this.mesh = new THREE.Mesh(this.geometry, this.materialForQuality(quality.level))
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -100
    this.mesh.onBeforeRender = (renderer, scene, camera, geometry, material) => {
      this.uniforms.uCameraWorld.value.copy(camera.matrixWorld)
      this.uniforms.uProjectionInverse.value.copy(camera.projectionMatrixInverse)
      renderer.getCurrentViewport(this.uniforms.uViewport.value)
      material.uniformsNeedUpdate = true
    }
    scene.add(this.mesh)
  }

  materialForQuality(level) {
    const resolvedLevel = fragmentShaders[level] ? level : 'medium'
    if (this.materials.has(resolvedLevel)) return this.materials.get(resolvedLevel)
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader: fragmentShaders[resolvedLevel],
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    })
    material.name = `landscape-${resolvedLevel}`
    this.materials.set(resolvedLevel, material)
    return material
  }

  applySettings(settings, seed) {
    const seedChanged = seed !== this.seed
    this.settings = settings
    this.seed = seed
    if (seedChanged) this.uniforms.uDayPhase.value = dayPhaseForSeed(seed)
    this.targets = createUniformTargets(settings, seed, this.quality)
    this.applyInstantUniforms()
  }

  applyQuality(quality) {
    this.quality = quality
    this.mesh.material = this.materialForQuality(quality.level)
    this.targets = createUniformTargets(this.settings, this.seed, quality)
    this.applyInstantUniforms()
  }

  applyInstantUniforms() {
    for (const name of instantUniforms) {
      this.uniforms[name].value = this.targets[name]
    }
  }

  setResolution(width, height) {
    this.uniforms.uResolution.value.set(width, height)
  }

  update(time, delta) {
    this.mazeAtlas.update(this.camera.position, this.settings, this.seed)
    this.mesh.position.copy(this.camera.position)
    this.uniforms.uTime.value = time
    const amount = 1 - Math.exp(-delta * UNIFORM_RESPONSE)

    for (const name of smoothNumberUniforms) {
      this.uniforms[name].value = THREE.MathUtils.lerp(this.uniforms[name].value, this.targets[name], amount)
    }

    this.uniforms.uDayPhase.value += delta * DAY_PHASE_RATE * this.uniforms.uDayCycleSpeed.value * this.uniforms.uMotionScale.value

    for (const name of smoothColorUniforms) {
      this.uniforms[name].value.lerp(this.targets[name], amount)
    }
  }

  dispose() {
    this.mesh.removeFromParent()
    this.geometry.dispose()
    this.mazeAtlas.dispose()
    this.artAtlas.dispose()
    this.concreteHeightMap.dispose()
    this.sunlitOvergrowthMap.dispose()
    for (const material of this.materials.values()) material.dispose()
    this.materials.clear()
  }

  restoreContext() {
    this.mazeAtlas.texture.needsUpdate = true
    this.artAtlas.texture.needsUpdate = true
    this.concreteHeightMap.needsUpdate = true
    this.sunlitOvergrowthMap.needsUpdate = true
    for (const material of this.materials.values()) material.needsUpdate = true
  }
}
