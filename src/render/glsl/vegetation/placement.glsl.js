export const vegetationPlacementGlsl = `  vec2 treeCenterForCell(vec2 cell) {
    vec2 jitter = vec2(hash21(cell + 2.7), hash21(cell + 9.2)) - 0.5;
    return cell * TREE_CELL + jitter * TREE_JITTER;
  }

  vec2 structureCenterForCell(vec2 cell) {
    vec2 jitter = vec2(hash21(cell + 31.4), hash21(cell + 68.1)) - 0.5;
    return cell * STRUCTURE_CELL + jitter * STRUCTURE_JITTER;
  }

  float structurePresence() {
    return clamp(0.1 + uStructures * 0.68 + uMechanicalIntensity * 0.16 + uRitualIntensity * 0.12, 0.0, 0.82);
  }

  float duneBiomeAt(vec2 point) {
    vec2 biomePoint = foldedPoint(point);
    float macroBiome = fbm(biomePoint * 0.011 + uSeed * 0.19);
    float duneField = pow(0.5 + 0.5 * sin(biomePoint.y * 0.008 + biomePoint.x * 0.004), 3.0);
    float riverDistance = abs(point.x - riverCenter(point.y));
    float moisture = exp(-riverDistance * riverDistance * 0.035);
    float duneBias = clamp(0.16 + uDunes * 0.62 + max(uWarmth, 0.0) * 0.14, 0.0, 1.25);
    return smoothstep(0.5, 0.78, duneField * 0.64 + macroBiome * 0.32 + duneBias * 0.35 - moisture * 0.28);
  }

  float meadowBiomeAt(vec2 point, float duneBiome) {
    vec2 biomePoint = foldedPoint(point);
    float meadowField = fbm(biomePoint * 0.019 - uSeed * 0.27);
    float riverDistance = abs(point.x - riverCenter(point.y));
    float moisture = exp(-riverDistance * riverDistance * 0.035);
    return smoothstep(0.37, 0.72, meadowField + moisture * 0.24 + uGrasses * 0.16 - duneBiome * 0.58);
  }

  float proximityDetail(vec2 center, float fullRadius, float fadeRadius) {
    return 1.0 - smoothstep(fullRadius * uDetailScale, fadeRadius * uDetailScale, length(center - cameraPosition.xz));
  }`

