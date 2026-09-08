import {
  QUALITY_LEVELS,
  SHADER_VARIANTS
} from '../config/rendering.js'
import { materialConstantsGlsl } from '../config/materials.js'
import {
  PLANT_DETAIL_FAR,
  PLANT_DETAIL_NEAR,
  STAIR_STEP_COUNT,
  STAIR_WIDTH,
  STRUCTURE_CELL_JITTER,
  STRUCTURE_CELL_SIZE,
  STRUCTURE_VEGETATION_CLEARANCE,
  STRUCTURE_WATER_CLEARANCE,
  TREE_CELL_JITTER,
  TREE_CELL_MARCH_GUARD,
  TREE_CELL_SIZE,
  TREE_MARCH_SCALE,
  TREE_SAMPLE_BOUND,
  TUNNEL_FACTOR_MAX,
  TUNNEL_FACTOR_MIN,
  UNDERGROUND_DESCENT,
  VEGETATION_WATER_CLEARANCE
} from '../config/world.js'
import { uniformDeclarations } from './uniforms.js'
import { architectureGlsl } from './glsl/architecture.glsl.js'
import { atmosphereGlsl } from './glsl/atmosphere.glsl.js'
import { coreGlsl } from './glsl/core.glsl.js'
import { lightingGlsl } from './glsl/lighting.glsl.js'
import { raymarchGlsl } from './glsl/raymarch.glsl.js'
import { sceneGlsl } from './glsl/scene.glsl.js'
import { terrainGlsl } from './glsl/terrain.glsl.js'
import { mazeGlsl } from './glsl/maze.glsl.js'
import { vegetationGlsl } from './glsl/vegetation.glsl.js'
import { materialGlsl } from './materials/catalog.js'

export const vertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
    gl_Position.z = gl_Position.w;
  }
`

const shaderPreamble = (level) => {
  const variant = SHADER_VARIANTS[level]
  return `
  precision highp float;

  #define SHADER_QUALITY_LEVEL ${variant.qualityLevel}
  #define ENABLE_SCENE_REFLECTIONS ${variant.sceneReflections ? 1 : 0}

  const float TREE_CELL = ${TREE_CELL_SIZE.toFixed(1)};
  const float TREE_JITTER = ${TREE_CELL_JITTER.toFixed(1)};
  const float TREE_SAMPLE_LIMIT = ${TREE_SAMPLE_BOUND.toFixed(1)};
  const float TREE_CELL_GUARD = ${TREE_CELL_MARCH_GUARD.toFixed(2)};
  const float STRUCTURE_CELL = ${STRUCTURE_CELL_SIZE.toFixed(1)};
  const float STRUCTURE_CELL_HALF = ${(STRUCTURE_CELL_SIZE * 0.5).toFixed(1)};
  const float STRUCTURE_JITTER = ${STRUCTURE_CELL_JITTER.toFixed(1)};
  const float STRUCTURE_CLEARANCE = ${STRUCTURE_VEGETATION_CLEARANCE.toFixed(1)};
  const float STRUCTURE_WATER_CLEARANCE = ${STRUCTURE_WATER_CLEARANCE.toFixed(2)};
  const float VEGETATION_WATER_CLEARANCE = ${VEGETATION_WATER_CLEARANCE.toFixed(2)};
  const float PLANT_DETAIL_NEAR = ${PLANT_DETAIL_NEAR.toFixed(1)};
  const float PLANT_DETAIL_FAR = ${PLANT_DETAIL_FAR.toFixed(1)};
  const float STAIR_STEPS = ${STAIR_STEP_COUNT.toFixed(1)};
  const float STAIR_WIDTH = ${STAIR_WIDTH.toFixed(2)};
  const float UNDERGROUND_DESCENT = ${UNDERGROUND_DESCENT.toFixed(1)};
  const float TUNNEL_FACTOR_MIN = ${TUNNEL_FACTOR_MIN.toFixed(2)};
  const float TUNNEL_FACTOR_MAX = ${TUNNEL_FACTOR_MAX.toFixed(2)};
  const int MAX_SCENE_STEPS = ${variant.sceneSteps};
  const int MAX_REFLECTION_STEPS = ${variant.reflectionSteps};
  const float TREE_MARCH_SCALE = ${TREE_MARCH_SCALE.toFixed(2)};
  const float MIN_SCENE_STEP = 0.025;
  const float MAX_SCENE_STEP = 4.8;
  const float MIN_REFLECTION_STEP = 0.04;
  const float MAX_REFLECTION_STEP = 3.8;
  const float MAX_REFLECTION_DISTANCE = 96.0;


  varying vec3 vWorldPosition;
`
}

const shaderMain = `
  void main() {
    vec3 origin = cameraPosition;
    vec3 direction = cameraRayDirection();
    vec3 position;
    float material;
    float waterDistance = outdoorWaterDistance(origin, direction);
    float courtyardWater = courtyardWaterDistance(origin, direction);
    bool mirrorWater = courtyardWater > 0.0 && (waterDistance < 0.0 || courtyardWater < waterDistance);
    if (mirrorWater) waterDistance = courtyardWater;

    float sceneHit = marchScene(origin, direction, waterDistance, position, material);
    vec3 color;
    if (waterDistance > 0.0 && (sceneHit < 0.0 || waterDistance < sceneHit)) {
      color = mirrorWater ? shadeCourtyardWater(origin, direction, waterDistance) : shadeWater(origin, direction, waterDistance);
    } else if (sceneHit > 0.0) {
      color = shadeScene(direction, position, sceneHit, material);
    } else {
      color = skyColor(direction);
    }

    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float chroma = clamp(1.08 + uChromaticIntensity * 0.48, 1.0, 2.05);
    color = mix(vec3(luminance), color, chroma);
    color *= 1.03 + uChromaticIntensity * 0.08;
    color = max(color, vec3(0.0));
    float vignette = length(gl_FragCoord.xy / uResolution - 0.5);
    float grain = hash21(gl_FragCoord.xy + floor(uTime * 3.0 * uMotionScale)) - 0.5;
    color += grain * (0.005 + uPsychedelicIntensity * 0.003);
    color *= 1.0 - smoothstep(0.35, 0.78, vignette) * 0.18;
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(0.4545));
    vec2 glowUV = (gl_FragCoord.xy - uViewport.xy) / uViewport.zw - 0.5;
    float glowRadius = length(glowUV) / 0.707107;
    float warmBloom = uPortalGlow * (1.0 - smoothstep(uPortalGlow * 1.8, uPortalGlow * 1.8 + 0.45, glowRadius));
    color = mix(color, vec3(1.0, 0.88, 0.65), warmBloom);
    gl_FragColor = vec4(color, 1.0);
  }
`

export function fragmentShaderForQuality(level = 'medium') {
  const resolvedLevel = QUALITY_LEVELS.includes(level) ? level : 'medium'
  return [
    shaderPreamble(resolvedLevel),
    materialConstantsGlsl,
    uniformDeclarations,
    coreGlsl,
    mazeGlsl,
    terrainGlsl,
    vegetationGlsl,
    architectureGlsl,
    sceneGlsl,
    atmosphereGlsl,
    raymarchGlsl,
    materialGlsl,
    lightingGlsl,
    shaderMain
  ].join('\n')
}

export const fragmentShaders = Object.freeze(Object.fromEntries(
  QUALITY_LEVELS.map((level) => [level, fragmentShaderForQuality(level)])
))

export const fragmentShader = fragmentShaders.medium
