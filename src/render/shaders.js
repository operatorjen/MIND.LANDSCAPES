import {
  MAX_REFLECTION_STEPS,
  MAX_SCENE_STEPS
} from '../config/rendering.js'
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
  TREE_CELL_SIZE,
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
import { vegetationGlsl } from './glsl/vegetation.glsl.js'

export const vertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
    gl_Position.z = gl_Position.w;
  }
`

const shaderPreamble = `
  precision highp float;

  const float TREE_CELL = ${TREE_CELL_SIZE.toFixed(1)};
  const float TREE_JITTER = ${TREE_CELL_JITTER.toFixed(1)};
  const float TREE_SAMPLE_LIMIT = ${TREE_SAMPLE_BOUND.toFixed(1)};
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
  const int MAX_SCENE_STEPS = ${MAX_SCENE_STEPS};
  const int MAX_REFLECTION_STEPS = ${MAX_REFLECTION_STEPS};
  const float TREE_MARCH_SCALE = 0.34;
  const float MIN_SCENE_STEP = 0.025;
  const float MAX_SCENE_STEP = 4.8;
  const float MIN_REFLECTION_STEP = 0.04;
  const float MAX_REFLECTION_STEP = 3.8;
  const float MAX_REFLECTION_DISTANCE = 96.0;


  varying vec3 vWorldPosition;
`

const shaderMain = `
  void main() {
    vec3 origin = cameraPosition;
    vec3 direction = normalize(vWorldPosition - cameraPosition);
    vec3 position;
    float material;
    float sceneHit = marchScene(origin, direction, position, material);
    float waterDistance = -1.0;

    if (direction.y < -0.0001) {
      float candidate = (uWaterLevel - origin.y) / direction.y;
      if (candidate > 0.0 && (sceneHit < 0.0 || candidate < sceneHit)) waterDistance = candidate;
    }

    vec3 color = skyColor(direction);
    if (sceneHit > 0.0) color = shadeScene(direction, position, sceneHit, material);
    if (waterDistance > 0.0) color = shadeWater(origin, direction, waterDistance);

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
    gl_FragColor = vec4(color, 1.0);
  }
`

export const fragmentShader = [
  shaderPreamble,
  uniformDeclarations,
  coreGlsl,
  terrainGlsl,
  vegetationGlsl,
  architectureGlsl,
  sceneGlsl,
  atmosphereGlsl,
  raymarchGlsl,
  lightingGlsl,
  shaderMain
].join('\n')
