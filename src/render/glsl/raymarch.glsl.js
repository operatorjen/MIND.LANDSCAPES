export const raymarchGlsl = `
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
`
