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
    float height = terrainBaseHeight(point);
    vec2 cell = floor((point + STRUCTURE_CELL_HALF) / STRUCTURE_CELL);
    float random = hash21(cell + uSeed * 0.043);
    if (random > structurePresence()) return height;

    vec2 center = structureCenterForCell(cell);
    vec2 planar = point - center;
    if (max(abs(planar.x), abs(planar.y)) > 38.0) return height;
    float ground = terrainFoundation(center);
    if (ground < uWaterLevel + STRUCTURE_WATER_CLEARANCE) return height;

    float variant = hash21(cell + 17.8);
    float widthExpression = clamp(uMechanicalIntensity * 0.55 + uStructures * 0.2, 0.0, 1.0);
    float depthExpression = clamp(uRitualIntensity * 0.4 + uStructures * 0.24, 0.0, 1.0);
    float width = mix(15.0, 23.0, hash21(cell + 4.9)) * mix(0.9, 1.18, widthExpression);
    float depth = mix(28.0, 44.0, hash21(cell + 11.3)) * mix(0.9, 1.2, depthExpression);
    vec2 local = rotate2((floor(variant * 4.0) + 0.5) * 1.5707963) * planar;
    float edge = max(abs(local.x) - width * 0.62 - 0.6, abs(local.y) - depth * 0.58 - 0.6);
    float grade = 1.0 - smoothstep(0.0, 6.0, edge);
    height = mix(height, ground, grade);

    float stairSide = variant > 0.5 ? 1.0 : -1.0;
    float stairX = stairSide * width * 0.22;
    float stairStart = depth * 0.2;
    float stairEnd = -depth * 0.14;
    float tunnelRoll = fract(
      hash21(cell + 233.1)
      + uSandyInteriors * 0.16
      + uOrnateInteriors * 0.24
      + uPsychedelicIntensity * 0.18
    );
    float tunnelFactor = mix(TUNNEL_FACTOR_MIN, TUNNEL_FACTOR_MAX, tunnelRoll);
    float styleRoll = fract(
      hash21(cell + 155.4)
      + uMechanicalIntensity * 0.21
      + uRitualIntensity * 0.33
      + uOrnateInteriors * 0.17
      + uAbandonedInteriors * 0.13
    );
    float structureStyle = floor(styleRoll * 4.0);
    if (abs(local.x - stairX) < STAIR_WIDTH && local.y <= stairStart && local.y >= stairEnd) {
      float stairProgress = clamp((stairStart - local.y) / (stairStart - stairEnd), 0.0, 1.0);
      float stepped = floor(stairProgress * STAIR_STEPS) / STAIR_STEPS;
      height = min(height, ground - stepped * UNDERGROUND_DESCENT);
    }

    float chamberHalfX = width * 0.2;
    float chamberStart = stairEnd + 0.2;
    float chamberEnd = -depth * min(0.84, tunnelFactor + 0.25);
    float corridorX = stairX + undergroundCenterOffset(local.y, chamberStart, chamberEnd, chamberHalfX, variant, structureStyle);
    if (abs(local.x - corridorX) < chamberHalfX && local.y <= chamberStart && local.y >= chamberEnd) {
      height = min(height, ground - UNDERGROUND_DESCENT);
    }
    return height;
  }
`
