export const plantedGeometryGlsl = `
  float plantedDistance(vec3 point, out float material) {
    vec2 cell = floor((point.xz + STRUCTURE_CELL_HALF) / STRUCTURE_CELL);
    material = MATERIAL_MOONBELL;
    if (!cultivationCell(cell)) return 1000.0;
    vec4 ecology = ecologyDataForCell(cell);
    float species = floor(ecology.r * 255.0 + 0.5);
    float growth = ecology.g;
    if (species < 0.5 || growth < 0.001) return 1000.0;

    vec2 center = plantingCenterForCell(cell);
    float cameraDistance = length(center - cameraPosition.xz);
    if (cameraDistance > 68.0 * uDetailScale) return 1000.0;
    float ground = terrainHeight(center);
    vec3 plant = vec3(point.x - center.x, point.y - ground, point.z - center.y);
    float height = mix(0.09, species < 1.5 ? 3.2 : species < 2.5 ? 2.25 : 2.8, smoothstep(0.0, 0.82, growth));
    float widthGrowth = smoothstep(0.08, 0.68, growth);
    float detail = 1.0 - smoothstep(18.0 * uDetailScale, 48.0 * uDetailScale, cameraDistance);
    float stem = taperedSegmentDistance(plant, vec3(0.0, -0.03, 0.0), vec3(0.0, height, 0.0), mix(0.025, 0.12, growth), 0.025);
    float coarse = min(stem, ellipsoidDistance(plant - vec3(0.0, height * 0.78, 0.0), vec3(mix(0.03, 0.48, widthGrowth), mix(0.04, 0.62, widthGrowth), mix(0.03, 0.48, widthGrowth))));
    if (detail < 0.002 || growth < 0.14) {
      material = species < 1.5 ? MATERIAL_MOONBELL : species < 2.5 ? MATERIAL_RIBBON_FERN : MATERIAL_EMBER_THISTLE;
      return coarse;
    }

    float shape = stem;
    if (species < 1.5) {
      float spread = 0.72 * widthGrowth;
      shape = min(shape, taperedSegmentDistance(plant, vec3(0.0, height * 0.46, 0.0), vec3(spread, height * 0.82, 0.18), 0.055, 0.018));
      shape = min(shape, taperedSegmentDistance(plant, vec3(0.0, height * 0.58, 0.0), vec3(-spread * 0.82, height * 0.91, -0.24), 0.05, 0.016));
      float bellA = ellipsoidDistance(plant - vec3(spread, height * 0.76, 0.18), vec3(0.34, 0.44, 0.34) * widthGrowth);
      float bellB = ellipsoidDistance(plant - vec3(-spread * 0.82, height * 0.85, -0.24), vec3(0.3, 0.4, 0.3) * widthGrowth);
      float crown = ellipsoidDistance(plant - vec3(0.0, height, 0.0), vec3(0.4, 0.32, 0.4) * widthGrowth);
      shape = min(shape, min(bellA, min(bellB, crown)));
      material = MATERIAL_MOONBELL;
    } else if (species < 2.5) {
      for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float angle = fi * 1.256637 + hash21(cell + fi * 9.1) * 0.5;
        vec3 tip = vec3(cos(angle), 0.34 + 0.11 * sin(fi), sin(angle)) * vec3(1.15 * widthGrowth, height, 1.15 * widthGrowth);
        float frond = taperedSegmentDistance(plant, vec3(0.0, 0.05, 0.0), tip, 0.075, 0.018);
        vec3 middle = tip * 0.68 + vec3(0.0, 0.15, 0.0);
        frond = min(frond, ellipsoidDistance(plant - middle, vec3(0.36, 0.11, 0.15) * mix(0.35, 1.0, widthGrowth)));
        shape = min(shape, frond);
      }
      material = MATERIAL_RIBBON_FERN;
    } else {
      float crownRadius = mix(0.04, 0.58, widthGrowth);
      shape = min(shape, raggedCrown(plant - vec3(0.0, height, 0.0), vec3(crownRadius, crownRadius * 0.92, crownRadius), hash21(cell + 71.4) * 13.0));
      for (int i = 0; i < 4; i++) {
        float angle = float(i) * 1.5707963 + 0.35;
        vec3 tip = vec3(cos(angle) * 0.82 * widthGrowth, height * 0.7, sin(angle) * 0.82 * widthGrowth);
        shape = min(shape, taperedSegmentDistance(plant, vec3(0.0, height * 0.32, 0.0), tip, 0.06, 0.012));
      }
      material = MATERIAL_EMBER_THISTLE;
    }
    return mix(coarse, min(coarse, shape), detail);
  }
`
