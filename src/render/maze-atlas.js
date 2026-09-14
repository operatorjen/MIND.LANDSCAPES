import * as THREE from 'three'
import { structureLayout } from '../world/spatial-layout.js'
import { MAZE_FLOORS, mazeForLayout, MAZE_SIZE } from '../world/maze.js'
import { SpatialQueries } from '../world/spatial-queries.js'
import { STRUCTURE_CELL_SIZE } from '../config/world.js'

export const MAZE_ATLAS_RADIUS = 5
export const MAZE_ATLAS_CELLS = MAZE_ATLAS_RADIUS * 2 + 1
export const MAZE_ATLAS_PIXELS = MAZE_ATLAS_CELLS * MAZE_SIZE
export const MAZE_ATLAS_HEIGHT = MAZE_ATLAS_PIXELS * MAZE_FLOORS

export class MazeAtlas {
  constructor(uniforms) {
    this.spatial = new SpatialQueries()
    this.data = new Uint8Array(MAZE_ATLAS_PIXELS * MAZE_ATLAS_HEIGHT * 4)
    this.texture = new THREE.DataTexture(this.data, MAZE_ATLAS_PIXELS, MAZE_ATLAS_HEIGHT)
    this.texture.minFilter = THREE.NearestFilter
    this.texture.magFilter = THREE.NearestFilter
    this.texture.generateMipmaps = false
    this.uniforms = uniforms
    uniforms.uMazeAtlas.value = this.texture
  }

  update(position, settings, seed) {
    const x = Math.floor((position.x + STRUCTURE_CELL_SIZE / 2) / STRUCTURE_CELL_SIZE) - MAZE_ATLAS_RADIUS
    const z = Math.floor((position.z + STRUCTURE_CELL_SIZE / 2) / STRUCTURE_CELL_SIZE) - MAZE_ATLAS_RADIUS
    const changed = this.spatial.update(settings, seed)
    if (!changed && x === this.x && z === this.z) return
    this.x = x
    this.z = z
    this.data.fill(0)
    for (let row = 0; row < MAZE_ATLAS_CELLS; row++) for (let column = 0; column < MAZE_ATLAS_CELLS; column++) {
      const layout = structureLayout(x + column, z + row, settings, seed, this.spatial)
      if (!layout) continue
      for (let floor = 0; floor < MAZE_FLOORS; floor++) for (const node of mazeForLayout(layout, floor).nodes) {
          const pixelX = column * MAZE_SIZE + node.id % MAZE_SIZE
          const pixelY = floor * MAZE_ATLAS_PIXELS + row * MAZE_SIZE + Math.floor(node.id / MAZE_SIZE)
          const offset = (pixelY * MAZE_ATLAS_PIXELS + pixelX) * 4
          this.data[offset] = node.mask
          this.data[offset + 1] = node.room
          this.data[offset + 2] = node.lowerStair || node.portal
          this.data[offset + 3] = node.courtyardTile || 255
        }
    }
    this.uniforms.uMazeOrigin.value.set(x, z)
    this.texture.needsUpdate = true
  }

  dispose() { this.texture.dispose(); this.spatial.maps.clear() }
}
