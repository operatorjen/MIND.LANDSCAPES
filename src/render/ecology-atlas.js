import * as THREE from 'three'
import { ECOLOGY_ATLAS_CELLS, ECOLOGY_ATLAS_RADIUS, SEED_TYPES, seedBagForLayout } from '../world/ecology.js'
import { structureLayout } from '../world/spatial-layout.js'
import { STRUCTURE_CELL_SIZE } from '../config/world.js'
import { SpatialQueries } from '../world/spatial-queries.js'

export class EcologyAtlas {
  constructor(uniforms, ecology) {
    this.uniforms = uniforms
    this.ecology = ecology
    this.spatial = new SpatialQueries()
    this.data = new Uint8Array(ECOLOGY_ATLAS_CELLS * ECOLOGY_ATLAS_CELLS * 4)
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
    const windowChanged = settingsChanged || x !== this.x || z !== this.z
    this.x = x
    this.z = z
    this.revision = this.ecology.revision
    if (windowChanged) {
      this.data.fill(0)
      for (let row = 0; row < ECOLOGY_ATLAS_CELLS; row++) for (let column = 0; column < ECOLOGY_ATLAS_CELLS; column++) {
        const bag = seedBagForLayout(structureLayout(x + column, z + row, settings, seed, this.spatial), this.spatial)
        if (bag) this.data[(row * ECOLOGY_ATLAS_CELLS + column) * 4 + 3] = SEED_TYPES.indexOf(bag.type) + 1
      }
    }
    for (let offset = 0; offset < this.data.length; offset += 4) this.data.fill(0, offset, offset + 3)
    for (const plant of this.ecology.document.plantings) {
      const offset = this.cellOffset(plant.cellX, plant.cellZ)
      if (offset < 0) continue
      this.data[offset] = SEED_TYPES.findIndex(({ id }) => id === plant.species) + 1
      this.data[offset + 1] = Math.round(plant.growth * 255)
    }
    for (const id of this.ecology.document.collectedBags) {
      const [, cellX, cellZ] = id.split(':')
      const offset = this.cellOffset(Number(cellX), Number(cellZ))
      if (offset >= 0) this.data[offset + 2] = 255
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
