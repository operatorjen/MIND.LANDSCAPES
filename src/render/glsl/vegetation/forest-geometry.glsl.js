export const forestGeometryGlsl = `  float forestDistance(vec3 point, float terrainSurface, out float material) {
    float spacing = TREE_CELL;
    vec2 cell = floor((point.xz + spacing * 0.5) / spacing);
    vec2 center = treeCenterForCell(cell);
    vec2 local = point.xz - center;
    float random = hash21(cell + uSeed * 0.07);
    material = MATERIAL_BARK;
    if (max(abs(local.x), abs(local.y)) > TREE_SAMPLE_LIMIT) return 1000.0;
    float densityRoll = hash21(cell + uSeed * 0.13 + 611.3);
    if (densityRoll > max(uPlantDensity, uTreeDensity)) return 1000.0;

    vec2 structureCell = floor((center + STRUCTURE_CELL_HALF) / STRUCTURE_CELL);
    vec2 structureCenter = structureCenterForCell(structureCell);
    float structureRandom = hash21(structureCell + uSeed * 0.043);
    if (structureRandom < structurePresence() && length(center - structureCenter) < STRUCTURE_CLEARANCE) return 1000.0;

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
    if (random > chance) return 1000.0;

    float ground = terrainHeight(center);
    if (ground < uWaterLevel + VEGETATION_WATER_CLEARANCE) return 1000.0;
    float plantDistance = length(center - cameraPosition.xz);
    float plantDetail = 1.0 - smoothstep(
      PLANT_DETAIL_NEAR * uDetailScale,
      PLANT_DETAIL_FAR * uDetailScale,
      plantDistance
    );

    float kindSelector = hash21(cell + 84.3) * max(vegetationWeight, 0.001);
    bool isSucculent = kindSelector < succulentWeight;
    bool isShrub = !isSucculent && kindSelector < succulentWeight + shrubWeight;
    float density = isSucculent || isShrub ? uPlantDensity : uTreeDensity;
    if (densityRoll > density) return 1000.0;
    float speciesRoll = hash21(cell + 42.6);
    float species = meadowBiome > 0.45 ? mix(0.52, 0.86, speciesRoll) : speciesRoll;
    float age = mix(0.72, 1.24, hash21(cell + 8.7));
    float side = random > 0.5 ? 1.0 : -1.0;
    float treeRotation = (random - 0.5) * 2.4;
    vec2 solarBias = vec2(0.0, 1.0) * rotate2(treeRotation);
    vec2 solarCross = vec2(-solarBias.y, solarBias.x);
    vec2 leanSource = vec2(random - 0.38, hash21(cell + 15.2) - 0.56);
    vec2 lean = leanSource / max(length(leanSource), 0.001);
    float leanAmount = species < 0.24 ? 0.46 : mix(0.62, 1.72, hash21(cell + 19.4));
    float solarLean = mix(0.32, 0.82, hash21(cell + 23.7)) * age;
    float trunkCurveSign = hash21(cell + 32.6) > 0.5 ? 1.0 : -1.0;
    float trunkCurve = mix(0.16, 0.5, hash21(cell + 28.9)) * age * trunkCurveSign;

    vec3 coarsePlant = vec3(local.x, point.y - ground, local.y);
    float coarseDistance = 1000.0;
    float coarseMaterial = MATERIAL_BARK;
    if (isSucculent) {
      float subtype = hash21(cell + 93.1);
      coarseMaterial = MATERIAL_SUCCULENT;
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
      coarseMaterial = MATERIAL_SHRUB;
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
      float coarseBaseRadius = mix(0.26, 0.54, species) * age;
      vec3 coarseTrunkPoint = coarsePlant;
      coarseTrunkPoint.xz *= rotate2(treeRotation);
      float coarseTrunk = curvedTrunkDistance(
        coarseTrunkPoint,
        coarseHeight,
        1.0,
        coarseBaseRadius,
        0.014,
        lean,
        leanAmount,
        solarBias,
        solarLean,
        solarCross,
        trunkCurve
      );
      float coarseRootAngle = hash21(cell + 61.3) * 6.2831853;
      float coarseRootReach = mix(1.1, 2.15, hash21(cell + 66.4)) * age;
      float coarseRootCollar = ellipsoidDistance(
        coarsePlant - vec3(0.0, coarseBaseRadius * 0.34, 0.0),
        vec3(coarseBaseRadius * 1.24, coarseBaseRadius * 0.66, coarseBaseRadius * 1.18)
      );
      float coarseRoots = rootPathDistance(
        coarsePlant,
        coarseRootAngle,
        (hash21(cell + 63.8) - 0.5) * 0.48,
        coarseRootReach,
        coarseBaseRadius * 0.46,
        coarseBaseRadius * 0.18,
        coarseBaseRadius * 0.52,
        0.035
      );
      coarseRoots = min(coarseRoots, rootPathDistance(
        coarsePlant,
        coarseRootAngle + mix(2.0, 2.65, hash21(cell + 85.6)),
        (hash21(cell + 67.9) - 0.5) * 0.58,
        coarseRootReach * mix(0.62, 0.82, random),
        coarseBaseRadius * 0.38,
        coarseBaseRadius * 0.14,
        coarseBaseRadius * 0.4,
        0.028
      ));
      coarseTrunk = min(coarseTrunk, min(coarseRootCollar, coarseRoots));
      float coarseCrown = treeFoliageDistance(
        coarseTrunkPoint,
        cell,
        species,
        age,
        random,
        side,
        coarseHeight,
        lean,
        leanAmount,
        solarBias,
        solarLean,
        solarCross,
        trunkCurve,
        0.0
      );
      if (coarseCrown < coarseTrunk) {
        coarseMaterial = MATERIAL_FOLIAGE_BASE + species;
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
        #if SHADER_QUALITY_LEVEL >= 1
        if (uDetailScale > 0.74 && plantDetail > 0.002) {
          vec3 detailStart = vec3(0.0, cactusHeight * 0.76, 0.0);
          vec3 detailElbow = detailStart + vec3(side * 0.34, 0.04, -0.18);
          vec3 detailTip = detailElbow + vec3(0.06, cactusHeight * 0.13, -0.04);
          float closeGrowth = taperedSegmentDistance(plant, detailStart, detailElbow, cactusRadius * 0.38, cactusRadius * 0.24);
          closeGrowth = min(closeGrowth, taperedSegmentDistance(plant, detailElbow, detailTip, cactusRadius * 0.25, cactusRadius * 0.1));
          succulent = mix(succulent, min(succulent, closeGrowth), plantDetail);
        }
        #endif
      } else if (subtype < 0.78) {
        float barrelRadius = mix(0.42, 0.82, age);
        succulent = raggedCrown(plant - vec3(0.0, barrelRadius * 0.82, 0.0), vec3(barrelRadius, barrelRadius * 1.18, barrelRadius), random * 17.0);
        #if SHADER_QUALITY_LEVEL >= 1
        if (uDetailScale > 0.74 && plantDetail > 0.002) {
          float pups = raggedCrown(plant - vec3(side * barrelRadius * 0.78, barrelRadius * 0.34, 0.18), vec3(barrelRadius * 0.4, barrelRadius * 0.52, barrelRadius * 0.42), random * 23.0);
          succulent = mix(succulent, min(succulent, pups), plantDetail);
        }
        #endif
      } else {
        float agaveReach = mix(0.75, 1.45, age);
        vec3 agaveStart = vec3(0.0, 0.14, 0.0);
        succulent = taperedSegmentDistance(plant, agaveStart, vec3(agaveReach, 0.48, 0.0), 0.2, 0.025);
        succulent = min(succulent, taperedSegmentDistance(plant, agaveStart, vec3(-agaveReach * 0.86, 0.42, 0.38), 0.18, 0.022));
        succulent = min(succulent, taperedSegmentDistance(plant, agaveStart, vec3(0.3, 0.58, agaveReach), 0.19, 0.024));
        succulent = min(succulent, taperedSegmentDistance(plant, agaveStart, vec3(-0.38, 0.5, -agaveReach * 0.9), 0.17, 0.02));
        succulent = min(succulent, taperedSegmentDistance(plant, agaveStart, vec3(agaveReach * 0.58, 0.7, -agaveReach * 0.52), 0.16, 0.018));
        #if SHADER_QUALITY_LEVEL >= 1
        if (uDetailScale > 0.74 && plantDetail > 0.002) {
          float closeLeaves = taperedSegmentDistance(plant, agaveStart, vec3(-agaveReach * 0.62, 0.64, agaveReach * 0.44), 0.14, 0.012);
          closeLeaves = min(closeLeaves, taperedSegmentDistance(plant, agaveStart, vec3(agaveReach * 0.24, 0.82, agaveReach * 0.72), 0.13, 0.01));
          closeLeaves = min(closeLeaves, taperedSegmentDistance(plant, agaveStart, vec3(-agaveReach * 0.18, 0.9, -agaveReach * 0.58), 0.12, 0.009));
          succulent = mix(succulent, min(succulent, closeLeaves), plantDetail);
        }
        #endif
      }

      material = MATERIAL_SUCCULENT;
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
      #if SHADER_QUALITY_LEVEL >= 1
      if (uDetailScale > 0.74 && plantDetail > 0.002) {
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
      #endif
      if (shrubCrown < shrubWood) {
        material = MATERIAL_SHRUB;
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
    tree.xz *= rotate2(treeRotation);

    float baseRadius = species < 0.24 ? 0.3 : species < 0.5 ? 0.46 : species < 0.88 ? 0.62 : 0.32;
    float stem = curvedTrunkDistance(
      tree,
      height,
      1.0,
      baseRadius * age,
      0.008,
      lean,
      leanAmount,
      solarBias,
      solarLean,
      solarCross,
      trunkCurve
    );
    float branching = hash21(cell + 73.9);
    float rootPattern = hash21(cell + 57.8);
    float rootAngle = hash21(cell + 61.3) * 6.2831853;
    float rootStrength = baseRadius * age;
    float rootReach = mix(1.45, 3.75, hash21(cell + 66.4)) * mix(0.82, 1.22, species);
    float collarHeight = mix(0.42, 0.78, hash21(cell + 54.2));
    vec3 rootPoint = tree;
    rootPoint.y = point.y - terrainSurface + 0.08;
    vec3 collarScale = vec3(
      rootStrength * mix(0.92, 1.2, hash21(cell + 52.1)),
      collarHeight * 0.58,
      rootStrength * mix(0.9, 1.16, hash21(cell + 53.6))
    );
    float rootCollar = ellipsoidDistance(rootPoint - vec3(0.0, collarHeight * 0.22, 0.0), collarScale);
    float bendA = (hash21(cell + 63.8) - 0.5) * 0.82;
    float bendB = (hash21(cell + 67.9) - 0.5) * 1.05;
    float bendC = (hash21(cell + 71.6) - 0.5) * 0.94;
    float bendD = (hash21(cell + 75.4) - 0.5) * 1.18;
    float bendE = (hash21(cell + 79.2) - 0.5) * 1.24;
    float reachA = rootReach * mix(1.0, 1.28, hash21(cell + 81.7));
    float reachB = rootReach * mix(0.62, 0.94, random);
    float reachC = rootReach * mix(0.68, 1.02, hash21(cell + 92.3));
    float reachD = rootReach * mix(0.42, 0.72, hash21(cell + 99.6));
    float reachE = rootReach * mix(0.34, 0.58, hash21(cell + 107.5));
    float roots = rootPathDistance(
      rootPoint,
      rootAngle,
      bendA,
      reachA,
      collarHeight * 0.52,
      collarHeight * 0.32,
      rootStrength * mix(0.48, 0.62, hash21(cell + 83.1)),
      0.026
    );
    roots = min(roots, rootPathDistance(
      rootPoint,
      rootAngle + mix(1.65, 2.35, hash21(cell + 85.6)),
      bendB,
      reachB,
      collarHeight * 0.42,
      collarHeight * 0.26,
      rootStrength * mix(0.36, 0.49, hash21(cell + 87.4)),
      0.021
    ));
    roots = min(roots, rootPathDistance(
      rootPoint,
      rootAngle + mix(3.45, 4.2, hash21(cell + 89.8)),
      bendC,
      reachC,
      collarHeight * 0.36,
      collarHeight * 0.21,
      rootStrength * mix(0.29, 0.41, hash21(cell + 94.5)),
      0.018
    ));
    if (rootPattern > 0.34) roots = min(roots, rootPathDistance(
      rootPoint,
      rootAngle + mix(4.65, 5.35, hash21(cell + 97.1)),
      bendD,
      reachD,
      collarHeight * 0.3,
      collarHeight * 0.17,
      rootStrength * mix(0.17, 0.27, hash21(cell + 102.2)),
      0.014
    ));
    if (rootPattern > 0.68) roots = min(roots, rootPathDistance(
      rootPoint,
      rootAngle + mix(0.72, 1.26, hash21(cell + 104.9)),
      bendE,
      reachE,
      collarHeight * 0.26,
      collarHeight * 0.14,
      rootStrength * mix(0.13, 0.22, hash21(cell + 110.1)),
      0.011
    ));
    vec3 simpleCollarScale = vec3(rootStrength * 1.18, collarHeight * 0.64, rootStrength * 1.1);
    float simpleRootCollar = ellipsoidDistance(
      rootPoint - vec3(0.0, collarHeight * 0.25, 0.0),
      simpleCollarScale
    );
    float simpleRoots = rootPathDistance(
      rootPoint,
      rootAngle,
      bendA * 0.42,
      rootReach * 0.64,
      collarHeight * 0.48,
      collarHeight * 0.16,
      rootStrength * 0.56,
      0.04
    );
    simpleRoots = min(simpleRoots, rootPathDistance(
      rootPoint,
      rootAngle + 2.24,
      bendB * 0.38,
      rootReach * 0.48,
      collarHeight * 0.4,
      collarHeight * 0.12,
      rootStrength * 0.43,
      0.032
    ));
    float simpleRootShape = min(simpleRootCollar, simpleRoots);
    float detailedRootShape = min(rootCollar, roots);
    float rootDetail = smoothstep(0.14, 0.86, plantDetail);
    float rootShape = simpleRootShape;
    if (rootDetail > 0.002) rootShape = min(rootShape, detailedRootShape);
    float extendedRoots = min(roots, rootExtensionDistance(
      rootPoint,
      rootAngle,
      bendA,
      reachA,
      collarHeight * 0.34,
      rootStrength * 0.32,
      0.018
    ));
    extendedRoots = min(extendedRoots, rootExtensionDistance(
      rootPoint,
      rootAngle + mix(1.65, 2.35, hash21(cell + 85.6)),
      bendB,
      reachB,
      collarHeight * 0.28,
      rootStrength * 0.25,
      0.014
    ));
    if (rootPattern > 0.28) extendedRoots = min(extendedRoots, rootExtensionDistance(
      rootPoint,
      rootAngle + mix(3.45, 4.2, hash21(cell + 89.8)),
      bendC,
      reachC,
      collarHeight * 0.22,
      rootStrength * 0.19,
      0.011
    ));
    float extensionDetail = smoothstep(0.48, 0.96, plantDetail);
    float closeRootShape = min(rootCollar, extendedRoots);
    if (extensionDetail > 0.002) rootShape = min(rootShape, closeRootShape);
    float wood = min(stem, rootShape);
    float crown = treeFoliageDistance(
      tree,
      cell,
      species,
      age,
      random,
      side,
      height,
      lean,
      leanAmount,
      solarBias,
      solarLean,
      solarCross,
      trunkCurve,
      plantDetail
    );

    if (species < 0.24) {
      vec3 branchOne = vec3(side * 1.85 * age, height * 0.43, (random - 0.5) * 1.8);
      vec3 branchTwo = vec3(-side * 1.55 * age, height * 0.61, side * 0.9);
      vec3 branchThree = vec3(side * 1.1 * age, height * 0.77, -side * 0.72);
      branchOne.xz += trunkGrowthOffset(0.43, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve);
      branchTwo.xz += trunkGrowthOffset(0.61, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve);
      branchThree.xz += trunkGrowthOffset(0.77, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve);
      branchOne.xz += solarBias * mix(0.34, 0.72, hash21(cell + 116.2)) * age;
      branchTwo.xz += solarBias * mix(0.42, 0.84, hash21(cell + 119.7)) * age;
      branchThree.xz += solarBias * mix(0.5, 0.96, hash21(cell + 123.1)) * age;
      branchOne.xz = containedGrowth(branchOne.xz, 2.85);
      branchTwo.xz = containedGrowth(branchTwo.xz, 3.0);
      branchThree.xz = containedGrowth(branchThree.xz, 2.9);
      vec3 branchOneStart = trunkGrowthPoint(0.31, height, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve);
      vec3 branchTwoStart = trunkGrowthPoint(0.5, height, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve);
      vec3 branchThreeStart = trunkGrowthPoint(0.67, height, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve);
      float primaryGrowth = smoothstep(0.0, 0.46, plantDetail);
      branchOne = mix(branchOneStart, branchOne, primaryGrowth);
      branchTwo = mix(branchTwoStart, branchTwo, primaryGrowth);
      branchThree = mix(branchThreeStart, branchThree, primaryGrowth);
      vec3 branchOneArch = branchGrowthBend(cell, 127.4, solarBias, 0.48 * age, height * 0.018 * age);
      vec3 branchTwoArch = branchGrowthBend(cell, 132.8, solarBias, 0.43 * age, height * 0.022 * age);
      vec3 branchThreeArch = branchGrowthBend(cell, 138.5, solarBias, 0.36 * age, height * 0.026 * age);
      vec3 branchOneCurl = branchGrowthBend(cell, 143.9, solarBias, 0.23 * age, -height * 0.006 * age);
      vec3 branchTwoCurl = branchGrowthBend(cell, 149.2, solarBias, 0.2 * age, height * 0.005 * age);
      vec3 branchThreeCurl = branchGrowthBend(cell, 154.6, solarBias, 0.17 * age, -height * 0.004 * age);
      branchOneArch *= primaryGrowth;
      branchTwoArch *= primaryGrowth;
      branchThreeArch *= primaryGrowth;
      branchOneCurl *= primaryGrowth;
      branchTwoCurl *= primaryGrowth;
      branchThreeCurl *= primaryGrowth;
      vec3 branchOneFork = windingPoint(branchOneStart, branchOne, branchOneArch, branchOneCurl, 0.62);
      vec3 branchTwoFork = windingPoint(branchTwoStart, branchTwo, branchTwoArch, branchTwoCurl, 0.65);
      vec3 branchThreeFork = windingPoint(branchThreeStart, branchThree, branchThreeArch, branchThreeCurl, 0.68);
      float secondaryGrowth = smoothstep(0.1, 0.68, plantDetail);
      vec3 forkOneA = branchOneFork + (branchOne + vec3(side * 0.65, height * 0.045, 0.48) * age - branchOneFork) * secondaryGrowth;
      vec3 forkOneB = branchOneFork + (branchOne + vec3(side * 0.42, height * 0.075, -0.52) * age - branchOneFork) * secondaryGrowth;
      vec3 forkTwoA = branchTwoFork + (branchTwo + vec3(-side * 0.55, height * 0.05, 0.4) * age - branchTwoFork) * secondaryGrowth;
      vec3 forkTwoB = branchTwoFork + (branchTwo + vec3(-side * 0.38, height * 0.08, -0.45) * age - branchTwoFork) * secondaryGrowth;
      vec3 forkThreeA = branchThreeFork + (branchThree + vec3(side * 0.4, height * 0.045, 0.34) * age - branchThreeFork) * secondaryGrowth;
      vec3 forkThreeB = branchThreeFork + (branchThree + vec3(-side * 0.24, height * 0.075, -0.3) * age - branchThreeFork) * secondaryGrowth;
      forkOneA.xz += solarBias * 0.16 * age * secondaryGrowth;
      forkOneB.xz += solarBias * 0.2 * age * secondaryGrowth;
      forkTwoA.xz += solarBias * 0.18 * age * secondaryGrowth;
      forkTwoB.xz += solarBias * 0.22 * age * secondaryGrowth;
      forkThreeA.xz += solarBias * 0.2 * age * secondaryGrowth;
      forkThreeB.xz += solarBias * 0.24 * age * secondaryGrowth;
      forkOneA.xz = containedGrowth(forkOneA.xz, 3.48);
      forkOneB.xz = containedGrowth(forkOneB.xz, 3.48);
      forkTwoA.xz = containedGrowth(forkTwoA.xz, 3.48);
      forkTwoB.xz = containedGrowth(forkTwoB.xz, 3.48);
      forkThreeA.xz = containedGrowth(forkThreeA.xz, 3.48);
      forkThreeB.xz = containedGrowth(forkThreeB.xz, 3.48);
      wood = min(wood, windingTaperedDistance(tree, branchOneStart, branchOne, branchOneArch, branchOneCurl, 0.13 * age, 0.055 * age));
      wood = min(wood, windingTaperedDistance(tree, branchTwoStart, branchTwo, branchTwoArch, branchTwoCurl, 0.105 * age, 0.045 * age));
      wood = min(wood, windingTaperedDistance(tree, branchThreeStart, branchThree, branchThreeArch, branchThreeCurl, 0.085 * age, 0.036 * age));
      vec3 branchOneTip = branchOne + vec3(side * 0.38, height * 0.07, 0.24) * age * primaryGrowth;
      vec3 branchTwoTip = branchTwo + vec3(-side * 0.34, height * 0.075, -0.22) * age * primaryGrowth;
      vec3 branchThreeTip = branchThree + vec3(side * 0.3, height * 0.065, 0.2) * age * primaryGrowth;
      branchOneTip.xz = containedGrowth(branchOneTip.xz + solarBias * 0.16 * age * primaryGrowth, 3.48);
      branchTwoTip.xz = containedGrowth(branchTwoTip.xz + solarBias * 0.18 * age * primaryGrowth, 3.48);
      branchThreeTip.xz = containedGrowth(branchThreeTip.xz + solarBias * 0.2 * age * primaryGrowth, 3.48);
      wood = min(wood, twigGrowthDistance(tree, branchOne, branchOneTip, cell, 532.1, solarBias, 0.055 * age));
      wood = min(wood, twigGrowthDistance(tree, branchTwo, branchTwoTip, cell, 537.5, solarBias, 0.045 * age));
      wood = min(wood, twigGrowthDistance(tree, branchThree, branchThreeTip, cell, 542.9, solarBias, 0.036 * age));
      if (branching > 0.35 && secondaryGrowth > 0.002) {
        float closeWood = min(wood, windingTaperedDistance(tree, branchOneFork, forkOneA, branchGrowthBend(cell, 161.2, solarBias, 0.25 * age, height * 0.009 * age), branchGrowthBend(cell, 166.4, solarBias, 0.1 * age, -height * 0.003 * age), 0.065 * age, 0.018 * age));
        closeWood = min(closeWood, windingTaperedDistance(tree, branchOneFork, forkOneB, branchGrowthBend(cell, 171.8, solarBias, 0.27 * age, height * 0.012 * age), branchGrowthBend(cell, 177.1, solarBias, 0.11 * age, height * 0.003 * age), 0.055 * age, 0.016 * age));
        closeWood = min(closeWood, windingTaperedDistance(tree, branchTwoFork, forkTwoA, branchGrowthBend(cell, 182.5, solarBias, 0.23 * age, height * 0.01 * age), branchGrowthBend(cell, 187.9, solarBias, 0.1 * age, -height * 0.003 * age), 0.052 * age, 0.015 * age));
        closeWood = min(closeWood, windingTaperedDistance(tree, branchTwoFork, forkTwoB, branchGrowthBend(cell, 193.2, solarBias, 0.24 * age, height * 0.013 * age), branchGrowthBend(cell, 198.6, solarBias, 0.09 * age, height * 0.003 * age), 0.046 * age, 0.014 * age));
        closeWood = min(closeWood, windingTaperedDistance(tree, branchThreeFork, forkThreeA, branchGrowthBend(cell, 203.9, solarBias, 0.2 * age, height * 0.012 * age), branchGrowthBend(cell, 209.3, solarBias, 0.08 * age, -height * 0.002 * age), 0.042 * age, 0.012 * age));
        closeWood = min(closeWood, windingTaperedDistance(tree, branchThreeFork, forkThreeB, branchGrowthBend(cell, 214.7, solarBias, 0.21 * age, height * 0.014 * age), branchGrowthBend(cell, 220.1, solarBias, 0.08 * age, height * 0.002 * age), 0.038 * age, 0.011 * age));
        float tertiaryDetail = smoothstep(0.34, 0.82, plantDetail);
        #if SHADER_QUALITY_LEVEL >= 1
        if (uDetailScale > 0.74 && tertiaryDetail > 0.002) {
          vec3 tertiaryA = forkOneA + vec3(side * 0.3, height * 0.035, -0.24) * age;
          vec3 tertiaryB = forkTwoB + vec3(-side * 0.26, height * 0.04, 0.22) * age;
          vec3 tertiaryC = forkThreeA + vec3(side * 0.22, height * 0.032, 0.18) * age;
          vec3 tertiaryD = forkOneB + vec3(-side * 0.24, height * 0.046, 0.2) * age;
          vec3 tertiaryE = forkTwoA + vec3(side * 0.22, height * 0.038, -0.2) * age;
          vec3 tertiaryF = forkThreeB + vec3(-side * 0.2, height * 0.034, 0.17) * age;
          tertiaryA = mix(forkOneA, tertiaryA, tertiaryDetail);
          tertiaryB = mix(forkTwoB, tertiaryB, tertiaryDetail);
          tertiaryC = mix(forkThreeA, tertiaryC, tertiaryDetail);
          tertiaryD = mix(forkOneB, tertiaryD, tertiaryDetail);
          tertiaryE = mix(forkTwoA, tertiaryE, tertiaryDetail);
          tertiaryF = mix(forkThreeB, tertiaryF, tertiaryDetail);
          tertiaryA.xz = containedGrowth(tertiaryA.xz, 3.82);
          tertiaryB.xz = containedGrowth(tertiaryB.xz, 3.82);
          tertiaryC.xz = containedGrowth(tertiaryC.xz, 3.82);
          tertiaryD.xz = containedGrowth(tertiaryD.xz, 3.82);
          tertiaryE.xz = containedGrowth(tertiaryE.xz, 3.82);
          tertiaryF.xz = containedGrowth(tertiaryF.xz, 3.82);
          float tertiaryWood = min(closeWood, windingTaperedDistance(tree, forkOneA, tertiaryA, branchGrowthBend(cell, 225.4, solarBias, 0.12 * age, height * 0.005 * age), branchGrowthBend(cell, 230.8, solarBias, 0.045 * age, 0.0), 0.028 * age, 0.009 * age));
          tertiaryWood = min(tertiaryWood, windingTaperedDistance(tree, forkTwoB, tertiaryB, branchGrowthBend(cell, 236.2, solarBias, 0.11 * age, height * 0.006 * age), branchGrowthBend(cell, 241.5, solarBias, 0.04 * age, 0.0), 0.024 * age, 0.008 * age));
          tertiaryWood = min(tertiaryWood, windingTaperedDistance(tree, forkThreeA, tertiaryC, branchGrowthBend(cell, 246.9, solarBias, 0.1 * age, height * 0.005 * age), branchGrowthBend(cell, 252.3, solarBias, 0.035 * age, 0.0), 0.021 * age, 0.007 * age));
          tertiaryWood = min(tertiaryWood, windingTaperedDistance(tree, forkOneB, tertiaryD, branchGrowthBend(cell, 416.4, solarBias, 0.11 * age, height * 0.006 * age), branchGrowthBend(cell, 421.8, solarBias, 0.04 * age, 0.0), 0.023 * age, 0.008 * age));
          tertiaryWood = min(tertiaryWood, windingTaperedDistance(tree, forkTwoA, tertiaryE, branchGrowthBend(cell, 427.2, solarBias, 0.1 * age, height * 0.005 * age), branchGrowthBend(cell, 432.6, solarBias, 0.038 * age, 0.0), 0.022 * age, 0.007 * age));
          tertiaryWood = min(tertiaryWood, windingTaperedDistance(tree, forkThreeB, tertiaryF, branchGrowthBend(cell, 437.9, solarBias, 0.09 * age, height * 0.005 * age), branchGrowthBend(cell, 443.3, solarBias, 0.034 * age, 0.0), 0.019 * age, 0.006 * age));
          float twigDetail = smoothstep(0.7, 0.98, plantDetail);
          #if SHADER_QUALITY_LEVEL >= 2
          if (uDetailScale > 0.84 && branching > 0.65 && twigDetail > 0.002) {
            float twigWood = min(tertiaryWood, twigGrowthDistance(tree, tertiaryA, tertiaryA + vec3(side * 0.16, height * 0.02, 0.14) * age * twigDetail, cell, 470.2, solarBias, 0.012 * age));
            twigWood = min(twigWood, twigGrowthDistance(tree, tertiaryB, tertiaryB + vec3(-side * 0.14, height * 0.022, -0.12) * age * twigDetail, cell, 475.6, solarBias, 0.01 * age));
            twigWood = min(twigWood, twigGrowthDistance(tree, tertiaryC, tertiaryC + vec3(side * 0.12, height * 0.018, -0.1) * age * twigDetail, cell, 481.0, solarBias, 0.009 * age));
            twigWood = min(twigWood, twigGrowthDistance(tree, tertiaryD, tertiaryD + vec3(-side * 0.13, height * 0.02, 0.11) * age * twigDetail, cell, 486.4, solarBias, 0.009 * age));
            twigWood = min(twigWood, twigGrowthDistance(tree, tertiaryE, tertiaryE + vec3(side * 0.12, height * 0.018, -0.1) * age * twigDetail, cell, 491.8, solarBias, 0.008 * age));
            twigWood = min(twigWood, twigGrowthDistance(tree, tertiaryF, tertiaryF + vec3(-side * 0.1, height * 0.017, 0.09) * age * twigDetail, cell, 497.2, solarBias, 0.007 * age));
            tertiaryWood = min(tertiaryWood, twigWood);
          }
          #endif
          closeWood = min(closeWood, tertiaryWood);
        }
        #endif
        wood = min(wood, closeWood);
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
      branchOne.xz += trunkGrowthOffset(0.62, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve);
      branchTwo.xz += trunkGrowthOffset(0.78, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve);
      branchThree.xz += trunkGrowthOffset(0.91, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve);
      branchOne.xz += solarBias * mix(0.42, 0.88, hash21(cell + 258.7)) * age;
      branchTwo.xz += solarBias * mix(0.52, 1.02, hash21(cell + 264.1)) * age;
      branchThree.xz += solarBias * mix(0.62, 1.18, hash21(cell + 269.5)) * age;
      branchOne.xz = containedGrowth(branchOne.xz, 2.85);
      branchTwo.xz = containedGrowth(branchTwo.xz, 3.0);
      branchThree.xz = containedGrowth(branchThree.xz, 2.9);
      vec3 branchOneStart = trunkGrowthPoint(0.35, height, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve);
      vec3 branchTwoStart = trunkGrowthPoint(0.52, height, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve);
      vec3 branchThreeStart = trunkGrowthPoint(0.67, height, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve);
      float primaryGrowth = smoothstep(0.0, 0.46, plantDetail);
      branchOne = mix(branchOneStart, branchOne, primaryGrowth);
      branchTwo = mix(branchTwoStart, branchTwo, primaryGrowth);
      branchThree = mix(branchThreeStart, branchThree, primaryGrowth);
      vec3 branchOneArch = branchGrowthBend(cell, 274.8, solarBias, 0.58 * age, height * 0.026 * age);
      vec3 branchTwoArch = branchGrowthBend(cell, 280.2, solarBias, 0.5 * age, height * 0.03 * age);
      vec3 branchThreeArch = branchGrowthBend(cell, 285.6, solarBias, 0.43 * age, height * 0.034 * age);
      vec3 branchOneCurl = branchGrowthBend(cell, 290.9, solarBias, 0.28 * age, -height * 0.008 * age);
      vec3 branchTwoCurl = branchGrowthBend(cell, 296.3, solarBias, 0.24 * age, height * 0.007 * age);
      vec3 branchThreeCurl = branchGrowthBend(cell, 301.7, solarBias, 0.2 * age, -height * 0.006 * age);
      branchOneArch *= primaryGrowth;
      branchTwoArch *= primaryGrowth;
      branchThreeArch *= primaryGrowth;
      branchOneCurl *= primaryGrowth;
      branchTwoCurl *= primaryGrowth;
      branchThreeCurl *= primaryGrowth;
      vec3 branchOneFork = windingPoint(branchOneStart, branchOne, branchOneArch, branchOneCurl, 0.64);
      vec3 branchTwoFork = windingPoint(branchTwoStart, branchTwo, branchTwoArch, branchTwoCurl, 0.66);
      vec3 branchThreeFork = windingPoint(branchThreeStart, branchThree, branchThreeArch, branchThreeCurl, 0.68);
      wood = min(wood, windingTaperedDistance(tree, branchOneStart, branchOne, branchOneArch, branchOneCurl, baseRadius * 0.48, baseRadius * 0.19));
      wood = min(wood, windingTaperedDistance(tree, branchTwoStart, branchTwo, branchTwoArch, branchTwoCurl, baseRadius * 0.36, baseRadius * 0.15));
      wood = min(wood, windingTaperedDistance(tree, branchThreeStart, branchThree, branchThreeArch, branchThreeCurl, baseRadius * 0.28, baseRadius * 0.12));
      vec3 branchOneTip = branchOne + vec3(side * 0.54, height * 0.075, 0.34) * age * primaryGrowth;
      vec3 branchTwoTip = branchTwo + vec3(-side * 0.48, height * 0.085, -0.32) * age * primaryGrowth;
      vec3 branchThreeTip = branchThree + vec3(side * 0.4, height * 0.07, 0.28) * age * primaryGrowth;
      branchOneTip.xz = containedGrowth(branchOneTip.xz + solarBias * 0.2 * age * primaryGrowth, 3.48);
      branchTwoTip.xz = containedGrowth(branchTwoTip.xz + solarBias * 0.22 * age * primaryGrowth, 3.48);
      branchThreeTip.xz = containedGrowth(branchThreeTip.xz + solarBias * 0.24 * age * primaryGrowth, 3.48);
      wood = min(wood, twigGrowthDistance(tree, branchOne, branchOneTip, cell, 548.3, solarBias, baseRadius * 0.19));
      wood = min(wood, twigGrowthDistance(tree, branchTwo, branchTwoTip, cell, 553.7, solarBias, baseRadius * 0.15));
      wood = min(wood, twigGrowthDistance(tree, branchThree, branchThreeTip, cell, 559.1, solarBias, baseRadius * 0.12));
      float secondaryGrowth = smoothstep(0.1, 0.68, plantDetail);
      vec3 forkOneA = branchOneFork + (branchOne + vec3(side * 0.78, height * 0.09, 0.62) * age - branchOneFork) * secondaryGrowth;
      vec3 forkOneB = branchOneFork + (branchOne + vec3(side * 0.46, height * 0.14, -0.7) * age - branchOneFork) * secondaryGrowth;
      vec3 forkTwoA = branchTwoFork + (branchTwo + vec3(-side * 0.7, height * 0.1, 0.55) * age - branchTwoFork) * secondaryGrowth;
      vec3 forkTwoB = branchTwoFork + (branchTwo + vec3(-side * 0.42, height * 0.15, -0.58) * age - branchTwoFork) * secondaryGrowth;
      vec3 forkThreeA = branchThreeFork + (branchThree + vec3(side * 0.55, height * 0.075, 0.46) * age - branchThreeFork) * secondaryGrowth;
      vec3 forkThreeB = branchThreeFork + (branchThree + vec3(-side * 0.34, height * 0.12, -0.44) * age - branchThreeFork) * secondaryGrowth;
      forkOneA.xz += solarBias * 0.2 * age * secondaryGrowth;
      forkOneB.xz += solarBias * 0.25 * age * secondaryGrowth;
      forkTwoA.xz += solarBias * 0.23 * age * secondaryGrowth;
      forkTwoB.xz += solarBias * 0.28 * age * secondaryGrowth;
      forkThreeA.xz += solarBias * 0.26 * age * secondaryGrowth;
      forkThreeB.xz += solarBias * 0.31 * age * secondaryGrowth;
      forkOneA.xz = containedGrowth(forkOneA.xz, 3.48);
      forkOneB.xz = containedGrowth(forkOneB.xz, 3.48);
      forkTwoA.xz = containedGrowth(forkTwoA.xz, 3.48);
      forkTwoB.xz = containedGrowth(forkTwoB.xz, 3.48);
      forkThreeA.xz = containedGrowth(forkThreeA.xz, 3.48);
      forkThreeB.xz = containedGrowth(forkThreeB.xz, 3.48);
      if (branching > 0.22 && secondaryGrowth > 0.002) {
        float closeWood = min(wood, windingTaperedDistance(tree, branchOneFork, forkOneA, branchGrowthBend(cell, 307.1, solarBias, 0.31 * age, height * 0.015 * age), branchGrowthBend(cell, 312.5, solarBias, 0.12 * age, -height * 0.004 * age), baseRadius * 0.22, baseRadius * 0.065));
        closeWood = min(closeWood, windingTaperedDistance(tree, branchOneFork, forkOneB, branchGrowthBend(cell, 317.8, solarBias, 0.33 * age, height * 0.019 * age), branchGrowthBend(cell, 323.2, solarBias, 0.13 * age, height * 0.004 * age), baseRadius * 0.18, baseRadius * 0.055));
        closeWood = min(closeWood, windingTaperedDistance(tree, branchTwoFork, forkTwoA, branchGrowthBend(cell, 328.6, solarBias, 0.29 * age, height * 0.017 * age), branchGrowthBend(cell, 333.9, solarBias, 0.11 * age, -height * 0.004 * age), baseRadius * 0.18, baseRadius * 0.052));
        closeWood = min(closeWood, windingTaperedDistance(tree, branchTwoFork, forkTwoB, branchGrowthBend(cell, 339.3, solarBias, 0.3 * age, height * 0.021 * age), branchGrowthBend(cell, 344.7, solarBias, 0.11 * age, height * 0.004 * age), baseRadius * 0.15, baseRadius * 0.046));
        closeWood = min(closeWood, windingTaperedDistance(tree, branchThreeFork, forkThreeA, branchGrowthBend(cell, 350.1, solarBias, 0.26 * age, height * 0.019 * age), branchGrowthBend(cell, 355.4, solarBias, 0.1 * age, -height * 0.003 * age), baseRadius * 0.14, baseRadius * 0.042));
        closeWood = min(closeWood, windingTaperedDistance(tree, branchThreeFork, forkThreeB, branchGrowthBend(cell, 360.8, solarBias, 0.27 * age, height * 0.022 * age), branchGrowthBend(cell, 366.2, solarBias, 0.1 * age, height * 0.003 * age), baseRadius * 0.12, baseRadius * 0.038));
        float tertiaryDetail = smoothstep(0.32, 0.8, plantDetail);
        #if SHADER_QUALITY_LEVEL >= 1
        if (uDetailScale > 0.74 && tertiaryDetail > 0.002) {
          vec3 tertiaryA = forkOneA + vec3(side * 0.42, height * 0.065, 0.34) * age;
          vec3 tertiaryB = forkOneB + vec3(side * 0.3, height * 0.08, -0.38) * age;
          vec3 tertiaryC = forkTwoA + vec3(-side * 0.36, height * 0.07, 0.3) * age;
          vec3 tertiaryD = forkThreeB + vec3(-side * 0.28, height * 0.06, -0.26) * age;
          vec3 tertiaryE = forkTwoB + vec3(side * 0.32, height * 0.075, -0.3) * age;
          vec3 tertiaryF = forkThreeA + vec3(side * 0.3, height * 0.062, 0.27) * age;
          tertiaryA = mix(forkOneA, tertiaryA, tertiaryDetail);
          tertiaryB = mix(forkOneB, tertiaryB, tertiaryDetail);
          tertiaryC = mix(forkTwoA, tertiaryC, tertiaryDetail);
          tertiaryD = mix(forkThreeB, tertiaryD, tertiaryDetail);
          tertiaryE = mix(forkTwoB, tertiaryE, tertiaryDetail);
          tertiaryF = mix(forkThreeA, tertiaryF, tertiaryDetail);
          tertiaryA.xz = containedGrowth(tertiaryA.xz, 3.82);
          tertiaryB.xz = containedGrowth(tertiaryB.xz, 3.82);
          tertiaryC.xz = containedGrowth(tertiaryC.xz, 3.82);
          tertiaryD.xz = containedGrowth(tertiaryD.xz, 3.82);
          tertiaryE.xz = containedGrowth(tertiaryE.xz, 3.82);
          tertiaryF.xz = containedGrowth(tertiaryF.xz, 3.82);
          float tertiaryWood = min(closeWood, windingTaperedDistance(tree, forkOneA, tertiaryA, branchGrowthBend(cell, 371.5, solarBias, 0.16 * age, height * 0.009 * age), branchGrowthBend(cell, 376.9, solarBias, 0.055 * age, 0.0), baseRadius * 0.09, baseRadius * 0.025));
          tertiaryWood = min(tertiaryWood, windingTaperedDistance(tree, forkOneB, tertiaryB, branchGrowthBend(cell, 382.3, solarBias, 0.15 * age, height * 0.01 * age), branchGrowthBend(cell, 387.6, solarBias, 0.05 * age, 0.0), baseRadius * 0.075, baseRadius * 0.022));
          tertiaryWood = min(tertiaryWood, windingTaperedDistance(tree, forkTwoA, tertiaryC, branchGrowthBend(cell, 393.0, solarBias, 0.14 * age, height * 0.009 * age), branchGrowthBend(cell, 398.4, solarBias, 0.05 * age, 0.0), baseRadius * 0.072, baseRadius * 0.021));
          tertiaryWood = min(tertiaryWood, windingTaperedDistance(tree, forkThreeB, tertiaryD, branchGrowthBend(cell, 403.7, solarBias, 0.13 * age, height * 0.008 * age), branchGrowthBend(cell, 409.1, solarBias, 0.045 * age, 0.0), baseRadius * 0.06, baseRadius * 0.018));
          tertiaryWood = min(tertiaryWood, windingTaperedDistance(tree, forkTwoB, tertiaryE, branchGrowthBend(cell, 448.7, solarBias, 0.14 * age, height * 0.009 * age), branchGrowthBend(cell, 454.1, solarBias, 0.048 * age, 0.0), baseRadius * 0.068, baseRadius * 0.02));
          tertiaryWood = min(tertiaryWood, windingTaperedDistance(tree, forkThreeA, tertiaryF, branchGrowthBend(cell, 459.5, solarBias, 0.13 * age, height * 0.008 * age), branchGrowthBend(cell, 464.8, solarBias, 0.045 * age, 0.0), baseRadius * 0.062, baseRadius * 0.018));
          float twigDetail = smoothstep(0.66, 0.96, plantDetail);
          #if SHADER_QUALITY_LEVEL >= 2
          if (uDetailScale > 0.84 && branching > 0.6 && twigDetail > 0.002) {
            float twigWood = min(tertiaryWood, twigGrowthDistance(tree, tertiaryA, tertiaryA + vec3(side * 0.24, height * 0.035, -0.2) * age * twigDetail, cell, 502.6, solarBias, baseRadius * 0.038));
            twigWood = min(twigWood, twigGrowthDistance(tree, tertiaryB, tertiaryB + vec3(side * 0.2, height * 0.04, 0.22) * age * twigDetail, cell, 508.0, solarBias, baseRadius * 0.032));
            twigWood = min(twigWood, twigGrowthDistance(tree, tertiaryC, tertiaryC + vec3(-side * 0.22, height * 0.032, -0.18) * age * twigDetail, cell, 513.4, solarBias, baseRadius * 0.03));
            twigWood = min(twigWood, twigGrowthDistance(tree, tertiaryD, tertiaryD + vec3(-side * 0.18, height * 0.03, 0.16) * age * twigDetail, cell, 518.8, solarBias, baseRadius * 0.026));
            twigWood = min(twigWood, twigGrowthDistance(tree, tertiaryE, tertiaryE + vec3(side * 0.2, height * 0.034, -0.18) * age * twigDetail, cell, 524.2, solarBias, baseRadius * 0.028));
            twigWood = min(twigWood, twigGrowthDistance(tree, tertiaryF, tertiaryF + vec3(side * 0.18, height * 0.03, 0.16) * age * twigDetail, cell, 529.6, solarBias, baseRadius * 0.025));
            tertiaryWood = min(tertiaryWood, twigWood);
          }
          #endif
          closeWood = min(closeWood, tertiaryWood);
        }
        #endif
        wood = min(wood, closeWood);
      }
    }

    float detailedDistance = min(crown, wood);
    if (coarseDistance <= detailedDistance) {
      material = coarseMaterial;
      return coarseDistance;
    }
    if (crown < wood) {
      material = MATERIAL_FOLIAGE_BASE + species;
      return crown;
    }

    return wood;
  }`
