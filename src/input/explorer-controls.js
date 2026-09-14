import * as THREE from 'three'
import { PLAYER_RADIUS } from '../config/navigation.js'
import { SpatialQueries } from '../world/spatial-queries.js'

const EYE_HEIGHT = 1.82
const WATER_EYE_CLEARANCE = 1.58
const ESCAPE_STEP = 0.14
const ESCAPE_RINGS = 22
const ESCAPE_DIRECTIONS = 16
const INITIAL_DISTANCE = 7
const INITIAL_PITCH = -0.08
const LOOK_SENSITIVITY = 0.0025
const MIN_PITCH = -1.25
const MAX_PITCH = 1.1
const WALK_SPEED = 4.2
const SPRINT_SPEED = 10
const VELOCITY_RESPONSE = 6
const HEIGHT_RESPONSE = 8
const MOVEMENT_SUBSTEP = 0.12
const SLIDE_DAMPING = 0.18
const BLOCKED_DAMPING = 0.35
const RECOVERY_DAMPING = 0.12
const PORTAL_COOLDOWN = 1.4
const POSITION_STORAGE_KEY = 'mind-landscape-position'
const POSITION_SAVE_SECONDS = 2

export class ExplorerControls {
  constructor(canvas, camera, getSettings, getSeed) {
    this.canvas = canvas
    this.camera = camera
    this.getSettings = getSettings
    this.getSeed = getSeed
    this.keys = new Set()
    this.dragging = false
    this.yaw = 0
    this.pitch = INITIAL_PITCH
    this.velocity = new THREE.Vector3()
    this.moveDirection = new THREE.Vector3()
    this.collisionProbe = new THREE.Vector3()
    this.portalCooldown = 0
    this.portalTransition = null
    this.portalGlow = 0
    const settings = this.getSettings()
    const seed = this.getSeed()
    this.spatial = new SpatialQueries()
    this.spatial.update(settings, seed)
    this.camera.position.set(0, this.eyeHeightAt(0, INITIAL_DISTANCE, settings, seed), INITIAL_DISTANCE)
    this.saveElapsed = 0
    this.restorePosition(seed)
    this.bind()
    this.applyRotation()
  }

  bind() {
    this.handlePointerDown = (event) => {
      if (event.button !== 0) return
      this.dragging = true
      this.canvas.setPointerCapture(event.pointerId)
    }

    this.handlePointerMove = (event) => {
      if (!this.dragging) return
      this.yaw -= event.movementX * LOOK_SENSITIVITY
      this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * LOOK_SENSITIVITY, MIN_PITCH, MAX_PITCH)
      this.applyRotation()
    }

    this.handlePointerUp = (event) => {
      this.dragging = false
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId)
    }

    this.handleKeyDown = (event) => {
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return
      this.keys.add(event.code)
    }
    this.handleKeyUp = (event) => this.keys.delete(event.code)
    this.handleSavePosition = () => this.savePosition()
    this.handleVisibilityChange = () => {
      if (globalThis.document?.hidden) this.savePosition()
    }
    this.handleBlur = () => { this.keys.clear(); this.savePosition() }

    this.canvas.addEventListener('pointerdown', this.handlePointerDown)
    this.canvas.addEventListener('pointermove', this.handlePointerMove)
    this.canvas.addEventListener('pointerup', this.handlePointerUp)
    this.canvas.addEventListener('pointercancel', this.handlePointerUp)
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('blur', this.handleBlur)
    window.addEventListener('pagehide', this.handleSavePosition)
    globalThis.document?.addEventListener('visibilitychange', this.handleVisibilityChange)
  }

  restorePosition(seed) {
    try {
      const saved = JSON.parse(window.localStorage.getItem(POSITION_STORAGE_KEY))
      if (saved?.version !== 1 || saved.seed !== seed || ![saved.x, saved.y, saved.z, saved.yaw, saved.pitch].every(Number.isFinite)) return
      this.camera.position.set(saved.x, saved.y, saved.z)
      this.yaw = saved.yaw
      this.pitch = THREE.MathUtils.clamp(saved.pitch, MIN_PITCH, MAX_PITCH)
      this.portalCooldown = PORTAL_COOLDOWN
    } catch {}
  }

  savePosition() {
    const { x, y, z } = this.camera.position
    if (![x, y, z, this.yaw, this.pitch].every(Number.isFinite)) return
    try {
      const saved = JSON.stringify({ version: 1, seed: this.getSeed(), x, y, z, yaw: this.yaw, pitch: this.pitch })
      if (saved === this.savedPosition) return
      window.localStorage.setItem(POSITION_STORAGE_KEY, saved)
      this.savedPosition = saved
    } catch {}
  }

  applyRotation() {
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
  }

  update(delta) {
    this.saveElapsed += delta
    if (this.saveElapsed >= POSITION_SAVE_SECONDS) {
      this.saveElapsed = 0
      this.savePosition()
    }
    if (this.portalTransition) {
      const transition = this.portalTransition
      transition.elapsed += delta
      const elapsed = transition.elapsed
      this.portalGlow = elapsed < 0.65 ? Math.min(1, elapsed / 0.55)
        : Math.max(0, 1 - (elapsed - 0.65) / 0.7)
      if (elapsed >= 0.65 && !transition.arrived) {
        this.arriveAtPortal(transition.destination)
        transition.arrived = true
      }
      if (elapsed >= 1.35) {
        this.portalTransition = null
        this.portalGlow = 0
      }
      return
    }
    this.portalCooldown = Math.max(0, this.portalCooldown - delta)
    const forwardInput = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp'))
      - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'))
    const sideInput = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight'))
      - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'))
    const sinYaw = Math.sin(this.yaw)
    const cosYaw = Math.cos(this.yaw)
    const direction = this.moveDirection.set(
      -sinYaw * forwardInput + cosYaw * sideInput,
      0,
      -cosYaw * forwardInput - sinYaw * sideInput
    )

    const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? SPRINT_SPEED : WALK_SPEED
    if (direction.lengthSq()) direction.normalize().multiplyScalar(speed)
    this.velocity.lerp(direction, 1 - Math.exp(-delta * VELOCITY_RESPONSE))

    const settings = this.getSettings()
    const seed = this.getSeed()
    this.spatial.update(settings, seed)
    this.escapeCollision(settings, seed)
    const movementX = this.velocity.x * delta
    const movementZ = this.velocity.z * delta
    const movementLength = Math.hypot(movementX, movementZ)
    const steps = Math.ceil(movementLength / MOVEMENT_SUBSTEP)
    const stepX = steps ? movementX / steps : 0
    const stepZ = steps ? movementZ / steps : 0

    for (let step = 0; step < steps; step++) {
      const startX = this.camera.position.x
      const startZ = this.camera.position.z
      const nextX = startX + stepX
      const nextZ = startZ + stepZ

      if (!this.isBlockedAt(nextX, nextZ, settings, seed)) {
        this.camera.position.setX(nextX)
        this.camera.position.setZ(nextZ)
        this.raiseToSurface(settings, seed)
        continue
      }

      this.collisionProbe.set(startX, this.camera.position.y, startZ)
      const normal = this.spatial.wallNormalAt(this.collisionProbe)
      if (normal) {
        const intoWall = Math.max(0, stepX * normal.x + stepZ * normal.z)
        const tangentX = stepX - normal.x * intoWall
        const tangentZ = stepZ - normal.z * intoWall
        if (Math.hypot(tangentX, tangentZ) > 0.00001
          && !this.isBlockedAt(startX + tangentX, startZ + tangentZ, settings, seed)) {
          this.camera.position.setX(startX + tangentX)
          this.camera.position.setZ(startZ + tangentZ)
          this.raiseToSurface(settings, seed)
          const blockedSpeed = Math.max(0, this.velocity.x * normal.x + this.velocity.z * normal.z)
          this.velocity.x -= normal.x * blockedSpeed
          this.velocity.z -= normal.z * blockedSpeed
          continue
        }

        let moved = false
        for (const axis of [{ x: normal.cosine, z: normal.sine }, { x: -normal.sine, z: normal.cosine }]) {
          const amount = stepX * axis.x + stepZ * axis.z
          if (Math.abs(amount) < 0.00001) continue
          const x = this.camera.position.x + axis.x * amount
          const z = this.camera.position.z + axis.z * amount
          if (!this.isBlockedAt(x, z, settings, seed)) {
            this.camera.position.setX(x)
            this.camera.position.setZ(z)
            this.raiseToSurface(settings, seed)
            moved = true
          } else {
            const blockedSpeed = this.velocity.x * axis.x + this.velocity.z * axis.z
            this.velocity.x -= axis.x * blockedSpeed * (1 - SLIDE_DAMPING)
            this.velocity.z -= axis.z * blockedSpeed * (1 - SLIDE_DAMPING)
          }
        }
        if (!moved) this.velocity.multiplyScalar(BLOCKED_DAMPING)
        continue
      }

      let moved = false
      if (!this.isBlockedAt(nextX, startZ, settings, seed)) {
        this.camera.position.setX(nextX)
        this.raiseToSurface(settings, seed)
        moved = true
      } else {
        this.velocity.x *= SLIDE_DAMPING
      }

      const slideX = this.camera.position.x
      if (!this.isBlockedAt(slideX, nextZ, settings, seed)) {
        this.camera.position.setZ(nextZ)
        this.raiseToSurface(settings, seed)
        moved = true
      } else {
        this.velocity.z *= SLIDE_DAMPING
      }

      if (!moved) this.velocity.multiplyScalar(BLOCKED_DAMPING)
    }

    const targetHeight = this.eyeHeightAt(this.camera.position.x, this.camera.position.z, settings, seed)
    this.camera.position.y += (targetHeight - this.camera.position.y) * (1 - Math.exp(-delta * HEIGHT_RESPONSE))
    this.camera.position.y = Math.max(this.camera.position.y, targetHeight)
    this.followPortal(settings, seed)
  }

  followPortal(settings, seed) {
    if (this.portalCooldown > 0) return
    const destination = this.spatial.portalDestinationAt(this.camera.position)
    if (!destination) return

    this.portalTransition = { destination, elapsed: 0, arrived: false }
    this.velocity.set(0, 0, 0)
  }

  arriveAtPortal(destination) {
    const cosine = Math.cos(destination.rotation)
    const sine = Math.sin(destination.rotation)
    const velocityX = this.velocity.x
    const velocityZ = this.velocity.z
    this.velocity.x = cosine * velocityX - sine * velocityZ
    this.velocity.z = sine * velocityX + cosine * velocityZ
    this.camera.position.setX(destination.x)
    this.camera.position.setZ(destination.z)
    this.camera.position.y = Number.isFinite(destination.y)
      ? destination.y : this.spatial.terrainHeightAt(destination.x, destination.z) + EYE_HEIGHT
    if (Number.isFinite(destination.yaw)) {
      this.yaw = destination.yaw
      this.velocity.set(0, 0, 0)
    } else {
      this.yaw -= destination.rotation
    }
    this.applyRotation()
    this.portalCooldown = PORTAL_COOLDOWN
  }

  raiseToSurface(settings, seed) {
    const surfaceHeight = this.eyeHeightAt(this.camera.position.x, this.camera.position.z, settings, seed)
    this.camera.position.y = Math.max(this.camera.position.y, surfaceHeight)
  }

  eyeHeightAt(x, z, settings, seed) {
    const groundHeight = this.spatial.walkingSurfaceAt(x, z, this.camera.position.y)
    if (this.spatial.isUndergroundAt(x, z)) return groundHeight + EYE_HEIGHT
    return Math.max(groundHeight + EYE_HEIGHT, settings.water.level + WATER_EYE_CLEARANCE)
  }

  isBlockedAt(x, z, settings, seed) {
    const probeHeight = this.eyeHeightAt(x, z, settings, seed)
    this.collisionProbe.set(x, Math.min(probeHeight, this.camera.position.y), z)
    return this.spatial.isPositionBlocked(this.collisionProbe, PLAYER_RADIUS)
  }

  escapeCollision(settings, seed) {
    const originX = this.camera.position.x
    const originZ = this.camera.position.z
    if (!this.isBlockedAt(originX, originZ, settings, seed)) return

    const oppositeMovement = Math.atan2(-this.velocity.z, -this.velocity.x)
    const baseAngle = this.velocity.lengthSq() > 0.001 ? oppositeMovement : this.yaw + Math.PI * 0.5

    for (let ring = 1; ring <= ESCAPE_RINGS; ring++) {
      const distance = ring * ESCAPE_STEP
      for (let direction = 0; direction < ESCAPE_DIRECTIONS; direction++) {
        const offset = Math.ceil(direction * 0.5) * (direction % 2 ? 1 : -1)
        const angle = baseAngle + offset * Math.PI * 2 / ESCAPE_DIRECTIONS
        const x = originX + Math.cos(angle) * distance
        const z = originZ + Math.sin(angle) * distance
        if (this.isBlockedAt(x, z, settings, seed)) continue
        this.camera.position.setX(x)
        this.camera.position.setZ(z)
        this.raiseToSurface(settings, seed)
        this.velocity.multiplyScalar(RECOVERY_DAMPING)
        return
      }
    }
  }

  dispose() {
    this.savePosition()
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    this.canvas.removeEventListener('pointermove', this.handlePointerMove)
    this.canvas.removeEventListener('pointerup', this.handlePointerUp)
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp)
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('blur', this.handleBlur)
    window.removeEventListener('pagehide', this.handleSavePosition)
    globalThis.document?.removeEventListener('visibilitychange', this.handleVisibilityChange)
    this.keys.clear()
    this.spatial.maps.clear()
  }
}
