import * as THREE from 'three'
import {
  DAY_PHASE_RATE,
  SKY_VOLUME_SIZE,
  UNIFORM_RESPONSE
} from '../config/rendering.js'
import { fragmentShader, vertexShader } from './shaders.js'
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
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    })
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(SKY_VOLUME_SIZE, SKY_VOLUME_SIZE, SKY_VOLUME_SIZE), material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -100
    scene.add(this.mesh)
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
}
