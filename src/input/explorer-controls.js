import * as THREE from 'three'
import { isPositionBlocked, isUndergroundAt, portalDestinationAt, terrainHeightAt } from '../world/spatial-layout.js'

const EYE_HEIGHT = 1.82
const WATER_EYE_CLEARANCE = 1.58
const PLAYER_RADIUS = 0.46
const COLLISION_LOOKAHEAD = 0.3
const MAX_STEP_RISE = 0.68
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
const DIRECTION_EPSILON = 0.0001

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
    const settings = this.getSettings()
    const seed = this.getSeed()
    this.camera.position.set(0, this.eyeHeightAt(0, INITIAL_DISTANCE, settings, seed), INITIAL_DISTANCE)
    this.bind()
    this.applyRotation()
  }

  bind() {
    this.canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return
      this.dragging = true
      this.canvas.setPointerCapture(event.pointerId)
    })

    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.dragging) return
      this.yaw -= event.movementX * LOOK_SENSITIVITY
      this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * LOOK_SENSITIVITY, MIN_PITCH, MAX_PITCH)
      this.applyRotation()
    })

    this.canvas.addEventListener('pointerup', (event) => {
      this.dragging = false
      this.canvas.releasePointerCapture(event.pointerId)
    })

    window.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return
      this.keys.add(event.code)
    })

    window.addEventListener('keyup', (event) => this.keys.delete(event.code))
    window.addEventListener('blur', () => this.keys.clear())
  }

  applyRotation() {
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
  }

  update(delta) {
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
    this.escapeCollision(settings, seed)
    const movementX = this.velocity.x * delta
    const movementZ = this.velocity.z * delta
    const movementLength = Math.hypot(movementX, movementZ)
    const steps = Math.max(1, Math.ceil(movementLength / MOVEMENT_SUBSTEP))
    const stepX = movementX / steps
    const stepZ = movementZ / steps

    for (let step = 0; step < steps; step++) {
      const startX = this.camera.position.x
      const startZ = this.camera.position.z
      const stepLength = Math.max(Math.hypot(stepX, stepZ), DIRECTION_EPSILON)
      const lookX = stepX / stepLength * COLLISION_LOOKAHEAD
      const lookZ = stepZ / stepLength * COLLISION_LOOKAHEAD
      const nextX = startX + stepX
      const nextZ = startZ + stepZ

      if (!this.isBlockedAt(nextX + lookX, nextZ + lookZ, settings, seed)
        && !this.isLedgeAt(startX, startZ, nextX, nextZ, settings, seed)) {
        this.camera.position.setX(nextX)
        this.camera.position.setZ(nextZ)
        this.raiseToSurface(settings, seed)
        continue
      }

      let moved = false
      if (!this.isBlockedAt(nextX + lookX, startZ, settings, seed)
        && !this.isLedgeAt(startX, startZ, nextX, startZ, settings, seed)) {
        this.camera.position.setX(nextX)
        this.raiseToSurface(settings, seed)
        moved = true
      } else {
        this.velocity.x *= SLIDE_DAMPING
      }

      const slideX = this.camera.position.x
      if (!this.isBlockedAt(slideX, nextZ + lookZ, settings, seed)
        && !this.isLedgeAt(slideX, startZ, slideX, nextZ, settings, seed)) {
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
    const destination = portalDestinationAt(this.camera.position, settings, seed)
    if (!destination) return

    const cosine = Math.cos(destination.rotation)
    const sine = Math.sin(destination.rotation)
    const velocityX = this.velocity.x
    const velocityZ = this.velocity.z
    this.velocity.x = cosine * velocityX - sine * velocityZ
    this.velocity.z = sine * velocityX + cosine * velocityZ
    this.camera.position.setX(destination.x)
    this.camera.position.setZ(destination.z)
    this.camera.position.y = this.eyeHeightAt(destination.x, destination.z, settings, seed)
    this.yaw -= destination.rotation
    this.applyRotation()
    this.portalCooldown = PORTAL_COOLDOWN
  }

  isLedgeAt(fromX, fromZ, toX, toZ, settings, seed) {
    const currentGround = terrainHeightAt(fromX, fromZ, settings, seed)
    const nextGround = terrainHeightAt(toX, toZ, settings, seed)
    return nextGround - currentGround > MAX_STEP_RISE
  }

  raiseToSurface(settings, seed) {
    const surfaceHeight = this.eyeHeightAt(this.camera.position.x, this.camera.position.z, settings, seed)
    this.camera.position.y = Math.max(this.camera.position.y, surfaceHeight)
  }

  eyeHeightAt(x, z, settings, seed) {
    const groundHeight = terrainHeightAt(x, z, settings, seed)
    if (isUndergroundAt(x, z, settings, seed)) return groundHeight + EYE_HEIGHT
    return Math.max(groundHeight + EYE_HEIGHT, settings.water.level + WATER_EYE_CLEARANCE)
  }

  isBlockedAt(x, z, settings, seed) {
    const probeHeight = this.eyeHeightAt(x, z, settings, seed)
    this.collisionProbe.set(x, probeHeight, z)
    return isPositionBlocked(this.collisionProbe, settings, seed, PLAYER_RADIUS)
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
}
