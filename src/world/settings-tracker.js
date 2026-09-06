const SPATIAL_GROUPS = ['terrain', 'generation', 'water', 'maze']

export class SettingsTracker {
  update(settings, seed) {
    let changed = seed !== this.seed || settings.atmosphere?.warmth !== this.warmth || !this.snapshot
    if (!changed) {
      for (const group of SPATIAL_GROUPS) {
        if (!sameValues(settings[group], this.snapshot[group])) { changed = true; break }
      }
    }
    if (changed) {
      this.snapshot = {}
      for (const group of SPATIAL_GROUPS) this.snapshot[group] = structuredClone(settings[group])
      this.seed = seed
      this.warmth = settings.atmosphere?.warmth
    }
    return changed
  }
}

function sameValues(value, previous) {
  if (Object.is(value, previous)) return true
  if (!value || !previous || typeof value !== 'object' || typeof previous !== 'object') return false
  for (const key in value) {
    if (!Object.hasOwn(previous, key) || !sameValues(value[key], previous[key])) return false
  }
  for (const key in previous) if (!Object.hasOwn(value, key)) return false
  return true
}
