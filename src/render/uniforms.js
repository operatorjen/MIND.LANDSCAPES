import * as THREE from 'three'
import {
  DAY_PHASE_SEED_SCALE,
  REDUCED_MOTION_SCALE
} from '../config/rendering.js'
import { WORLD_SEED_SCALE } from '../config/world.js'

const runtime = (glslType, read) => ({ glslType, read })
const target = (glslType, transition, read) => ({ glslType, transition, read })

export const uniformSchema = {
  uArtAtlas: runtime('sampler2D', () => null),
  uArtCount: runtime('float', () => 0),
  uArtDensity: runtime('float', () => 0.7),
  uPortalGlow: runtime('float', () => 0),
  uTime: runtime('float', () => 0),
  uDayPhase: runtime('float', ({ seed }) => dayPhaseForSeed(seed)),
  uResolution: runtime('vec2', () => new THREE.Vector2(1, 1)),
  uMazeAtlas: runtime('sampler2D', () => null),
  uMazeOrigin: runtime('vec2', () => new THREE.Vector2()),
  uEcologyAtlas: runtime('sampler2D', () => null),
  uEcologyOrigin: runtime('vec2', () => new THREE.Vector2()),
  uPlantingFocus: runtime('vec4', () => new THREE.Vector4()),
  uCameraWorld: runtime('mat4', () => new THREE.Matrix4()),
  uProjectionInverse: runtime('mat4', () => new THREE.Matrix4()),
  uViewport: runtime('vec4', () => new THREE.Vector4(0, 0, 1, 1)),
  uConcreteHeightMap: runtime('sampler2D', () => null),
  uSunlitOvergrowthMap: runtime('sampler2D', () => null),
  uSeed: target('float', 'instant', ({ seed }) => seed * WORLD_SEED_SCALE),
  uTerrainAmplitude: target('float', 'instant', ({ settings }) => settings.terrain.amplitude),
  uTerrainRoughness: target('float', 'instant', ({ settings }) => settings.terrain.roughness),
  uTerrainScale: target('float', 'instant', ({ settings }) => settings.terrain.scale),
  uMist: target('float', 'smooth', ({ settings }) => settings.atmosphere.mist),
  uWarmth: target('float', 'smooth', ({ settings }) => settings.atmosphere.warmth),
  uDaylight: target('float', 'smooth', ({ settings }) => settings.atmosphere.daylight),
  uDayCycleSpeed: target('float', 'smooth', ({ settings }) => settings.atmosphere.dayCycleSpeed),
  uWind: target('float', 'smooth', ({ settings }) => settings.atmosphere.wind),
  uWaterLevel: target('float', 'instant', ({ settings }) => settings.water.level),
  uPsychedelicIntensity: target('float', 'instant', ({ settings }) => settings.generation.psychedelicIntensity),
  uMechanicalIntensity: target('float', 'instant', ({ settings }) => settings.generation.mechanicalIntensity),
  uRitualIntensity: target('float', 'instant', ({ settings }) => settings.generation.ritualIntensity),
  uMountains: target('float', 'instant', ({ settings }) => settings.generation.mountains),
  uFolds: target('float', 'instant', ({ settings }) => settings.generation.folds),
  uValleys: target('float', 'instant', ({ settings }) => settings.generation.valleys),
  uRivers: target('float', 'instant', ({ settings }) => settings.generation.rivers),
  uDunes: target('float', 'instant', ({ settings }) => settings.generation.dunes),
  uForests: target('float', 'instant', ({ settings }) => settings.generation.forests),
  uSucculents: target('float', 'instant', ({ settings }) => settings.generation.succulents),
  uShrubs: target('float', 'instant', ({ settings }) => settings.generation.shrubs),
  uStructures: target('float', 'instant', ({ settings }) => settings.generation.structures),
  uSandyInteriors: target('float', 'instant', ({ settings }) => settings.generation.sandyInteriors),
  uOrnateInteriors: target('float', 'instant', ({ settings }) => settings.generation.ornateInteriors),
  uAbandonedInteriors: target('float', 'instant', ({ settings }) => settings.generation.abandonedInteriors),
  uCeilingVariation: target('float', 'instant', ({ settings }) => settings.generation.ceilingVariation),
  uGrasses: target('float', 'smooth', ({ settings }) => settings.generation.grasses),
  uTerraces: target('float', 'instant', ({ settings }) => settings.generation.terraces),
  uChromaticIntensity: target('float', 'smooth', ({ settings }) => settings.generation.chromaticIntensity),
  uClouds: target('float', 'smooth', ({ settings }) => settings.atmosphere.clouds),
  uWeather: target('float', 'smooth', ({ settings }) => settings.atmosphere.weather),
  uLightDrama: target('float', 'smooth', ({ settings }) => settings.atmosphere.lightDrama),
  uRaySteps: target('float', 'instant', ({ quality }) => quality.raySteps),
  uViewDistance: target('float', 'instant', ({ quality }) => quality.viewDistance),
  uDetailScale: target('float', 'instant', ({ quality }) => quality.detailScale),
  uTreeDensity: target('float', 'instant', ({ quality }) => quality.treeDensity),
  uPlantDensity: target('float', 'instant', ({ quality }) => quality.plantDensity),
  uCloudDetail: target('float', 'instant', ({ quality }) => quality.cloudDetail),
  uWeatherDetail: target('float', 'instant', ({ quality }) => quality.weatherDetail),
  uMotionScale: target('float', 'smooth', ({ quality }) => quality.reducedMotion ? REDUCED_MOTION_SCALE : 1),
  uGroundColor: target('vec3', 'smooth', ({ settings }) => new THREE.Color(settings.palette.ground)),
  uAccentColor: target('vec3', 'smooth', ({ settings }) => new THREE.Color(settings.palette.accent)),
  uSkyColor: target('vec3', 'smooth', ({ settings }) => new THREE.Color(settings.palette.sky))
}

export const uniformDeclarations = Object.entries(uniformSchema)
  .map(([name, { glslType }]) => `uniform ${glslType} ${name};`)
  .join('\n')

export const instantUniforms = uniformNamesFor('instant')
export const smoothNumberUniforms = uniformNamesFor('smooth', 'float')
export const smoothColorUniforms = uniformNamesFor('smooth', 'vec3')

export function createUniformState(settings, seed, quality) {
  const context = { settings, seed, quality }
  const uniforms = {}
  const targets = {}

  for (const [name, definition] of Object.entries(uniformSchema)) {
    const value = definition.read(context)
    uniforms[name] = { value: cloneValue(value) }
    if (definition.transition) targets[name] = cloneValue(value)
  }

  return { uniforms, targets }
}

export function createUniformTargets(settings, seed, quality) {
  const context = { settings, seed, quality }
  return Object.fromEntries(Object.entries(uniformSchema)
    .filter(([, definition]) => definition.transition)
    .map(([name, definition]) => [name, definition.read(context)]))
}

export function dayPhaseForSeed(seed) {
  return seed * WORLD_SEED_SCALE * DAY_PHASE_SEED_SCALE
}

function uniformNamesFor(transition, glslType) {
  return Object.entries(uniformSchema)
    .filter(([, definition]) => definition.transition === transition && (!glslType || definition.glslType === glslType))
    .map(([name]) => name)
}

function cloneValue(value) {
  return value?.clone ? value.clone() : value
}
