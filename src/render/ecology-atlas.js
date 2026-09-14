import * as THREE from 'three'
import { ECOLOGY_ATLAS_CELLS, ECOLOGY_ATLAS_RADIUS, SEED_TYPES, seedBagsForLayout } from '../world/ecology.js'
import { structureLayout } from '../world/spatial-layout.js'
import { STRUCTURE_CELL_SIZE } from '../config/world.js'
import { SpatialQueries } from '../world/spatial-queries.js'

export class EcologyAtlas {
  constructor(uniforms, ecology) {
    this.uniforms = uniforms
    this.ecology = ecology
    this.spatial = new SpatialQueries()
    this.data = new Uint8Array(ECOLOGY_ATLAS_CELLS * ECOLOGY_ATLAS_CELLS * 4)
    this.bagData = new Uint8Array(this.data.length)
    this.plantSlots = new Uint8Array(ECOLOGY_ATLAS_CELLS * ECOLOGY_ATLAS_CELLS)
    this.texture = new THREE.DataTexture(this.data, ECOLOGY_ATLAS_CELLS, ECOLOGY_ATLAS_CELLS)
    this.texture.minFilter = THREE.NearestFilter
    this.texture.magFilter = THREE.NearestFilter
    this.texture.generateMipmaps = false
    uniforms.uEcologyAtlas.value = this.texture
  }

  update(position, settings, seed) {
    const x = Math.floor((position.x + STRUCTURE_CELL_SIZE * 0.5) / STRUCTURE_CELL_SIZE) - ECOLOGY_ATLAS_RADIUS
    const z = Math.floor((position.z + STRUCTURE_CELL_SIZE * 0.5) / STRUCTURE_CELL_SIZE) - ECOLOGY_ATLAS_RADIUS
    const settingsChanged = this.spatial.update(settings, seed)
    if (!settingsChanged && x === this.x && z === this.z && this.revision === this.ecology.revision) return
    const bagsChanged = settingsChanged || x !== this.x || z !== this.z || this.bagRevision !== this.ecology.bagRevision
    this.x = x
    this.z = z
    this.revision = this.ecology.revision
    if (bagsChanged) {
      this.bagRevision = this.ecology.bagRevision
      this.bagData.fill(0)
      const collected = new Set(this.ecology.document.collectedBags)
      for (let row = 0; row < ECOLOGY_ATLAS_CELLS; row++) for (let column = 0; column < ECOLOGY_ATLAS_CELLS; column++) {
        const offset = (row * ECOLOGY_ATLAS_CELLS + column) * 4
        for (const bag of seedBagsForLayout(structureLayout(x + column, z + row, settings, seed, this.spatial), this.ecology, this.spatial)) {
          if (collected.has(bag.id)) continue
          this.bagData[offset + bag.floor * 2] = bag.node + 1
          this.bagData[offset + bag.floor * 2 + 1] = SEED_TYPES.indexOf(bag.type) + 1
        }
      }
    }
    this.data.set(this.bagData)
    this.plantSlots.fill(0)
    for (const plant of this.ecology.document.plantings) {
      const offset = this.cellOffset(plant.cellX, plant.cellZ)
      if (offset < 0) continue
      const slot = this.plantSlots[offset / 4]++
      this.data[offset + slot * 2] = SEED_TYPES.findIndex(({ id }) => id === plant.species) + 1
      this.data[offset + slot * 2 + 1] = Math.round(plant.growth * 255)
    }
    this.uniforms.uEcologyOrigin.value.set(x, z)
    this.texture.needsUpdate = true
  }

  cellOffset(cellX, cellZ) {
    const column = cellX - this.x
    const row = cellZ - this.z
    if (!Number.isInteger(column) || !Number.isInteger(row) || column < 0 || row < 0 || column >= ECOLOGY_ATLAS_CELLS || row >= ECOLOGY_ATLAS_CELLS) return -1
    return (row * ECOLOGY_ATLAS_CELLS + column) * 4
  }

  dispose() {
    this.texture.dispose()
    this.spatial.maps.clear()
  }
}
