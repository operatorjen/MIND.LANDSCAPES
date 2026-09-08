import {
  AUTO_QUALITY as AUTO,
  QUALITY_LEVELS,
  QUALITY_MODES,
  QUALITY_PROFILES
} from '../config/rendering.js'

const STORAGE_KEY = 'mind-landscape-rendering'
const MILLISECONDS_PER_SECOND = 1000

export class QualityController {
  constructor() {
    this.preferences = loadPreferences()
    this.autoLevel = AUTO.initialLevel
    this.resolutionScale = 1
    this.sampleTotal = 0
    this.sampleCount = 0
    this.listeners = new Set()
    this.cooldown = 0
    this.warmup = AUTO.warmupSeconds
  }

  get profile() {
    const level = this.preferences.mode === 'auto'
      ? QUALITY_LEVELS[this.autoLevel]
      : this.preferences.mode

    const profile = {
      ...QUALITY_PROFILES[level],
      level,
      mode: this.preferences.mode,
      reducedMotion: this.preferences.reducedMotion
    }
    if (this.preferences.mode === 'auto') profile.pixelRatio *= this.resolutionScale
    return profile
  }

  subscribe(listener) {
    this.listeners.add(listener)
    listener(this.profile)
    return () => this.listeners.delete(listener)
  }

  setMode(mode) {
    if (!QUALITY_MODES.includes(mode)) return
    this.preferences.mode = mode
    this.resolutionScale = 1
    this.resetSamples()
    this.saveAndEmit()
  }

  setReducedMotion(reducedMotion) {
    this.preferences.reducedMotion = Boolean(reducedMotion)
    this.saveAndEmit()
  }

  sample(delta, isXR) {
    if (this.preferences.mode !== 'auto' || !Number.isFinite(delta) || delta <= 0) return
    if (globalThis.document?.hidden) return
    delta = Math.min(delta, AUTO.maximumSampleSeconds)
    this.warmup = Math.max(0, this.warmup - delta)
    if (this.warmup > 0) return
    this.cooldown = Math.max(0, this.cooldown - delta)
    if (this.cooldown > 0) return
    this.sampleTotal += delta * MILLISECONDS_PER_SECOND
    this.sampleCount++
    if (this.sampleCount < AUTO.minimumSamples) return
    if (this.sampleCount < AUTO.sampleFrames && this.sampleTotal < AUTO.sampleSeconds * MILLISECONDS_PER_SECOND) return

    const average = this.sampleTotal / this.sampleCount
    const target = MILLISECONDS_PER_SECOND / (isXR ? AUTO.xrFps : AUTO.desktopFps)
    const previous = this.autoLevel
    const previousScale = this.resolutionScale

    if (average > target * AUTO.slowFrameRatio) {
      this.resolutionScale = Math.max(AUTO.minimumScale, this.resolutionScale - AUTO.scaleDownStep)
      if (this.resolutionScale === previousScale && this.autoLevel > 0) {
        this.autoLevel--
        this.resolutionScale = AUTO.demotedScale
      }
    } else if (average < target * AUTO.fastFrameRatio) {
      this.resolutionScale = Math.min(1, this.resolutionScale + AUTO.scaleUpStep)
      if (this.resolutionScale === previousScale && this.autoLevel < QUALITY_LEVELS.length - 1) {
        this.autoLevel++
        this.resolutionScale = AUTO.promotedScale
      }
    }

    this.resetSamples()
    if (previous !== this.autoLevel || previousScale !== this.resolutionScale) {
      this.cooldown = AUTO.cooldownSeconds
      this.emit()
    }
  }

  resetSamples() {
    this.sampleTotal = 0
    this.sampleCount = 0
  }

  saveAndEmit() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences))
    } catch {
      return this.emit()
    }
    this.emit()
  }

  emit() {
    for (const listener of this.listeners) listener(this.profile)
  }
}

function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return {
      mode: QUALITY_MODES.includes(saved?.mode) ? saved.mode : 'auto',
      reducedMotion: saved?.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
  } catch {
    return {
      mode: 'auto',
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
  }
}
