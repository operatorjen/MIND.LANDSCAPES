export const previousMain = `
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

export const previousRaymarch = `
  float marchScene(vec3 origin, vec3 direction, out vec3 position, out float material) {
    float distanceFromCamera = 0.08;
    float previousDistanceFromCamera = distanceFromCamera;
    float previousDistanceToSurface = 1000.0;

    for (int step = 0; step < MAX_SCENE_STEPS; step++) {
      if (float(step) >= uRaySteps) break;
      position = origin + direction * distanceFromCamera;
      vec3 componentDistances;
      float distanceToSurface = sampleScene(position, material, componentDistances);
      float threshold = 0.015 + distanceFromCamera * 0.00055;

      if (distanceToSurface < threshold) {
        if (distanceToSurface < 0.0 && previousDistanceToSurface > 0.0) {
          float crossing = previousDistanceToSurface / (previousDistanceToSurface - distanceToSurface);
          distanceFromCamera = mix(previousDistanceFromCamera, distanceFromCamera, clamp(crossing, 0.0, 1.0));
          position = origin + direction * distanceFromCamera;
          sampleScene(position, material, componentDistances);
        }
        return distanceFromCamera;
      }

      float terrainAdvance = max(componentDistances.x, 0.0) * 0.72 / max(abs(direction.y), 0.2);
      float treeAdvance = max(componentDistances.y, 0.0) * TREE_MARCH_SCALE;
      float architectureAdvance = max(componentDistances.z, 0.0) * 0.72;
      float advance = min(terrainAdvance, min(treeAdvance, architectureAdvance));
      previousDistanceFromCamera = distanceFromCamera;
      previousDistanceToSurface = distanceToSurface;
      distanceFromCamera += clamp(advance, MIN_SCENE_STEP, MAX_SCENE_STEP);
      if (distanceFromCamera > uViewDistance) break;
    }

    return -1.0;
  }

  #if ENABLE_SCENE_REFLECTIONS == 1
  float marchReflection(vec3 origin, vec3 direction, float detail, out vec3 position, out float material) {
    float distanceFromWater = 0.1;
    float reflectionSteps = min(mix(10.0, float(MAX_REFLECTION_STEPS), detail), uRaySteps * 0.24);

    for (int step = 0; step < MAX_REFLECTION_STEPS; step++) {
      if (float(step) >= reflectionSteps) break;
      position = origin + direction * distanceFromWater;
      vec3 componentDistances;
      float distanceToSurface = sampleScene(position, material, componentDistances);
      float threshold = 0.025 + distanceFromWater * 0.0008;
      if (distanceToSurface < threshold) return distanceFromWater;

      float terrainAdvance = max(componentDistances.x, 0.0) * 0.68 / max(abs(direction.y), 0.22);
      float treeAdvance = max(componentDistances.y, 0.0) * TREE_MARCH_SCALE;
      float architectureAdvance = max(componentDistances.z, 0.0) * 0.68;
      distanceFromWater += clamp(min(terrainAdvance, min(treeAdvance, architectureAdvance)), MIN_REFLECTION_STEP, MAX_REFLECTION_STEP);
      if (distanceFromWater > MAX_REFLECTION_DISTANCE) break;
    }

    return -1.0;
  }
  #endif
`
