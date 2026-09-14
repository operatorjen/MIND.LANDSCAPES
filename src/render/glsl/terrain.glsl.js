import { MAZE_DEPTH_END, MAZE_SIZE, MAZE_WIDTH_HALF, MAZE_WIDTH_STEP } from '../../world/maze.js'

export const terrainGlsl = `
  vec2 foldedPoint(vec2 point) {
    return point + vec2(
      sin(point.y * 0.022 + sin(point.x * 0.006) * 2.0) * uFolds * 7.0,
      sin(point.x * 0.019 - cos(point.y * 0.007) * 2.0) * uFolds * 6.0
    );
  }

  float riverCenter(float distanceAlongRiver) {
    return sin(distanceAlongRiver * 0.024) * 7.0 + sin(distanceAlongRiver * 0.009) * 5.0 + sin(distanceAlongRiver * 0.004) * 3.0;
  }

  float riverMask(vec2 point) {
    float distanceToRiver = abs(point.x - riverCenter(point.y));
    return exp(-distanceToRiver * distanceToRiver * 0.11) * uRivers;
  }

  vec2 structureCenterForCell(vec2 cell);
  float structurePresence();

  float terrainFoundationSample(vec2 folded, float river) {
    float scale = uTerrainScale;
    float broad = sin(folded.x * 0.038 * scale) * 0.8 + cos(folded.y * 0.031 * scale) * 0.68;
    float crossed = sin((folded.x + folded.y) * 0.017 * scale) * 0.5 + cos((folded.x - folded.y) * 0.023 * scale) * 0.35;
    float shaped = (broad + crossed) * uTerrainAmplitude * 1.55;
    float mountainField = 0.5 + 0.5 * sin(folded.x * 0.014 + cos(folded.y * 0.011) * 2.0);
    float peaks = pow(mountainField, 7.0) * uMountains * 7.8;
    float valleyField = abs(sin(folded.x * 0.025 + sin(folded.y * 0.012) * 2.2));
    float valleys = pow(1.0 - valleyField, 6.0) * uValleys * 3.4;
    float duneRegion = pow(0.5 + 0.5 * sin(folded.y * 0.008 + folded.x * 0.004), 3.0);
    float duneWave = 0.5 + 0.5 * sin(folded.x * 0.42 + sin(folded.y * 0.06) * 2.4);
    float dunes = duneWave * duneRegion * sqrt(max(uDunes, 0.0)) * 1.45;
    float height = shaped + peaks - valleys + dunes - 0.2;
    return mix(height, min(height, uWaterLevel - 0.28), river);
  }

  float terrainFoundation(vec2 point) {
    vec2 folded = foldedPoint(point);
    float river = clamp(riverMask(point), 0.0, 1.0);
    return terrainFoundationSample(folded, river);
  }

  float terrainBaseHeight(vec2 point) {
    float scale = uTerrainScale;
    vec2 folded = foldedPoint(point);
    float river = clamp(riverMask(point), 0.0, 1.0);
    float foundation = terrainFoundationSample(folded, river);
    float detail = (fbm(folded * 0.045 * scale + uSeed) - 0.5) * uTerrainRoughness * 2.6;
    float ridges = pow(abs(fbm(folded * 0.018 * scale - uSeed * 0.3) * 2.0 - 1.0), 2.0);
    float height = foundation + detail + ridges * uTerrainRoughness * 1.2;
    height = mix(height, min(height, uWaterLevel - 0.28), river);
    float stepped = floor(height * 3.0) / 3.0;
    return mix(height, stepped, clamp(uTerraces * 0.16, 0.0, 0.28));
  }

  float terrainHeight(vec2 point) {
    vec2 cell = floor((point + STRUCTURE_CELL_HALF) / STRUCTURE_CELL);
    if (cultivationCell(cell)) {
      vec2 plantingCenter = plantingCenterForCell(cell);
      float base = terrainBaseHeight(point);
      float plantingHeight = max(terrainBaseHeight(plantingCenter), uWaterLevel + 0.62);
      float grade = 1.0 - smoothstep(3.8, 7.2, length(point - plantingCenter));
      return mix(base, plantingHeight, grade);
    }
    vec2 center = structureCenterForCell(cell);
    vec2 planar = point - center;
    bool structure = !cultivationCell(cell) && hash21(cell + uSeed * 0.043) <= structurePresence()
      && max(abs(planar.x), abs(planar.y)) <= 48.0;
    float ground = 0.0;
    float grade = 0.0;
    float variant = 0.0;
    float width = 0.0;
    float depth = 0.0;
    vec2 local = vec2(0.0);
    if (structure) {
      ground = terrainFoundation(center);
      structure = ground >= uWaterLevel + STRUCTURE_WATER_CLEARANCE;
      if (structure) {
        variant = hash21(cell + 17.8);
        float widthExpression = clamp(uMechanicalIntensity * 0.55 + uStructures * 0.2, 0.0, 1.0);
        float depthExpression = clamp(uRitualIntensity * 0.4 + uStructures * 0.24, 0.0, 1.0);
        width = mix(15.0, 23.0, hash21(cell + 4.9)) * mix(0.9, 1.18, widthExpression);
        depth = mix(28.0, 44.0, hash21(cell + 11.3)) * mix(0.9, 1.2, depthExpression);
        local = rotate2((floor(variant * 4.0) + 0.5) * 1.5707963) * planar;
        float edge = max(abs(local.x) - width * 0.62 - 0.6, abs(local.y) - depth * 0.58 - 0.6);
        grade = 1.0 - smoothstep(0.0, 6.0, edge);
      }
    }
    float height = ground;
    if (grade < 1.0) height = mix(terrainBaseHeight(point), ground, grade);
    if (!structure) return height;

    float stairSide = variant > 0.5 ? 1.0 : -1.0;
    float stairX = stairSide * width * 0.22;
    float stairStart = depth * 0.2;
    float stairEnd = -depth * 0.14;
    if (abs(local.x - stairX) < STAIR_WIDTH && local.y <= stairStart && local.y >= stairEnd) {
      float stairProgress = clamp((stairStart - local.y) / (stairStart - stairEnd), 0.0, 1.0);
      float stepped = floor(stairProgress * STAIR_STEPS) / STAIR_STEPS;
      height = min(height, ground - stepped * UNDERGROUND_DESCENT);
    }

    float lastRow = -depth * ${MAZE_DEPTH_END.toFixed(2)};
    if (abs(local.x) < width * ${MAZE_WIDTH_HALF.toFixed(2)} && local.y < stairEnd + 0.2 && local.y > lastRow - mazeRearMargin(depth)) {
      height = min(height, ground - UNDERGROUND_DESCENT);
    }
    vec4 lowerStairNode;
    vec2 lowerStairLocal;
    mazePlanDistance(local, cell, width, depth, variant, 0.0, lowerStairNode, lowerStairLocal);
    vec2 lowerStairSpacing = vec2(width * ${MAZE_WIDTH_STEP.toFixed(2)}, (depth * ${(MAZE_DEPTH_END - 0.14).toFixed(2)} - 1.2) / ${(MAZE_SIZE - 1).toFixed(1)});
    float lowerStairAcross;
    float lowerProgress = lowerStairProgress(lowerStairNode, lowerStairLocal, lowerStairSpacing, lowerStairAcross);
    if (lowerProgress >= 0.0 && lowerStairAcross < STAIR_WIDTH) {
      float lowerStep = floor(lowerProgress * STAIR_STEPS) / STAIR_STEPS;
      height = min(height, ground - UNDERGROUND_DESCENT * (1.0 + lowerStep));
    }
    return height;
  }
  bool dryStructureInterior(vec3 point) {
    vec2 cell = floor((point.xz + STRUCTURE_CELL_HALF) / STRUCTURE_CELL);
    if (cultivationCell(cell)) return false;
    if (hash21(cell + uSeed * 0.043) > structurePresence()) return false;
    vec2 center = structureCenterForCell(cell);
    vec2 planar = point.xz - center;
    if (max(abs(planar.x), abs(planar.y)) > 48.0) return false;
    float ground = terrainFoundation(center);
    if (ground < uWaterLevel + STRUCTURE_WATER_CLEARANCE || point.y > ground + 1.2) return false;
    float variant = hash21(cell + 17.8);
    float width = mix(15.0, 23.0, hash21(cell + 4.9)) * mix(0.9, 1.18, clamp(uMechanicalIntensity * 0.55 + uStructures * 0.2, 0.0, 1.0));
    float depth = mix(28.0, 44.0, hash21(cell + 11.3)) * mix(0.9, 1.2, clamp(uRitualIntensity * 0.4 + uStructures * 0.24, 0.0, 1.0));
    vec2 local = rotate2((floor(variant * 4.0) + 0.5) * 1.5707963) * planar;
    return abs(local.x) < width * ${MAZE_WIDTH_HALF.toFixed(2)}
      && local.y < depth * 0.58 + 0.6 && local.y > -depth * ${MAZE_DEPTH_END.toFixed(2)} - mazeRearMargin(depth);
  }

  float outdoorWaterDistance(vec3 origin, vec3 direction) {
    if (direction.y >= -0.0001) return -1.0;
    float candidate = (uWaterLevel - origin.y) / direction.y;
    if (candidate <= 0.0) return -1.0;
    return dryStructureInterior(origin + direction * candidate) ? -1.0 : candidate;
  }
`
