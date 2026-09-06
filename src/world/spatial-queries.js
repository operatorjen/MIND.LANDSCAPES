import { isPositionBlocked, isUndergroundAt, portalDestinationAt, terrainHeightAt, walkingSurfaceAt, mazeWallNormalAt } from './spatial-layout.js'

import { SettingsTracker } from './settings-tracker.js'

const CACHE_LIMIT = 512

export class SpatialQueries {
  constructor() {
    this.maps = new Map()
    this.tracker = new SettingsTracker()
  }

  update(settings, seed) {
    const changed = this.tracker.update(settings, seed)
    if (changed) this.maps.clear()
    this.seed = seed
    this.settings = settings
    return changed
  }

  remember(group, key, compute) {
    let map = this.maps.get(group)
    if (!map) {
      map = new Map()
      this.maps.set(group, map)
    }
    if (map.has(key)) return map.get(key)
    const value = compute()
    if (map.size >= CACHE_LIMIT) map.delete(map.keys().next().value)
    map.set(key, value)
    return value
  }

  terrainHeightAt(x, z) {
    return terrainHeightAt(x, z, this.settings, this.seed, this)
  }

  walkingSurfaceAt(x, z, eyeY) {
    return walkingSurfaceAt(x, z, eyeY, this.settings, this.seed, this)
  }

  isUndergroundAt(x, z) {
    return this.remember('underground', `${x},${z}`, () => isUndergroundAt(x, z, this.settings, this.seed, this))
  }

  isPositionBlocked(position, radius) {
    const key = `${position.x},${position.y},${position.z},${radius}`
    return this.remember('blocked', key, () => isPositionBlocked(position, this.settings, this.seed, radius, this))
  }

  portalDestinationAt(position) {
    return this.remember('portal', `${position.x},${position.y},${position.z}`, () => portalDestinationAt(position, this.settings, this.seed, this))
  }

  wallNormalAt(position) {
    return mazeWallNormalAt(position, this.settings, this.seed, this)
  }
}
