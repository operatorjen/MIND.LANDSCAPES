export const QUALITY_LEVELS = ['low', 'medium', 'high']
export const QUALITY_MODES = ['auto', ...QUALITY_LEVELS]

export const QUALITY_PROFILES = {
  low: {
    name: 'Low',
    pixelRatio: 0.8,
    raySteps: 100,
    viewDistance: 190,
    detailScale: 0.68,
    cloudDetail: 2,
    weatherDetail: 0.45
  },
  medium: {
    name: 'Medium',
    pixelRatio: 1.05,
    raySteps: 124,
    viewDistance: 275,
    detailScale: 0.88,
    cloudDetail: 3,
    weatherDetail: 0.72
  },
  high: {
    name: 'High',
    pixelRatio: 1.5,
    raySteps: 148,
    viewDistance: 360,
    detailScale: 1.08,
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

export const MAX_SCENE_STEPS = Math.max(...Object.values(QUALITY_PROFILES).map(({ raySteps }) => raySteps))
export const MAX_REFLECTION_STEPS = 30
export const SKY_VOLUME_SIZE = 12
export const DAY_PHASE_SEED_SCALE = 0.013
export const DAY_PHASE_RATE = 0.072
export const UNIFORM_RESPONSE = 0.7
export const REDUCED_MOTION_SCALE = 0.08
