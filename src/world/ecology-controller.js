import * as THREE from 'three'
import { SpatialQueries } from './spatial-queries.js'
import { STRUCTURE_CELL_SIZE } from '../config/world.js'
import {
  PLANTING_RADIUS,
  SEED_TYPES,
  daylightAmount,
  discoveredAvailablePlantingPockets,
  nearestPlantingPocket,
  nearestUndiscoveredPlantingPocket,
  nearestSeedBag,
  plantedPlantingPockets
} from './ecology.js'

const CHECKPOINT_SECONDS = 15
const UI_REFRESH_SECONDS = 0.5

export class EcologyController {
  constructor(camera, getSettings, getSeed, ecology, landscape, interfaceView) {
    this.camera = camera
    this.getSettings = getSettings
    this.getSeed = getSeed
    this.ecology = ecology
    this.landscape = landscape
    this.interface = interfaceView
    this.spatial = new SpatialQueries()
    this.checkpointElapsed = 0
    this.uiElapsed = 0
    this.collecting = false
    this.beaconPoint = new THREE.Vector3()
    this.beaconView = new THREE.Vector3()
    this.handleKeyDown = (event) => {
      if (event.code !== 'KeyE' || event.repeat || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (document.querySelector('dialog[open]')) return
      if (this.activePocket) this.plant(this.activePocket)
    }
    window.addEventListener('keydown', this.handleKeyDown)
  }

  update(delta, dayPhase) {
    const settings = this.getSettings()
    const seed = this.getSeed()
    const worldChanged = this.spatial.update(settings, seed)
    const bag = nearestSeedBag(this.camera.position, settings, seed, this.ecology, this.spatial)
    if (bag && !this.collecting) this.collect(bag)

    this.activePocket = nearestPlantingPocket(this.camera.position, settings, seed, this.spatial)
    if (this.activePocket) {
      this.ecology.discoverPocket(this.activePocket)
      this.landscape.uniforms.uPlantingFocus.value.set(this.activePocket.x, this.activePocket.z, PLANTING_RADIUS, 1)
      const plant = this.ecology.plantingAt(this.activePocket.cellX, this.activePocket.cellZ)
      if (plant) {
        const type = SEED_TYPES.find(({ id }) => id === plant.species)
        this.interface.setInteraction(`${type.label} · ${Math.round(plant.growth * 100)}% grown`)
      } else {
        const selected = SEED_TYPES.find(({ id }) => id === this.ecology.document.selectedSeed)
        const count = this.ecology.document.inventory[selected.id]
        this.interface.setInteraction(count ? `Planting ground · press E to plant ${selected.label}` : 'Planting ground · collect seed bags inside buildings')
      }
    } else {
      this.landscape.uniforms.uPlantingFocus.value.set(0, 0, 0, 0)
      this.interface.setInteraction('')
    }
    this.updateBeacons(settings, seed, worldChanged)

    const maturedBefore = this.ecology.document.stats.plantsMatured
    this.ecology.advanceGrowth(delta, daylightAmount(dayPhase, settings.atmosphere.daylight))
    if (this.ecology.document.stats.plantsMatured > maturedBefore) this.interface.notify('A planted seed has reached full growth.')

    this.checkpointElapsed += delta
    this.uiElapsed += delta
    if (this.uiElapsed >= UI_REFRESH_SECONDS) {
      this.uiElapsed = 0
      this.interface.renderEcology(this.ecology.document)
    }
    if (this.checkpointElapsed >= CHECKPOINT_SECONDS) {
      this.checkpointElapsed = 0
      this.ecology.checkpoint().catch(() => {})
    }
  }

  updateBeacons(settings, seed, worldChanged) {
    const inventoryCount = Object.values(this.ecology.document.inventory).reduce((sum, count) => sum + count, 0)
    const baseX = Math.floor((this.camera.position.x + STRUCTURE_CELL_SIZE * 0.5) / STRUCTURE_CELL_SIZE)
    const baseZ = Math.floor((this.camera.position.z + STRUCTURE_CELL_SIZE * 0.5) / STRUCTURE_CELL_SIZE)
    const signature = `${seed}:${baseX}:${baseZ}:${inventoryCount}:${this.ecology.document.plantings.length}:${this.ecology.document.discoveredPockets.length}`
    if (worldChanged || signature !== this.beaconSignature) {
      this.beaconSignature = signature
      const planted = plantedPlantingPockets(settings, seed, this.ecology, this.spatial).map(({ plant, ...pocket }) => ({
        ...pocket,
        planted: true,
        label: SEED_TYPES.find(({ id }) => id === plant.species)?.label || 'Plant'
      }))
      if (!inventoryCount) {
        this.beacons = planted
      } else {
        const known = discoveredAvailablePlantingPockets(settings, seed, this.ecology, this.spatial)
          .map((pocket) => ({ ...pocket, known: true }))
        const unexplored = nearestUndiscoveredPlantingPocket(this.camera.position, settings, seed, this.ecology, this.spatial)
        this.beacons = unexplored ? [...planted, ...known, { ...unexplored, known: false }] : [...planted, ...known]
      }
    }
    if (!this.beacons.length) {
      this.interface.setPlantingBeacons([])
      return
    }
    this.camera.updateMatrixWorld()
    const beacons = this.beacons.flatMap((beacon) => {
      if (this.activePocket?.cellX === beacon.cellX && this.activePocket?.cellZ === beacon.cellZ) return []
      return [this.projectBeacon(beacon)]
    })
    this.interface.setPlantingBeacons(beacons)
  }

  projectBeacon(beacon) {
    this.beaconPoint.set(beacon.x, beacon.y + 3.6, beacon.z)
    this.beaconView.copy(this.beaconPoint).applyMatrix4(this.camera.matrixWorldInverse)
    const behind = this.beaconView.z >= 0
    this.beaconPoint.project(this.camera)
    let x = this.beaconPoint.x
    let y = this.beaconPoint.y
    if (behind) { x = -x; y = -y }
    const edge = behind || Math.abs(x) > 0.86 || Math.abs(y) > 0.78
    x = Math.min(0.86, Math.max(-0.86, x))
    y = Math.min(0.78, Math.max(-0.78, y))
    return {
      id: `${beacon.cellX}:${beacon.cellZ}`,
      x: (x * 0.5 + 0.5) * window.innerWidth,
      y: (-y * 0.5 + 0.5) * window.innerHeight,
      distance: Math.hypot(this.camera.position.x - beacon.x, this.camera.position.z - beacon.z),
      edge,
      known: beacon.known,
      planted: beacon.planted,
      label: beacon.label
    }
  }

  async collect(bag) {
    this.collecting = true
    try {
      if (await this.ecology.collectBag(bag)) this.interface.notify(`Collected ${bag.type.label} seeds. They are now in your inventory.`)
    } finally {
      this.collecting = false
    }
  }

  async plant(pocket) {
    const plant = await this.ecology.plant(pocket)
    if (!plant) return
    const type = SEED_TYPES.find(({ id }) => id === plant.species)
    this.interface.notify(`${type.label} planted. Sunlight will help it grow.`)
  }

  dispose() {
    window.removeEventListener('keydown', this.handleKeyDown)
    this.spatial.maps.clear()
    this.interface.setPlantingBeacons([])
  }
}
