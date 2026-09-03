export const vegetationGlsl = `
  float timelessPhase() {
    return uDayPhase;
  }

  float daylightAmount() {
    return mix(0.5 + 0.5 * sin(timelessPhase()), uDaylight, 0.16);
  }

  float seasonalCycle() {
    return fract(uTime * 0.0036 * uMotionScale + uSeed * 0.017);
  }

  float segmentDistance(vec3 point, vec3 start, vec3 end) {
    vec3 segment = end - start;
    float position = clamp(dot(point - start, segment) / dot(segment, segment), 0.0, 1.0);
    return length(point - start - segment * position);
  }

  float taperedSegmentDistance(vec3 point, vec3 start, vec3 end, float startRadius, float endRadius) {
    vec3 segment = end - start;
    float position = clamp(dot(point - start, segment) / dot(segment, segment), 0.0, 1.0);
    return length(point - start - segment * position) - mix(startRadius, endRadius, position);
  }

  float boxDistance(vec3 point, vec3 bounds) {
    vec3 offset = abs(point) - bounds;
    return length(max(offset, 0.0)) + min(max(offset.x, max(offset.y, offset.z)), 0.0);
  }

  float ellipsoidDistance(vec3 point, vec3 radius) {
    return (length(point / radius) - 1.0) * min(radius.x, min(radius.y, radius.z));
  }

  float smoothMinimum(float a, float b, float radius) {
    float blend = clamp(0.5 + 0.5 * (b - a) / radius, 0.0, 1.0);
    return mix(b, a, blend) - radius * blend * (1.0 - blend);
  }

  float morphPlantDistance(float coarseDistance, float detailedDistance, float detail) {
    float amount = smoothstep(0.0, 1.0, detail);
    float transition = 4.0 * amount * (1.0 - amount);
    float interpolated = mix(coarseDistance, detailedDistance, amount);
    float supported = smoothMinimum(coarseDistance, detailedDistance, 0.18);
    return mix(interpolated, min(interpolated, supported), transition);
  }

  float raggedCrown(vec3 point, vec3 scale, float phase) {
    vec3 shaped = point / scale;
    float ragged = sin(point.x * 3.7 + phase) * sin(point.y * 4.3 - phase * 0.7) * sin(point.z * 3.1 + phase * 1.3);
    ragged += sin((point.x + point.z) * 6.2 - point.y * 2.4 + phase) * 0.45;
    return (length(shaped) - 1.0) * min(scale.x, scale.z) + ragged * 0.13;
  }

  vec2 treeCenterForCell(vec2 cell) {
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
  }

  float groundGrowthDistance(vec3 point, out float material) {
    float spacing = 2.4;
    vec2 cell = floor((point.xz + spacing * 0.5) / spacing);
    vec2 jitter = vec2(hash21(cell + 14.2), hash21(cell + 39.7)) - 0.5;
    vec2 center = cell * spacing + jitter * 1.25;
    float detail = proximityDetail(center, 4.0, 24.0);
    material = 2.76;
    if (detail < 0.002 || length(point.xz - center) > 1.4) return 1000.0;
    if (point.y < cameraPosition.y - 4.0 || point.y > cameraPosition.y + 2.2) return 1000.0;

    float random = hash21(cell + uSeed * 0.37);
    if (random > clamp(uGrasses * 0.82 + uShrubs * 0.16, 0.0, 0.82)) return 1000.0;

    vec2 structureCell = floor((center + STRUCTURE_CELL_HALF) / STRUCTURE_CELL);
    if (hash21(structureCell + uSeed * 0.043) < structurePresence() && length(center - structureCenterForCell(structureCell)) < STRUCTURE_CLEARANCE) return 1000.0;

    float duneBiome = duneBiomeAt(center);
    float meadowBiome = meadowBiomeAt(center, duneBiome);
    float presence = clamp((uGrasses * 0.82 + uShrubs * 0.16) * meadowBiome, 0.0, 0.82);
    if (random > presence) return 1000.0;

    float ground = terrainHeight(center);
    if (ground < uWaterLevel + 0.2) return 1000.0;
    vec3 plant = vec3(point.x - center.x, point.y - ground + 0.015, point.z - center.y);
    float height = mix(0.3, 0.92, hash21(cell + 71.4)) * detail;
    float lean = (hash21(cell + 82.8) - 0.5) * 0.42;
    float wind = sin(uTime * (0.55 + uWind) * uMotionScale + random * 18.0) * uWind * 0.12 * detail;
    vec3 root = vec3(0.0);
    vec3 tipA = vec3(lean + wind, height, 0.08);
    vec3 tipB = vec3(-lean * 0.72 + wind * 0.65, height * 0.76, -0.18);
    vec3 tipC = vec3(0.16 + wind * 0.42, height * 0.58, 0.16);
    float bladeRadius = mix(0.018, 0.042, detail);
    float growth = taperedSegmentDistance(plant, root, tipA, bladeRadius, 0.006);
    growth = min(growth, taperedSegmentDistance(plant, root, tipB, bladeRadius * 0.82, 0.005));
    growth = min(growth, taperedSegmentDistance(plant, root, tipC, bladeRadius * 0.68, 0.004));
    return growth;
  }

  float forestDistance(vec3 point, float terrainSurface, out float material) {
    float spacing = TREE_CELL;
    vec2 cell = floor((point.xz + spacing * 0.5) / spacing);
    vec2 center = treeCenterForCell(cell);
    vec2 local = point.xz - center;
    float random = hash21(cell + uSeed * 0.07);
    float moisture = exp(-abs(center.x - riverCenter(center.y)) * 0.08);
    float cluster = noise21(center * 0.018 + uSeed * 0.031);
    float grove = smoothstep(0.36, 0.72, cluster + moisture * 0.18);
    float duneBiome = duneBiomeAt(center);
    float meadowBiome = meadowBiomeAt(center, duneBiome);
    float treeWeight = uForests * (0.1 + grove * 1.2 + moisture * 0.28) * (1.0 - duneBiome * 0.74);
    float succulentWeight = uSucculents * duneBiome * 1.5;
    float shrubWeight = uShrubs * meadowBiome * (0.82 + moisture * 0.3);
    float vegetationWeight = treeWeight + succulentWeight + shrubWeight;
    float chance = clamp(vegetationWeight * 0.72, 0.0, 0.88);
    material = 1.0;

    if (random > chance || max(abs(local.x), abs(local.y)) > TREE_SAMPLE_LIMIT) return 1000.0;

    vec2 structureCell = floor((center + STRUCTURE_CELL_HALF) / STRUCTURE_CELL);
    vec2 structureCenter = structureCenterForCell(structureCell);
    float structureRandom = hash21(structureCell + uSeed * 0.043);
    if (structureRandom < structurePresence() && length(center - structureCenter) < STRUCTURE_CLEARANCE) return 1000.0;

    float ground = terrainHeight(center);
    if (ground < uWaterLevel + VEGETATION_WATER_CLEARANCE) return 1000.0;
    float plantDistance = length(center - cameraPosition.xz);
    float plantDetail = 1.0 - smoothstep(PLANT_DETAIL_NEAR, PLANT_DETAIL_FAR, plantDistance);

    float kindSelector = hash21(cell + 84.3) * max(vegetationWeight, 0.001);
    bool isSucculent = kindSelector < succulentWeight;
    bool isShrub = !isSucculent && kindSelector < succulentWeight + shrubWeight;
    float speciesRoll = hash21(cell + 42.6);
    float species = meadowBiome > 0.45 ? mix(0.52, 0.86, speciesRoll) : speciesRoll;
    float age = mix(0.72, 1.24, hash21(cell + 8.7));
    float side = random > 0.5 ? 1.0 : -1.0;

    vec3 coarsePlant = vec3(local.x, point.y - ground, local.y);
    float coarseDistance = 1000.0;
    float coarseMaterial = 1.0;
    if (isSucculent) {
      float subtype = hash21(cell + 93.1);
      coarseMaterial = 3.7;
      if (subtype < 0.56) {
        float coarseHeight = mix(2.1, 6.4, hash21(cell + 96.4));
        coarseDistance = taperedSegmentDistance(coarsePlant, vec3(0.0), vec3(0.0, coarseHeight, 0.0), 0.34, 0.2);
      } else if (subtype < 0.78) {
        float barrelRadius = mix(0.42, 0.82, age);
        coarseDistance = ellipsoidDistance(
          coarsePlant - vec3(0.0, barrelRadius * 0.82, 0.0),
          vec3(barrelRadius, barrelRadius * 1.18, barrelRadius)
        );
      } else {
        float agaveReach = mix(0.75, 1.45, age);
        coarseDistance = ellipsoidDistance(
          coarsePlant - vec3(0.0, 0.34, 0.0),
          vec3(agaveReach, 0.32, agaveReach * 0.88)
        );
      }
    } else if (isShrub) {
      float coarseHeight = mix(1.25, 3.15, age);
      coarseMaterial = 2.72;
      coarseDistance = ellipsoidDistance(
        coarsePlant - vec3(0.0, coarseHeight * 0.55, 0.0),
        vec3(1.15, coarseHeight * 0.55, 1.05) * age
      );
    } else {
      float coarseHeight = mix(4.0, 8.2, age);
      if (species < 0.24) coarseHeight = mix(7.4, 12.8, age);
      else if (species < 0.5) coarseHeight = mix(4.2, 7.7, age);
      else if (species < 0.88) coarseHeight = mix(5.6, 10.4, age);
      else coarseHeight = mix(4.8, 8.8, age);
      float coarseTrunk = taperedSegmentDistance(
        coarsePlant,
        vec3(0.0),
        vec3(0.0, coarseHeight * 0.9, 0.0),
        mix(0.26, 0.54, species),
        0.09
      );
      float coarseCrown = ellipsoidDistance(
        coarsePlant - vec3(0.0, coarseHeight * 0.78, 0.0),
        vec3(1.75, 1.25, 1.58) * age
      );
      if (coarseCrown < coarseTrunk) {
        coarseMaterial = 2.0 + species;
        coarseDistance = coarseCrown;
      } else {
        coarseDistance = coarseTrunk;
      }
    }
    if (plantDetail < 0.001) {
      material = coarseMaterial;
      return coarseDistance;
    }

    if (isSucculent) {
      vec3 plant = vec3(local.x, point.y - ground, local.y);
      plant.xz *= rotate2((random - 0.5) * 2.4);
      float subtype = hash21(cell + 93.1);
      float succulent = 1000.0;

      if (subtype < 0.56) {
        float cactusHeight = mix(2.1, 6.4, hash21(cell + 96.4));
        float cactusRadius = mix(0.2, 0.42, hash21(cell + 98.7));
        succulent = taperedSegmentDistance(plant, vec3(0.0), vec3(0.0, cactusHeight, 0.0), cactusRadius, cactusRadius * 0.72);
        float armHeight = cactusHeight * mix(0.32, 0.55, hash21(cell + 101.8));
        vec3 armStart = vec3(0.0, armHeight, 0.0);
        vec3 armElbow = armStart + vec3(side * mix(0.55, 1.05, age), 0.08, 0.0);
        vec3 armTip = armElbow + vec3(0.0, cactusHeight * 0.3, 0.0);
        succulent = min(succulent, taperedSegmentDistance(plant, armStart, armElbow, cactusRadius * 0.68, cactusRadius * 0.52));
        succulent = min(succulent, taperedSegmentDistance(plant, armElbow, armTip, cactusRadius * 0.54, cactusRadius * 0.34));
        if (subtype > 0.24) {
          vec3 secondStart = vec3(0.0, cactusHeight * 0.62, 0.0);
          vec3 secondElbow = secondStart + vec3(-side * mix(0.42, 0.82, random), 0.06, 0.12);
          vec3 secondTip = secondElbow + vec3(0.0, cactusHeight * 0.2, 0.0);
          succulent = min(succulent, taperedSegmentDistance(plant, secondStart, secondElbow, cactusRadius * 0.54, cactusRadius * 0.4));
          succulent = min(succulent, taperedSegmentDistance(plant, secondElbow, secondTip, cactusRadius * 0.42, cactusRadius * 0.24));
        }
        if (plantDetail > 0.002) {
          vec3 detailStart = vec3(0.0, cactusHeight * 0.76, 0.0);
          vec3 detailElbow = detailStart + vec3(side * 0.34, 0.04, -0.18);
          vec3 detailTip = detailElbow + vec3(0.06, cactusHeight * 0.13, -0.04);
          float closeGrowth = taperedSegmentDistance(plant, detailStart, detailElbow, cactusRadius * 0.38, cactusRadius * 0.24);
          closeGrowth = min(closeGrowth, taperedSegmentDistance(plant, detailElbow, detailTip, cactusRadius * 0.25, cactusRadius * 0.1));
          succulent = mix(succulent, min(succulent, closeGrowth), plantDetail);
        }
      } else if (subtype < 0.78) {
        float barrelRadius = mix(0.42, 0.82, age);
        succulent = raggedCrown(plant - vec3(0.0, barrelRadius * 0.82, 0.0), vec3(barrelRadius, barrelRadius * 1.18, barrelRadius), random * 17.0);
        if (plantDetail > 0.002) {
          float pups = raggedCrown(plant - vec3(side * barrelRadius * 0.78, barrelRadius * 0.34, 0.18), vec3(barrelRadius * 0.4, barrelRadius * 0.52, barrelRadius * 0.42), random * 23.0);
          succulent = mix(succulent, min(succulent, pups), plantDetail);
        }
      } else {
        float agaveReach = mix(0.75, 1.45, age);
        vec3 agaveStart = vec3(0.0, 0.14, 0.0);
        succulent = taperedSegmentDistance(plant, agaveStart, vec3(agaveReach, 0.48, 0.0), 0.2, 0.025);
        succulent = min(succulent, taperedSegmentDistance(plant, agaveStart, vec3(-agaveReach * 0.86, 0.42, 0.38), 0.18, 0.022));
        succulent = min(succulent, taperedSegmentDistance(plant, agaveStart, vec3(0.3, 0.58, agaveReach), 0.19, 0.024));
        succulent = min(succulent, taperedSegmentDistance(plant, agaveStart, vec3(-0.38, 0.5, -agaveReach * 0.9), 0.17, 0.02));
        succulent = min(succulent, taperedSegmentDistance(plant, agaveStart, vec3(agaveReach * 0.58, 0.7, -agaveReach * 0.52), 0.16, 0.018));
        if (plantDetail > 0.002) {
          float closeLeaves = taperedSegmentDistance(plant, agaveStart, vec3(-agaveReach * 0.62, 0.64, agaveReach * 0.44), 0.14, 0.012);
          closeLeaves = min(closeLeaves, taperedSegmentDistance(plant, agaveStart, vec3(agaveReach * 0.24, 0.82, agaveReach * 0.72), 0.13, 0.01));
          closeLeaves = min(closeLeaves, taperedSegmentDistance(plant, agaveStart, vec3(-agaveReach * 0.18, 0.9, -agaveReach * 0.58), 0.12, 0.009));
          succulent = mix(succulent, min(succulent, closeLeaves), plantDetail);
        }
      }

      material = 3.7;
      return morphPlantDistance(coarseDistance, succulent, plantDetail);
    }

    if (isShrub) {
      vec3 shrub = vec3(local.x, point.y - ground + 0.08, local.y);
      shrub.xz *= rotate2((random - 0.5) * 3.6);
      float shrubHeight = mix(1.25, 3.15, age);
      vec3 tipA = vec3(side * 0.72, shrubHeight * 0.72, 0.34) * age;
      vec3 tipB = vec3(-side * 0.64, shrubHeight * 0.86, -0.42) * age;
      vec3 tipC = vec3(0.2, shrubHeight, side * 0.62) * age;
      float shrubWood = taperedSegmentDistance(shrub, vec3(0.0), tipA, 0.14 * age, 0.045);
      shrubWood = min(shrubWood, taperedSegmentDistance(shrub, vec3(0.0, 0.12, 0.0), tipB, 0.13 * age, 0.038));
      shrubWood = min(shrubWood, taperedSegmentDistance(shrub, vec3(0.0, 0.18, 0.0), tipC, 0.11 * age, 0.032));
      float shrubCrown = raggedCrown(shrub - tipA, vec3(0.9, 0.62, 0.78) * age, random * 9.0);
      shrubCrown = min(shrubCrown, raggedCrown(shrub - tipB, vec3(0.78, 0.68, 0.86) * age, random * 13.0));
      shrubCrown = min(shrubCrown, raggedCrown(shrub - tipC, vec3(0.72, 0.74, 0.68) * age, random * 19.0));
      if (plantDetail > 0.002) {
        vec3 forkA = tipA + vec3(side * 0.34, shrubHeight * 0.14, -0.26) * age;
        vec3 forkB = tipB + vec3(-side * 0.28, shrubHeight * 0.12, 0.32) * age;
        vec3 vineMid = tipC + vec3(side * 0.28, -0.36, 0.22) * age;
        vec3 vineTip = vineMid + vec3(-side * 0.2, -0.52, 0.18) * age;
        float closeWood = min(shrubWood, taperedSegmentDistance(shrub, mix(vec3(0.0), tipA, 0.62), forkA, 0.052, 0.016));
        closeWood = min(closeWood, taperedSegmentDistance(shrub, mix(vec3(0.0, 0.12, 0.0), tipB, 0.66), forkB, 0.046, 0.014));
        closeWood = min(closeWood, taperedSegmentDistance(shrub, tipC, vineMid, 0.03, 0.018));
        closeWood = min(closeWood, taperedSegmentDistance(shrub, vineMid, vineTip, 0.018, 0.006));
        float closeCrown = min(shrubCrown, raggedCrown(shrub - forkA, vec3(0.42, 0.32, 0.46) * age, random * 27.0));
        closeCrown = min(closeCrown, raggedCrown(shrub - forkB, vec3(0.38, 0.3, 0.42) * age, random * 31.0));
        shrubWood = mix(shrubWood, closeWood, plantDetail);
        shrubCrown = mix(shrubCrown, closeCrown, plantDetail);
      }
      if (shrubCrown < shrubWood) {
        material = 2.72;
        return morphPlantDistance(coarseDistance, shrubCrown, plantDetail);
      }
      return morphPlantDistance(coarseDistance, shrubWood, plantDetail);
    }

    float height = mix(4.0, 8.2, age);
    if (species < 0.24) height = mix(7.4, 12.8, age);
    else if (species < 0.5) height = mix(4.2, 7.7, age);
    else if (species < 0.88) height = mix(5.6, 10.4, age);
    else height = mix(4.8, 8.8, age);

    vec3 tree = vec3(local.x, point.y - ground + 0.22, local.y);
    float sway = sin(uTime * (0.34 + uMechanicalIntensity * 0.18) * uMotionScale + random * 12.0) * uWind * uMotionScale;
    tree.xz *= rotate2((random - 0.5) * 2.4);
    float vertical = clamp(tree.y / height, 0.0, 1.0);
    vec2 leanSource = vec2(random - 0.38, hash21(cell + 15.2) - 0.56);
    vec2 lean = leanSource / max(length(leanSource), 0.001);
    float leanAmount = species < 0.24 ? 0.34 : mix(0.55, 1.75, hash21(cell + 19.4));
    tree.xz -= lean * pow(vertical, 1.35) * leanAmount;
    tree.x += sway * vertical * vertical * 0.32;

    float baseRadius = species < 0.24 ? 0.3 : species < 0.5 ? 0.46 : species < 0.88 ? 0.62 : 0.32;
    float taper = mix(baseRadius * age, 0.065, vertical);
    float stem = max(length(tree.xz) - taper, max(-tree.y, tree.y - height * 0.92));
    float season = seasonalCycle();
    float leaffulness = smoothstep(0.08, 0.34, season) * (1.0 - smoothstep(0.88, 1.0, season));
    float leafScale = mix(0.38, 1.0, leaffulness);
    float branching = hash21(cell + 73.9);
    float rootPattern = hash21(cell + 57.8);
    float rootAngle = hash21(cell + 61.3) * 6.2831853;
    float rootStrength = baseRadius * age;
    float rootReach = mix(1.05, 2.85, hash21(cell + 66.4)) * mix(0.78, 1.18, species);
    float collarHeight = mix(0.5, 1.05, hash21(cell + 54.2));
    vec3 rootPoint = tree;
    rootPoint.y = point.y - terrainSurface + 0.08;
    vec3 collarScale = vec3(
      rootStrength * mix(1.15, 1.62, hash21(cell + 52.1)),
      collarHeight,
      rootStrength * mix(1.08, 1.55, hash21(cell + 53.6))
    );
    float rootCollar = raggedCrown(rootPoint - vec3(0.0, collarHeight * 0.48, 0.0), collarScale, random * 19.0);
    vec3 rootStart = vec3(0.0, collarHeight * 0.42, 0.0);
    vec3 rootEndA = vec3(cos(rootAngle), 0.035, sin(rootAngle)) * vec3(rootReach, 1.0, rootReach);
    vec3 rootEndB = vec3(cos(rootAngle + 2.18), 0.04, sin(rootAngle + 2.18)) * vec3(rootReach * mix(0.62, 0.92, random), 1.0, rootReach * mix(0.62, 0.92, random));
    vec3 rootEndC = vec3(cos(rootAngle + 4.04), 0.025, sin(rootAngle + 4.04)) * vec3(rootReach * 0.76, 1.0, rootReach * 0.76);
    vec3 rootEndD = vec3(cos(rootAngle + 5.1), 0.03, sin(rootAngle + 5.1)) * vec3(rootReach * 0.58, 1.0, rootReach * 0.58);
    vec3 rootEndE = vec3(cos(rootAngle + 1.08), 0.02, sin(rootAngle + 1.08)) * vec3(rootReach * 0.48, 1.0, rootReach * 0.48);
    float roots = taperedSegmentDistance(rootPoint, rootStart, rootEndA, rootStrength * 0.72, 0.035);
    roots = min(roots, taperedSegmentDistance(rootPoint, rootStart * vec3(1.0, 0.82, 1.0), rootEndB, rootStrength * 0.58, 0.03));
    if (rootPattern > 0.28) roots = min(roots, taperedSegmentDistance(rootPoint, rootStart * vec3(1.0, 0.72, 1.0), rootEndC, rootStrength * 0.5, 0.026));
    if (rootPattern > 0.58) roots = min(roots, taperedSegmentDistance(rootPoint, rootStart * vec3(1.0, 0.62, 1.0), rootEndD, rootStrength * 0.4, 0.022));
    if (rootPattern > 0.84) roots = min(roots, taperedSegmentDistance(rootPoint, rootStart * vec3(1.0, 0.55, 1.0), rootEndE, rootStrength * 0.32, 0.018));
    float wood = min(stem, min(rootCollar, roots));
    float crown = 1000.0;

    if (species < 0.24) {
      leafScale = mix(0.8, 1.0, leaffulness);
      vec3 branchOne = vec3(side * 1.85 * age, height * 0.43, (random - 0.5) * 1.8);
      vec3 branchTwo = vec3(-side * 1.55 * age, height * 0.61, side * 0.9);
      vec3 branchThree = vec3(side * 1.1 * age, height * 0.77, -side * 0.72);
      vec3 forkOneA = branchOne + vec3(side * 0.65, height * 0.045, 0.48) * age;
      vec3 forkOneB = branchOne + vec3(side * 0.42, height * 0.075, -0.52) * age;
      vec3 forkTwoA = branchTwo + vec3(-side * 0.55, height * 0.05, 0.4) * age;
      vec3 forkTwoB = branchTwo + vec3(-side * 0.38, height * 0.08, -0.45) * age;
      vec3 forkThreeA = branchThree + vec3(side * 0.4, height * 0.045, 0.34) * age;
      vec3 forkThreeB = branchThree + vec3(-side * 0.24, height * 0.075, -0.3) * age;
      wood = min(wood, segmentDistance(tree, vec3(0.0, height * 0.31, 0.0), branchOne) - 0.13 * age);
      wood = min(wood, segmentDistance(tree, vec3(0.0, height * 0.5, 0.0), branchTwo) - 0.105 * age);
      wood = min(wood, segmentDistance(tree, vec3(0.0, height * 0.67, 0.0), branchThree) - 0.085 * age);
      if (branching > 0.35 && plantDetail > 0.002) {
        float closeWood = min(wood, segmentDistance(tree, mix(vec3(0.0, height * 0.31, 0.0), branchOne, 0.62), forkOneA) - 0.065 * age);
        closeWood = min(closeWood, segmentDistance(tree, mix(vec3(0.0, height * 0.31, 0.0), branchOne, 0.62), forkOneB) - 0.055 * age);
        closeWood = min(closeWood, segmentDistance(tree, mix(vec3(0.0, height * 0.5, 0.0), branchTwo, 0.65), forkTwoA) - 0.052 * age);
        closeWood = min(closeWood, segmentDistance(tree, mix(vec3(0.0, height * 0.5, 0.0), branchTwo, 0.65), forkTwoB) - 0.046 * age);
        closeWood = min(closeWood, segmentDistance(tree, mix(vec3(0.0, height * 0.67, 0.0), branchThree, 0.68), forkThreeA) - 0.042 * age);
        closeWood = min(closeWood, segmentDistance(tree, mix(vec3(0.0, height * 0.67, 0.0), branchThree, 0.68), forkThreeB) - 0.038 * age);
        float tertiaryDetail = smoothstep(0.42, 0.88, plantDetail);
        if (branching > 0.84 && tertiaryDetail > 0.002) {
          vec3 tertiaryA = forkOneA + vec3(side * 0.3, height * 0.035, -0.24) * age;
          vec3 tertiaryB = forkTwoB + vec3(-side * 0.26, height * 0.04, 0.22) * age;
          vec3 tertiaryC = forkThreeA + vec3(side * 0.22, height * 0.032, 0.18) * age;
          float tertiaryWood = min(closeWood, segmentDistance(tree, forkOneA, tertiaryA) - 0.028 * age);
          tertiaryWood = min(tertiaryWood, segmentDistance(tree, forkTwoB, tertiaryB) - 0.024 * age);
          tertiaryWood = min(tertiaryWood, segmentDistance(tree, forkThreeA, tertiaryC) - 0.021 * age);
          float twigDetail = smoothstep(0.82, 1.0, plantDetail);
          if (branching > 0.92 && twigDetail > 0.002) {
            float twigWood = min(tertiaryWood, segmentDistance(tree, tertiaryA, tertiaryA + vec3(side * 0.16, height * 0.02, 0.14) * age) - 0.012 * age);
            twigWood = min(twigWood, segmentDistance(tree, tertiaryB, tertiaryB + vec3(-side * 0.14, height * 0.022, -0.12) * age) - 0.01 * age);
            twigWood = min(twigWood, segmentDistance(tree, tertiaryC, tertiaryC + vec3(side * 0.12, height * 0.018, -0.1) * age) - 0.009 * age);
            tertiaryWood = mix(tertiaryWood, twigWood, twigDetail);
          }
          closeWood = mix(closeWood, tertiaryWood, tertiaryDetail);
        }
        wood = mix(wood, closeWood, plantDetail);
      }
      crown = raggedCrown(tree - vec3(side * 0.16, height * 0.43, 0.0), vec3(2.05, 0.52, 1.72) * age * leafScale, random * 8.0);
      crown = min(crown, raggedCrown(tree - vec3(lean.x * 0.42, height * 0.91, lean.y * 0.42), vec3(0.82, 0.68, 0.76) * age * leafScale, random * 20.0));
      if (plantDetail > 0.002) {
        float closeCrown = min(crown, raggedCrown(tree - vec3(-side * 0.12, height * 0.61, side * 0.08), vec3(1.62, 0.56, 1.46) * age * leafScale, random * 12.0));
        closeCrown = min(closeCrown, raggedCrown(tree - vec3(side * 0.18, height * 0.77, -side * 0.1), vec3(1.23, 0.58, 1.12) * age * leafScale, random * 16.0));
        crown = mix(crown, closeCrown, plantDetail);
      }
    } else {
      vec3 branchOne = vec3(side * mix(1.45, 2.5, age), height * 0.62, (random - 0.5) * 2.1);
      vec3 branchTwo = vec3(-side * mix(1.25, 2.2, age), height * 0.78, side * mix(0.65, 1.45, random));
      vec3 branchThree = vec3(side * mix(0.55, 1.35, random), height * 0.91, -side * mix(0.8, 1.65, age));
      if (species < 0.5) {
        branchOne.x *= 1.4;
        branchTwo.x *= 0.68;
        branchThree.x *= 1.25;
      }
      wood = min(wood, segmentDistance(tree, vec3(0.0, height * 0.35, 0.0), branchOne) - baseRadius * 0.48);
      wood = min(wood, segmentDistance(tree, vec3(0.0, height * 0.52, 0.0), branchTwo) - baseRadius * 0.36);
      wood = min(wood, segmentDistance(tree, vec3(0.0, height * 0.67, 0.0), branchThree) - baseRadius * 0.28);
      vec3 forkOneA = branchOne + vec3(side * 0.78, height * 0.09, 0.62) * age;
      vec3 forkOneB = branchOne + vec3(side * 0.46, height * 0.14, -0.7) * age;
      vec3 forkTwoA = branchTwo + vec3(-side * 0.7, height * 0.1, 0.55) * age;
      vec3 forkTwoB = branchTwo + vec3(-side * 0.42, height * 0.15, -0.58) * age;
      vec3 forkThreeA = branchThree + vec3(side * 0.55, height * 0.075, 0.46) * age;
      vec3 forkThreeB = branchThree + vec3(-side * 0.34, height * 0.12, -0.44) * age;
      if (branching > 0.22 && plantDetail > 0.002) {
        float closeWood = min(wood, segmentDistance(tree, mix(vec3(0.0, height * 0.35, 0.0), branchOne, 0.64), forkOneA) - baseRadius * 0.22);
        closeWood = min(closeWood, segmentDistance(tree, mix(vec3(0.0, height * 0.35, 0.0), branchOne, 0.64), forkOneB) - baseRadius * 0.18);
        closeWood = min(closeWood, segmentDistance(tree, mix(vec3(0.0, height * 0.52, 0.0), branchTwo, 0.66), forkTwoA) - baseRadius * 0.18);
        closeWood = min(closeWood, segmentDistance(tree, mix(vec3(0.0, height * 0.52, 0.0), branchTwo, 0.66), forkTwoB) - baseRadius * 0.15);
        closeWood = min(closeWood, segmentDistance(tree, mix(vec3(0.0, height * 0.67, 0.0), branchThree, 0.68), forkThreeA) - baseRadius * 0.14);
        closeWood = min(closeWood, segmentDistance(tree, mix(vec3(0.0, height * 0.67, 0.0), branchThree, 0.68), forkThreeB) - baseRadius * 0.12);
        float tertiaryDetail = smoothstep(0.4, 0.86, plantDetail);
        if (branching > 0.76 && tertiaryDetail > 0.002) {
          vec3 tertiaryA = forkOneA + vec3(side * 0.42, height * 0.065, 0.34) * age;
          vec3 tertiaryB = forkOneB + vec3(side * 0.3, height * 0.08, -0.38) * age;
          vec3 tertiaryC = forkTwoA + vec3(-side * 0.36, height * 0.07, 0.3) * age;
          vec3 tertiaryD = forkThreeB + vec3(-side * 0.28, height * 0.06, -0.26) * age;
          float tertiaryWood = min(closeWood, segmentDistance(tree, forkOneA, tertiaryA) - baseRadius * 0.09);
          tertiaryWood = min(tertiaryWood, segmentDistance(tree, forkOneB, tertiaryB) - baseRadius * 0.075);
          tertiaryWood = min(tertiaryWood, segmentDistance(tree, forkTwoA, tertiaryC) - baseRadius * 0.072);
          tertiaryWood = min(tertiaryWood, segmentDistance(tree, forkThreeB, tertiaryD) - baseRadius * 0.06);
          float twigDetail = smoothstep(0.78, 1.0, plantDetail);
          if (branching > 0.86 && twigDetail > 0.002) {
            float twigWood = min(tertiaryWood, segmentDistance(tree, tertiaryA, tertiaryA + vec3(side * 0.24, height * 0.035, -0.2) * age) - baseRadius * 0.038);
            twigWood = min(twigWood, segmentDistance(tree, tertiaryB, tertiaryB + vec3(side * 0.2, height * 0.04, 0.22) * age) - baseRadius * 0.032);
            twigWood = min(twigWood, segmentDistance(tree, tertiaryC, tertiaryC + vec3(-side * 0.22, height * 0.032, -0.18) * age) - baseRadius * 0.03);
            twigWood = min(twigWood, segmentDistance(tree, tertiaryD, tertiaryD + vec3(-side * 0.18, height * 0.03, 0.16) * age) - baseRadius * 0.026);
            tertiaryWood = mix(tertiaryWood, twigWood, twigDetail);
          }
          closeWood = mix(closeWood, tertiaryWood, tertiaryDetail);
        }
        wood = mix(wood, closeWood, plantDetail);
      }

      if (species < 0.88) {
        vec3 firstScale = species < 0.5 ? vec3(1.75, 0.65, 1.18) : vec3(1.65, 1.05, 1.5);
        vec3 secondScale = species < 0.5 ? vec3(1.35, 0.58, 1.0) : vec3(1.45, 0.92, 1.7);
        crown = raggedCrown(tree - branchOne, firstScale * age * leafScale, random * 9.0);
        crown = min(crown, raggedCrown(tree - branchTwo, secondScale * age * leafScale, random * 13.0));
        crown = min(crown, raggedCrown(tree - branchThree, vec3(1.15, 0.82, 1.08) * age * leafScale, random * 17.0));
        if (branching > 0.22 && plantDetail > 0.002) {
          float closeCrown = min(crown, raggedCrown(tree - forkOneA, firstScale * 0.72 * age * leafScale, random * 19.0));
          closeCrown = min(closeCrown, raggedCrown(tree - forkOneB, firstScale * 0.6 * age * leafScale, random * 23.0));
          closeCrown = min(closeCrown, raggedCrown(tree - forkTwoA, secondScale * 0.7 * age * leafScale, random * 27.0));
          closeCrown = min(closeCrown, raggedCrown(tree - forkTwoB, secondScale * 0.58 * age * leafScale, random * 31.0));
          closeCrown = min(closeCrown, raggedCrown(tree - forkThreeA, vec3(0.92, 0.68, 0.86) * age * leafScale, random * 35.0));
          if (species >= 0.5) closeCrown = min(closeCrown, raggedCrown(tree - forkThreeB, vec3(0.82, 0.72, 0.9) * age * leafScale, random * 39.0));
          crown = mix(crown, closeCrown, plantDetail);
        }
      }
    }

    if (crown < wood) {
      material = 2.0 + species;
      return morphPlantDistance(coarseDistance, crown, plantDetail);
    }

    return morphPlantDistance(coarseDistance, wood, plantDetail);
  }
`
