export const QUALITY_LEVELS = ['low', 'medium', 'high']
export const QUALITY_MODES = ['auto', ...QUALITY_LEVELS]

export const QUALITY_PROFILES = {
  low: {
    name: 'Low',
    pixelRatio: 0.8,
    raySteps: 100,
    viewDistance: 190,
    detailScale: 0.68,
    treeDensity: 0.78,
    plantDensity: 0.55,
    cloudDetail: 2,
    weatherDetail: 0.45
  },
  medium: {
    name: 'Medium',
    pixelRatio: 1.05,
    raySteps: 124,
    viewDistance: 275,
    detailScale: 0.88,
    treeDensity: 0.92,
    plantDensity: 0.8,
    cloudDetail: 3,
    weatherDetail: 0.72
  },
  high: {
    name: 'High',
    pixelRatio: 1.5,
    raySteps: 148,
    viewDistance: 360,
    detailScale: 1.08,
    treeDensity: 1,
    plantDensity: 1,
    cloudDetail: 5,
    weatherDetail: 1
  }
}

export const AUTO_QUALITY = {
  initialLevel: 1,
  warmupSeconds: 3,
  sampleFrames: 90,
  desktopFps: 60,
  xrFps: 72,
  slowFrameRatio: 1.08,
  fastFrameRatio: 0.82,
  minimumScale: 0.72,
  scaleDownStep: 0.08,
  scaleUpStep: 0.06,
  demotedScale: 0.9,
  promotedScale: 0.82,
  cooldownSeconds: 3,
  ignoredFrameSeconds: 0.2
}

export const SHADER_VARIANTS = Object.freeze({
  low: Object.freeze({ qualityLevel: 0, sceneSteps: QUALITY_PROFILES.low.raySteps, reflectionSteps: 1, sceneReflections: false }),
  medium: Object.freeze({ qualityLevel: 1, sceneSteps: QUALITY_PROFILES.medium.raySteps, reflectionSteps: 18, sceneReflections: true }),
  high: Object.freeze({ qualityLevel: 2, sceneSteps: QUALITY_PROFILES.high.raySteps, reflectionSteps: 30, sceneReflections: true })
})

export const SKY_VOLUME_SIZE = 12
export const DAY_PHASE_SEED_SCALE = 0.013
export const DAY_PHASE_RATE = 0.072
export const UNIFORM_RESPONSE = 0.7
export const REDUCED_MOTION_SCALE = 0.08
