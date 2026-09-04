import { grassMeadowDefaults } from '../../materials/grass-meadow.glsl.js'

const grassFloat = (value) => Number(value).toFixed(4)

export const grassGeometryGlsl = `  float wispyGrassBladeDistance(
    vec3 point,
    vec2 rootOffset,
    float angle,
    float height,
    float lean,
    float ripple,
    float phase,
    float growth,
    float radius
  ) {
    vec2 direction = vec2(cos(angle), sin(angle));
    vec2 crossDirection = vec2(-direction.y, direction.x);
    float wind = sin(uTime * (0.48 + uWind * 0.72) * uMotionScale + phase) * uWind * 0.13;
    vec3 root = vec3(rootOffset.x, 0.0, rootOffset.y);
    vec2 reach = direction * (lean + wind) + crossDirection * ripple * 0.28;
    vec3 tip = root + vec3(reach.x * growth, height * growth, reach.y * growth);
    vec2 broadCurve = direction * lean * 0.52 + crossDirection * ripple;
    vec2 tipRipple = crossDirection * ripple * 0.42 - direction * lean * 0.12;
    vec3 arch = vec3(broadCurve.x, height * 0.025, broadCurve.y) * growth;
    vec3 curl = vec3(tipRipple.x, -height * 0.018, tipRipple.y) * growth;
    float grownRadius = radius * smoothstep(0.0, 0.32, growth);
    return windingTaperedDistance(point, root, tip, arch, curl, grownRadius, max(grownRadius * 0.16, 0.002));
  }

  float groundGrowthDistance(vec3 point, out float material) {
    float spacing = ${grassFloat(grassMeadowDefaults.cellSize)};
    vec2 cell = floor((point.xz + spacing * 0.5) / spacing);
    vec2 jitter = vec2(hash21(cell + 14.2), hash21(cell + 39.7)) - 0.5;
    vec2 center = cell * spacing + jitter * ${grassFloat(grassMeadowDefaults.cellJitter)};
    float detail = proximityDetail(center, ${grassFloat(grassMeadowDefaults.nearDistance)}, ${grassFloat(grassMeadowDefaults.farDistance)});
    material = MATERIAL_GRASS;
    if (detail < 0.002 || length(point.xz - center) > ${grassFloat(grassMeadowDefaults.maximumReach)}) return 1000.0;
    if (point.y < cameraPosition.y - 4.0 || point.y > cameraPosition.y + 2.2) return 1000.0;

    float random = hash21(cell + uSeed * 0.37);
    if (hash21(cell + uSeed * 0.11 + 146.8) > uPlantDensity) return 1000.0;
    float maximumPresence = clamp((uGrasses * 1.05 + uShrubs * 0.08) * 1.48, 0.0, 0.9);
    if (random > maximumPresence) return 1000.0;

    vec2 structureCell = floor((center + STRUCTURE_CELL_HALF) / STRUCTURE_CELL);
    if (hash21(structureCell + uSeed * 0.043) < structurePresence() && length(center - structureCenterForCell(structureCell)) < STRUCTURE_CLEARANCE) return 1000.0;

    float duneBiome = duneBiomeAt(center);
    float meadowBiome = meadowBiomeAt(center, duneBiome);
    float clusterNoise = noise21(foldedPoint(center) * 0.085 + uSeed * 0.53);
    float clusterField = smoothstep(0.44, 0.7, clusterNoise + meadowBiome * 0.13);
    float presence = clamp((uGrasses * 1.05 + uShrubs * 0.08) * meadowBiome * clusterField * 1.48, 0.0, 0.9);
    if (random > presence) return 1000.0;

    float ground = terrainHeight(center);
    if (ground < uWaterLevel + 0.2) return 1000.0;
    vec3 plant = vec3(point.x - center.x, point.y - ground + 0.015, point.z - center.y);
    float baseAngle = hash21(cell + 82.8) * 6.2831853;
    float shortGrowth = smoothstep(0.0, 0.46, detail);
    float mediumGrowth = smoothstep(0.1, 0.7, detail);
    float longGrowth = smoothstep(0.26, 0.9, detail);
    float crownGrowth = smoothstep(0.42, 1.0, detail);
    float shortHeight = mix(0.28, 0.5, hash21(cell + 71.4));
    float mediumHeight = mix(0.52, 0.78, hash21(cell + 91.7));
    float longHeight = mix(0.82, 1.16, hash21(cell + 108.3));
    float crownHeight = mix(1.18, ${grassFloat(grassMeadowDefaults.maximumHeight)}, hash21(cell + 124.9));
    float growth = wispyGrassBladeDistance(plant, vec2(-0.055, 0.025), baseAngle, shortHeight, 0.14, 0.055, random * 19.0, shortGrowth, 0.029);
    growth = min(growth, wispyGrassBladeDistance(plant, vec2(0.045, -0.035), baseAngle + 2.34, mediumHeight, 0.26, 0.09, random * 19.0 + 2.7, mediumGrowth, 0.023));
    #if SHADER_QUALITY_LEVEL >= 1
    if (uDetailScale > ${grassFloat(grassMeadowDefaults.mediumQualityThreshold)} && longGrowth > 0.002) {
      growth = min(growth, wispyGrassBladeDistance(plant, vec2(0.015, 0.055), baseAngle - 1.76, longHeight, 0.43, 0.135, random * 19.0 + 5.4, longGrowth, 0.019));
      growth = min(growth, wispyGrassBladeDistance(plant, vec2(-0.035, -0.045), baseAngle + 1.18, mix(0.38, 0.7, hash21(cell + 116.6)), 0.22, 0.08, random * 19.0 + 6.8, mediumGrowth, 0.017));
    }
    #endif
    #if SHADER_QUALITY_LEVEL >= 2
    if (uDetailScale > ${grassFloat(grassMeadowDefaults.highQualityThreshold)} && crownGrowth > 0.002) {
      growth = min(growth, wispyGrassBladeDistance(plant, vec2(-0.025, -0.06), baseAngle + 0.82, crownHeight, 0.62, 0.18, random * 19.0 + 8.1, crownGrowth, 0.014));
    }
    #endif
    return growth;
  }`
