export const lightingGlsl = `
  vec2 landscapePigmentFlow(vec3 position) {
    vec2 folded = foldedPoint(position.xz);
    float drift = sin(folded.y * 0.018 + uSeed * 0.37) * 1.35;
    float dunePhase = folded.x * 0.42 + sin(folded.y * 0.06) * 2.4;
    float duneTone = 0.5 + 0.5 * sin(dunePhase + drift * 0.42 - 0.65);
    float hillPhase = (folded.x * 0.038 + folded.y * 0.021) * uTerrainScale;
    float hillTone = 0.5 + 0.5 * sin(hillPhase + drift + position.y * 0.11);
    return smoothstep(vec2(0.0), vec2(1.0), vec2(duneTone, hillTone));
  }

  vec3 dreamMeadowPigment(vec3 position) {
    float tone = landscapePigmentFlow(position).y;
    vec3 deep = vec3(0.075, 0.19, 0.20);
    vec3 middle = vec3(0.29, 0.43, 0.32);
    vec3 pale = vec3(0.66, 0.73, 0.49);
    vec3 pigment = mix(deep, middle, smoothstep(0.0, 0.58, tone));
    pigment = mix(pigment, pale, smoothstep(0.42, 1.0, tone));
    return mix(pigment, pigment * 0.82 + uSkyColor * 0.18, 0.16);
  }
  vec3 shadeScene(vec3 direction, vec3 position, float distanceFromCamera, float material) {
    vec3 normal = sceneNormal(position, distanceFromCamera, material);
    vec3 geometricNormal = normal;
    vec3 lightDirection = sunDirection();
    float daylight = daylightAmount();
    float season = seasonalCycle();
    float surfaceDetail = proximityDetail(position.xz, 7.0, 64.0);
    float microDetail = proximityDetail(position.xz, 3.0, 18.0);
    BarkContourSample barkSample;
    ConcreteAggregateSample concreteSample;
    float courtyardPlaster = courtyardMaterialMatch(material, MATERIAL_COURTYARD_STONE);
    float courtyardRock = courtyardMaterialMatch(material, MATERIAL_COURTYARD_ROCK);
    if (material > MATERIAL_TERRAIN_MAX && material < MATERIAL_BARK_MAX) {
      normal = barkContourNormal(position, normal, surfaceDetail, microDetail, barkSample);
    }
    if (material >= MATERIAL_CONCRETE && material < MATERIAL_CONCRETE_MAX) {
      if (courtyardPlaster > 0.5) normal = courtyardPlasterNormal(position, normal, surfaceDetail);
      else if (courtyardRock > 0.5) normal = courtyardRockNormal(position, normal, surfaceDetail);
      else normal = concreteAggregateNormal(position, normal, surfaceDetail, microDetail, concreteSample);
    }
    float treeLeafDetail = material > MATERIAL_BARK_MAX && material < MATERIAL_FOLIAGE_MAX ? microDetail : 0.0;
    float courtyardLeafDetail = courtyardMaterialMatch(material, MATERIAL_COURTYARD_FOLIAGE) * surfaceDetail;
    #if SHADER_QUALITY_LEVEL >= 1
    float leafSurfaceDetail = max(treeLeafDetail, courtyardLeafDetail);
    if (leafSurfaceDetail > 0.002) {
      vec3 leafWave = sin(position.zxy * vec3(18.0, 23.0, 20.0) + position.yzx * vec3(7.0, -9.0, 11.0) + uSeed);
      float leafGrain = dot(leafWave, vec3(0.36, 0.29, 0.35));
      normal = normalize(normal + leafWave * leafGrain * leafSurfaceDetail * 0.09);
    }
    #endif
    normal = petalMicroNormal(position, normal, material);
    float diffuse = pow(max(dot(normal, lightDirection), 0.0), 1.0 + uLightDrama * 1.35);
    vec3 surface;

    if (courtyardMaterialMatch(material, MATERIAL_COURTYARD_FOLIAGE) > 0.5) {
      surface = courtyardFoliageColor(position, normal);
    } else if (courtyardMaterialMatch(material, MATERIAL_COURTYARD_SOIL) > 0.5) {
      surface = courtyardSoilColor(position);
    } else if (courtyardMaterialMatch(material, MATERIAL_COURTYARD_STONE) > 0.5) {
      surface = courtyardStoneColor(position, geometricNormal);
    } else if (courtyardRock > 0.5) {
      surface = courtyardRockColor(position, normal);
    } else if (material < MATERIAL_TERRAIN_MAX) {
      float slope = 1.0 - normal.y;
      vec2 biomePoint = foldedPoint(position.xz);
      float macroBiome = fbm(biomePoint * 0.011 + uSeed * 0.19);
      float meadowField = fbm(biomePoint * 0.019 - uSeed * 0.27);
      float duneField = pow(0.5 + 0.5 * sin(biomePoint.y * 0.008 + biomePoint.x * 0.004), 3.0);
      float riverDistance = abs(position.x - riverCenter(position.z));
      float moisture = exp(-riverDistance * riverDistance * 0.035);
      float duneBias = clamp(0.16 + uDunes * 0.62 + max(uWarmth, 0.0) * 0.14, 0.0, 1.25);
      float duneBiome = smoothstep(0.5, 0.78, duneField * 0.64 + macroBiome * 0.32 + duneBias * 0.35 - moisture * 0.28);
      float meadowBiome = smoothstep(0.37, 0.72, meadowField + moisture * 0.24 + uGrasses * 0.16 - duneBiome * 0.58);
      float heightRock = smoothstep(2.4, 8.5, position.y) * clamp(0.2 + uMountains * 0.72, 0.0, 1.0);
      float rockBiome = clamp(smoothstep(0.2, 0.58, slope) + heightRock * (1.0 - duneBiome), 0.0, 1.0);
      float pattern = fbm(position.xz * 0.12 + uSeed * 0.4);
      vec3 lowColor = mix(uGroundColor * 0.58, uAccentColor * 0.45, pattern);
      vec3 highColor = mix(uGroundColor, uAccentColor, smoothstep(0.28, 0.78, pattern));
      surface = mix(lowColor, highColor, smoothstep(-0.7, 5.2, position.y));
      surface = mix(surface, uGroundColor * 0.42, smoothstep(0.2, 0.75, slope));

      float sandGrain = noise21(position.xz * 5.8 + uSeed * 0.7);
      float windLines = 0.5 + 0.5 * sin(biomePoint.x * 0.82 + sin(biomePoint.y * 0.12) * 2.2);
      float duneTone = landscapePigmentFlow(position).x;
      vec3 lavenderSand = vec3(0.24, 0.19, 0.32);
      vec3 roseSand = vec3(0.62, 0.39, 0.39);
      vec3 champagneSand = vec3(0.88, 0.73, 0.51);
      vec3 duneSand = mix(lavenderSand, roseSand, smoothstep(0.0, 0.58, duneTone));
      duneSand = mix(duneSand, champagneSand, smoothstep(0.42, 1.0, duneTone));
      duneSand = mix(duneSand, duneSand * 0.82 + uAccentColor * 0.18, 0.16);
      duneSand *= 0.94 + windLines * 0.07 + sandGrain * 0.05;
      surface = mix(surface, duneSand, duneBiome * (1.0 - rockBiome * 0.45));

      float rockGrain = fbm(position.xz * 0.21 + position.y * 0.05 + uSeed * 0.31);
      vec3 stone = mix(uGroundColor * 0.3, vec3(0.34, 0.33, 0.3), rockGrain);
      stone *= 0.72 + noise21(position.xz * 2.7 + uSeed) * 0.28;
      surface = mix(surface, stone, rockBiome * 0.86);

      float river = clamp(riverMask(position.xz), 0.0, 1.0);
      float wetBank = moisture * clamp(0.18 + uRivers * 0.92, 0.0, 0.82);
      vec3 bankColor = mix(uGroundColor * 0.22, uSkyColor * 0.2 + vec3(0.08, 0.09, 0.07), macroBiome);
      surface = mix(surface, bankColor, wetBank * (1.0 - duneBiome * 0.38));
      surface = mix(surface, uGroundColor * 0.2 + uSkyColor * 0.2, river * 0.78);
      MeadowGrassSample grassSample = sampleMeadowGrass(
        position,
        surfaceDetail,
        meadowBiome,
        slope,
        river,
        duneBiome,
        rockBiome,
        season
      );
      vec3 meadowColor = mix(uGroundColor * 0.48, grassSample.color, 0.72);
      surface = mix(surface, meadowColor * (0.78 + grassSample.fiber * 0.32), grassSample.coverage);
      float hillWash = meadowBiome * (1.0 - duneBiome) * (1.0 - rockBiome)
        * (1.0 - river) * (1.0 - wetBank * 0.7);
      vec3 hillPigment = dreamMeadowPigment(position);
      surface = mix(surface, hillPigment * (0.92 + grassSample.fiber * 0.12), hillWash * 0.74);
      float pigmentBand = 0.5 + 0.5 * sin(position.y * 1.7 + pattern * 6.0);
      surface = mix(surface, mix(uAccentColor, uSkyColor, pigmentBand), clamp(uPsychedelicIntensity * 0.34, 0.0, 0.62));
      vec2 ecologyCell = floor((position.xz + STRUCTURE_CELL_HALF) / STRUCTURE_CELL);
      if (cultivationCell(ecologyCell)) {
        vec2 plantingCenter = plantingCenterForCell(ecologyCell);
        float plantingDistance = length(position.xz - plantingCenter);
        float plantingSoil = 1.0 - smoothstep(3.8, 5.25, plantingDistance);
        vec3 livingSoil = mix(vec3(0.095, 0.065, 0.045), uGroundColor * 0.3, noise21(position.xz * 1.8 + uSeed) * 0.34);
        surface = mix(surface, livingSoil, plantingSoil * 0.76);
      }
      float focusDistance = length(position.xz - uPlantingFocus.xy);
      float focusFill = (1.0 - smoothstep(uPlantingFocus.z - 0.3, uPlantingFocus.z, focusDistance)) * uPlantingFocus.w;
      float focusRing = (1.0 - smoothstep(0.0, 0.16, abs(focusDistance - uPlantingFocus.z + 0.2))) * uPlantingFocus.w;
      surface = mix(surface, vec3(0.36, 0.78, 0.46), focusFill * 0.18 + focusRing * 0.62);
      if (dryStructureInterior(position)) {
        float stoneGrain = noise21(position.xz * 2.7 + uSeed);
        surface = mix(vec3(0.27, 0.29, 0.28), vec3(0.43, 0.435, 0.41), stoneGrain * 0.45 + 0.25);
      }
    } else if (material < MATERIAL_BARK_MAX) {
      float spacing = TREE_CELL;
      vec2 treeCell = floor((position.xz + spacing * 0.5) / spacing);
      float treeSpecies = hash21(treeCell + 42.6);
      vec3 deepUmber = vec3(0.105, 0.064, 0.038);
      vec3 warmSienna = vec3(0.29, 0.145, 0.068);
      vec3 ashBrown = vec3(0.205, 0.185, 0.16);
      vec3 softBlack = vec3(0.035, 0.033, 0.031);
      vec3 barkBase = barkSample.palette < 0.28 ? deepUmber
        : barkSample.palette < 0.56 ? warmSienna
        : barkSample.palette < 0.8 ? ashBrown
        : mix(deepUmber, softBlack, 0.76);
      barkBase = mix(barkBase, softBlack, barkSample.charcoal * 0.68);
      barkBase = mix(barkBase, uGroundColor * 0.34, 0.2 + treeSpecies * 0.08);
      vec3 fadedOchre = vec3(0.54, 0.365, 0.17);
      vec3 weatheredTaupe = vec3(0.36, 0.315, 0.255);
      vec3 oxidizedBrown = vec3(0.38, 0.17, 0.075);
      vec3 paleRidge = vec3(0.66, 0.49, 0.3);
      vec3 ridgeBrown = barkSample.ridgeTone < 0.24 ? fadedOchre
        : barkSample.ridgeTone < 0.49 ? weatheredTaupe
        : barkSample.ridgeTone < 0.74 ? oxidizedBrown
        : barkSample.ridgeTone < 0.91 ? paleRidge
        : mix(softBlack, deepUmber, 0.42);
      ridgeBrown = mix(ridgeBrown, weatheredTaupe, barkSample.patina * 0.46);
      ridgeBrown = mix(ridgeBrown, uAccentColor * 0.46 + ridgeBrown * 0.58, 0.14);
      vec3 contourBark = ridgeBrown * mix(0.78, 1.18, barkSample.baseTone);
      vec3 darkBark = barkBase * mix(0.72, 1.14, barkSample.baseTone);
      surface = mix(darkBark, contourBark, barkSample.ridge * 0.86);
      surface *= 1.0 - barkSample.channel * 0.24;
      surface *= 1.0 - barkSample.fleck * 0.16;
      surface = mix(surface, uSkyColor * 0.28 + vec3(0.1, 0.14, 0.07), barkSample.lichen * 0.24);
    } else if (material < MATERIAL_FOLIAGE_MAX) {
      float spacing = TREE_CELL;
      vec2 treeCell = floor((position.xz + spacing * 0.5) / spacing);
      float treeSpecies = hash21(treeCell + 42.6);
      float pattern = fbm(position.xz * 0.12 + uSeed * 0.4);
      float leafPattern = 0.5 + 0.5 * sin(position.y * 2.1 + position.x * 1.7 + pattern * 8.0);
      float spring = smoothstep(0.08, 0.26, season) * (1.0 - smoothstep(0.38, 0.52, season));
      float autumn = smoothstep(0.58, 0.74, season) * (1.0 - smoothstep(0.9, 1.0, season));
      vec3 springColor = vec3(0.2, 0.38, 0.1) + uSkyColor * 0.12;
      vec3 summerColor = vec3(0.055, 0.2, 0.08) + uGroundColor * 0.16;
      vec3 autumnColor = mix(uAccentColor * 0.92, vec3(0.62, 0.16, 0.035), 0.5 + leafPattern * 0.32);
      vec3 foliage = mix(summerColor, springColor, spring);
      foliage = mix(foliage, autumnColor, autumn);
      if (treeSpecies < 0.24) foliage = mix(vec3(0.025, 0.12, 0.075), uSkyColor * 0.18 + vec3(0.03, 0.1, 0.07), leafPattern * 0.35);
      else if (treeSpecies < 0.5) foliage = mix(foliage, vec3(0.24, 0.29, 0.12) + uAccentColor * 0.12, 0.32);
      else foliage = mix(foliage, vec3(0.08, 0.22, 0.1) + uGroundColor * 0.12, treeSpecies * 0.18);
      foliage = mix(foliage * 0.7, foliage * 1.18, leafPattern);
      float growthAge = fract(treeSpecies * 4.73 + leafPattern * 0.41 + pattern * 0.23);
      float oldGrowth = smoothstep(0.3, 0.78, growthAge);
      vec3 warmLeaf = mix(vec3(0.48, 0.075, 0.025), vec3(0.82, 0.31, 0.045), growthAge);
      foliage = mix(foliage, warmLeaf, 0.08 + oldGrowth * mix(0.34, 0.58, autumn));
      float berryIdentity = 0.5 + 0.5 * sin(
        dot(position, vec3(1.07, 0.83, 0.91)) + treeSpecies * 8.0 + uSeed * 0.017
      );
      vec3 pomegranate = vec3(1.0, 0.012, 0.055);
      vec3 hotPink = vec3(1.48, 0.035, 0.54);
      vec3 mutedGreen = vec3(0.24, 0.5, 0.23);
      vec3 berryColor = mix(pomegranate, hotPink, smoothstep(0.08, 0.56, berryIdentity));
      berryColor = mix(berryColor, mutedGreen, smoothstep(0.48, 0.94, berryIdentity));
      float berryDetail = smoothstep(0.18, 0.78, surfaceDetail);
      foliage = mix(foliage, berryColor, berryDetail * 0.97);
      vec3 foliageView = normalize(cameraPosition - position);
      float sphereExterior = clamp(
        max(dot(normal, lightDirection), 0.0) * 0.62
          + max(dot(normal, foliageView), 0.0) * 0.24
          + max(normal.y, 0.0) * 0.14,
        0.0,
        1.0
      );
      float sphereVolume = mix(0.52, 1.2, smoothstep(0.08, 0.88, sphereExterior));
      foliage *= mix(1.0, sphereVolume, microDetail * 0.86);
      #if SHADER_QUALITY_LEVEL >= 1
      if (microDetail > 0.002) {
        float berryBloom = noise21(position.xz * 7.2 + position.y * vec2(2.1, -1.7) + uSeed);
        float berryBlush = smoothstep(0.34, 0.82, berryBloom + sphereExterior * 0.22);
        vec3 detailedBerry = mix(foliage * 0.78, foliage * 1.13, berryBlush);
        detailedBerry = mix(detailedBerry, vec3(0.92, 0.72, 0.68), pow(sphereExterior, 6.0) * 0.16);
        foliage = mix(foliage, detailedBerry, microDetail * 0.72);
      }
      #endif
      vec3 spectralLeaf = mix(uAccentColor.gbr, uSkyColor.brg, leafPattern);
      float spectralAmount = clamp(uPsychedelicIntensity * 0.18, 0.0, 0.38) * mix(1.0, 0.18, berryDetail);
      surface = mix(foliage, spectralLeaf, spectralAmount);
      surface += pow(leafPattern, 8.0) * uRitualIntensity * uAccentColor * 0.18;
    } else if (material < MATERIAL_SUCCULENT_MAX) {
      float spacing = TREE_CELL;
      vec2 cactusCell = floor((position.xz + spacing * 0.5) / spacing);
      vec2 cactusLocal = position.xz - treeCenterForCell(cactusCell);
      float cactusAngle = atan(cactusLocal.y, cactusLocal.x);
      float ribs = pow(0.5 + 0.5 * cos(cactusAngle * 12.0), 2.0);
      float wax = 0.5;
      float scars = 0.0;
      if (surfaceDetail > 0.002) {
        wax = mix(0.5, fbm(position.xz * 0.7 + position.y * 0.08 + uSeed * 0.16), surfaceDetail);
        scars = smoothstep(0.76, 0.93, noise21(vec2(position.y * 0.46, cactusAngle * 2.2) + uSeed)) * surfaceDetail;
      }
      ribs = mix(0.5, ribs, surfaceDetail);
      vec3 blueGreen = vec3(0.035, 0.24, 0.16) + uSkyColor * 0.11;
      vec3 sunGreen = vec3(0.16, 0.48, 0.19) + uAccentColor * 0.12;
      surface = mix(blueGreen, sunGreen, ribs * 0.48 + wax * 0.34);
      surface *= 1.0 - scars * 0.24;
      surface += ribs * vec3(0.17, 0.28, 0.08) * (0.32 + uChromaticIntensity * 0.14);
      surface = mix(surface, uAccentColor.gbr * 0.58, clamp(uPsychedelicIntensity * 0.16, 0.0, 0.32));
    } else if (material < MATERIAL_GRASS_MAX) {
      surface = material > MATERIAL_GRASS + 0.003 && material < MATERIAL_DAHLIA - 0.003
        ? cultivatedPlantColor(position, normal, material)
        : surrealFlowerColor(position, normal, material);
    } else if (material < MATERIAL_CONCRETE_MAX) {
      SunlitOvergrowthSample overgrowth = sampleSunlitOvergrowth(
        position,
        normal,
        surfaceDetail,
        concreteSample.weathering
      );
      float panelJoint = smoothstep(0.46, 0.5, abs(fract(position.y * 0.38 + concreteSample.weathering * 0.08) - 0.5));
      float runoff = smoothstep(0.56, 0.86, concreteSample.weathering) * smoothstep(0.15, 0.85, concreteSample.weathering);
      vec3 dryConcrete = vec3(0.43, 0.435, 0.42);
      vec3 dampConcrete = vec3(0.19, 0.215, 0.22);
      vec3 paleAggregate = vec3(0.57, 0.555, 0.51);
      surface = mix(dryConcrete, dampConcrete, runoff * 0.48 + concreteSample.weathering * 0.16);
      surface *= 0.84 + concreteSample.matrix * 0.22;
      surface = mix(surface, paleAggregate, concreteSample.aggregate * 0.34);
      surface *= 1.0 - concreteSample.pores * 0.48 - panelJoint * 0.14;
      surface = mix(surface, uGroundColor * 0.36, 0.16);
      vec3 shadedMoss = mix(vec3(0.045, 0.105, 0.035), vec3(0.19, 0.31, 0.09), overgrowth.pattern);
      shadedMoss = mix(shadedMoss, uGroundColor * 0.32 + shadedMoss * 0.72, 0.2);
      vec3 vineGreen = mix(vec3(0.055, 0.16, 0.045), vec3(0.31, 0.47, 0.12), overgrowth.pattern);
      surface = mix(surface, shadedMoss, clamp(overgrowth.moss * 0.76, 0.0, 0.82));
      surface = mix(surface, vineGreen, clamp(overgrowth.vines * 0.94, 0.0, 0.96));
      surface += vineGreen * overgrowth.vines * (0.035 + diffuse * 0.045);
    } else if (material < MATERIAL_MARBLE_MAX) {
      float marbleFlow = fbm(vec2(position.x * 0.17 + position.y * 0.055, position.z * 0.14 - position.y * 0.038) + uSeed * 0.3);
      float veins = smoothstep(0.035, 0.0, abs(marbleFlow - 0.52 + sin(position.y * 0.18) * 0.035)) * mix(0.24, 1.0, surfaceDetail);
      float pattern = fbm(position.xz * 0.12 + uSeed * 0.4);
      surface = mix(vec3(0.7, 0.73, 0.72), vec3(0.98, 0.95, 0.88), pattern * 0.42);
      surface = mix(surface, vec3(0.22, 0.27, 0.29), veins * 0.72);
      float reflection = pow(1.0 - max(dot(normal, -direction), 0.0), 3.0);
      vec3 reflectedSky = skyColor(reflect(direction, normal));
      surface = mix(surface, reflectedSky + vec3(0.12), 0.16 + reflection * 0.52);
    } else if (material < MATERIAL_BRASS_MAX) {
      float brushed = 0.5 + 0.5 * sin(position.y * 18.0 + noise21(position.xz * 1.4 + uSeed) * 5.0);
      vec3 deepGold = vec3(0.34, 0.13, 0.018);
      vec3 brightGold = vec3(1.15, 0.66, 0.16);
      surface = mix(deepGold, brightGold, 0.34 + brushed * 0.28);
      float reflection = pow(1.0 - max(dot(normal, -direction), 0.0), 2.2);
      vec3 reflectedSky = skyColor(reflect(direction, normal));
      surface = mix(surface, reflectedSky * vec3(1.15, 0.72, 0.26) + brightGold * 0.16, 0.34 + reflection * 0.5);
    } else if (material < MATERIAL_SAND_MAX) {
      float sediment = fbm(vec2(position.y * 0.22, (position.x + position.z) * 0.045) + uSeed * 0.35);
      float grain = noise21(position.xz * 5.8 + position.y * 0.48 + uSeed);
      float strata = 0.5 + 0.5 * sin(position.y * 0.72 + sediment * 5.4);
      vec3 paleSand = vec3(0.72, 0.57, 0.36);
      vec3 ochre = vec3(0.48, 0.25, 0.09);
      surface = mix(paleSand, ochre, strata * 0.42 + sediment * 0.2);
      surface *= 0.82 + grain * 0.22;
      surface = mix(surface, uAccentColor * 0.56, clamp(uWarmth * 0.15, 0.0, 0.18));
    } else if (material < MATERIAL_ORNATE_MAX) {
      float weave = 0.5 + 0.5 * sin((position.x + position.z) * 2.8 + sin(position.y * 1.35) * 1.8);
      float petal = abs(sin(position.y * 0.72 + sin((position.x - position.z) * 0.76) * 2.1));
      float damask = smoothstep(0.66, 0.9, weave * 0.58 + petal * 0.55) * mix(0.28, 1.0, surfaceDetail);
      float tarnish = fbm(position.xz * 0.18 + position.y * 0.035 + uSeed * 0.4);
      vec3 velvet = mix(vec3(0.085, 0.025, 0.055), uAccentColor * 0.42, 0.36);
      vec3 gilt = mix(vec3(0.58, 0.24, 0.035), vec3(1.08, 0.7, 0.2), tarnish);
      surface = mix(velvet * (0.7 + tarnish * 0.38), gilt, damask * 0.72);
      surface = mix(surface, uSkyColor * 0.24, (1.0 - damask) * uPsychedelicIntensity * 0.12);
    } else if (material < MATERIAL_ABANDONED_MAX) {
      float damp = fbm(vec2(position.y * 0.075, (position.x + position.z) * 0.055) + uSeed * 0.7);
      float flakes = smoothstep(0.62, 0.87, noise21(position.xz * 1.65 + position.y * 0.21 + uSeed));
      float rust = smoothstep(0.54, 0.83, fbm(position.xy * 0.2 - position.z * 0.04 + uSeed * 0.28));
      float markings = smoothstep(0.78, 0.94, sin(position.y * 1.4 + sin(position.x * 0.44 + position.z * 0.31) * 3.0) * 0.5 + 0.5);
      vec3 bare = mix(vec3(0.34, 0.35, 0.33), vec3(0.13, 0.17, 0.16), damp * 0.68);
      vec3 exposed = mix(vec3(0.5, 0.46, 0.38), vec3(0.34, 0.12, 0.035), rust);
      surface = mix(bare, exposed, flakes * 0.48 + rust * 0.24);
      surface = mix(surface, uAccentColor * 0.34, markings * flakes * 0.3);
    } else if (material < MATERIAL_CAVE_MAX) {
      float caveFlow = fbm(position.xz * 0.22 + position.y * vec2(0.055, -0.073) + uSeed * 0.51);
      float fissures = smoothstep(0.075, 0.0, abs(caveFlow - 0.48));
      float mineral = smoothstep(0.72, 0.93, noise21(position.xy * 0.72 + position.z * 0.09 + uSeed));
      float dampStone = fbm(position.yz * 0.15 + position.x * 0.035 - uSeed * 0.23);
      vec3 basalt = mix(vec3(0.045, 0.055, 0.058), vec3(0.14, 0.16, 0.15), caveFlow);
      vec3 limestone = mix(vec3(0.24, 0.22, 0.18), vec3(0.42, 0.38, 0.29), dampStone);
      surface = mix(basalt, limestone, smoothstep(0.42, 0.77, caveFlow) * 0.62);
      surface *= 1.0 - fissures * 0.38;
      surface += mineral * mix(vec3(0.22, 0.35, 0.28), uAccentColor, 0.42) * (0.18 + uPsychedelicIntensity * 0.12);
    } else if (material < MATERIAL_FLOODED_MAX) {
      float rippleTime = uTime * uMotionScale;
      float ripples = sin(position.x * 1.45 + rippleTime * 0.34);
      ripples += sin(position.z * 1.92 - rippleTime * 0.27) * 0.72;
      ripples += sin((position.x + position.z) * 3.1 + rippleTime * 0.18) * 0.24;
      float wetPattern = fbm(position.xz * 0.32 + uSeed * 0.62);
      float floorFacing = pow(abs(normal.y), 4.0);
      float grazing = pow(1.0 - max(dot(normal, -direction), 0.0), 2.4);
      vec3 reflectedSky = skyColor(reflect(direction, normal));
      vec3 floodedStone = mix(vec3(0.025, 0.065, 0.075), vec3(0.08, 0.18, 0.19), wetPattern);
      floodedStone += mix(uAccentColor.brg, vec3(0.18, 0.38, 0.42), 0.55) * (0.5 + 0.5 * ripples) * floorFacing * 0.16;
      surface = mix(floodedStone, reflectedSky * 0.52 + vec3(0.025, 0.06, 0.07), (0.22 + grazing * 0.48) * mix(0.42, 1.0, floorFacing));
    } else if (abs(material - MATERIAL_SEED_BAG) < 0.01) {
      float fiber = noise21(position.xz * 17.0 + position.y * 9.0 + uSeed);
      surface = mix(vec3(0.34, 0.19, 0.07), vec3(0.88, 0.66, 0.25), fiber * 0.42 + max(normal.y, 0.0) * 0.34);
      surface += vec3(0.18, 0.34, 0.12) * (0.35 + 0.65 * sin(uTime * 2.0) * sin(uTime * 2.0));
    } else if (material < MATERIAL_LIMINAL_MAX) {
      float roomCellX = abs(fract(position.x * 0.18) - 0.5);
      float roomCellZ = abs(fract(position.z * 0.18) - 0.5);
      float panelSeam = smoothstep(0.46, 0.495, max(roomCellX, roomCellZ));
      float wallpaper = 0.5 + 0.5 * sin(position.y * 2.35 + sin((position.x + position.z) * 0.42) * 0.62);
      float stains = fbm(position.xz * 0.14 + position.y * 0.027 + uSeed * 0.83);
      float fluorescent = pow(max(sin((position.x + position.z) * 0.31 + 1.2), 0.0), 18.0);
      vec3 nicotine = mix(vec3(0.28, 0.26, 0.12), vec3(0.68, 0.62, 0.3), wallpaper * 0.28 + stains * 0.44);
      surface = nicotine * (0.78 + stains * 0.24);
      surface *= 1.0 - panelSeam * 0.38;
      surface += vec3(0.42, 0.48, 0.28) * fluorescent * (0.18 + abs(normal.y) * 0.32);
    } else {
      float portalTime = mod(uTime * uMotionScale, 628.31854);
      float breath = sin(portalTime * 1.22) * 0.72 + sin(portalTime * 2.44 - 1.1) * 0.2;
      vec3 spinningNormal = normal;
      spinningNormal.xz = rotate2(portalTime * 0.22) * spinningNormal.xz;
      spinningNormal.xy = rotate2(-portalTime * 0.13) * spinningNormal.xy;
      vec2 portalFlow = vec2(sin(portalTime * 0.12), cos(portalTime * 0.12)) * 1.35;
      float crawl = fbm(spinningNormal.xy * 3.8 + vec2(spinningNormal.z * 1.45, 0.0) + portalFlow);
      float membrane = sin(spinningNormal.y * 12.0 - spinningNormal.x * 5.0 + crawl * 5.2);
      membrane += sin((spinningNormal.x - spinningNormal.z) * 15.0 + portalTime * 0.24) * 0.55;
      float veins = smoothstep(0.72, 0.97, 0.5 + 0.5 * sin(membrane * 2.4 + crawl * 8.0));
      float eye = pow(max(dot(normal, -direction), 0.0), 2.6);
      float rim = pow(1.0 - max(dot(normal, -direction), 0.0), 1.7);
      float liquidBand = 0.5 + 0.5 * sin(membrane * 1.7 + crawl * 9.0 + portalTime * 0.62);
      float oilShift = smoothstep(0.18, 0.86, liquidBand + rim * 0.28);
      vec3 voidGreen = vec3(0.004, 0.07, 0.018);
      vec3 neonGreen = vec3(0.06, 1.42, 0.22);
      vec3 hotCore = vec3(0.62, 1.7, 0.14);
      vec3 liquidBlue = vec3(0.04, 0.34, 1.5);
      vec3 oilPink = vec3(1.35, 0.08, 0.74);
      vec3 iridescence = mix(liquidBlue, oilPink, oilShift);
      surface = mix(voidGreen, neonGreen, clamp(0.3 + crawl * 0.76 + membrane * 0.065, 0.0, 1.0));
      surface = mix(surface, hotCore, veins * (0.16 + eye * 0.24));
      surface = mix(surface, iridescence, (0.1 + rim * 0.32) * smoothstep(0.28, 0.9, liquidBand));
      surface += neonGreen * rim * (0.9 + 0.28 * sin(portalTime * 2.3 + crawl * 6.0));
      surface += iridescence * veins * 0.18;
      surface *= 0.9 + breath * 0.28;
    }

    if (courtyardMaterialMatch(material, MATERIAL_COURTYARD_EXIT) > 0.5) return vec3(0.95, 0.79, 0.55) * 1.35;
    if (material > MATERIAL_LIMINAL_MAX) return surface * 2.65;

    if (courtyardMaterialMatch(material, MATERIAL_COURTYARD_STONE) < 0.5
      && courtyardMaterialMatch(material, MATERIAL_COURTYARD_SOIL) < 0.5
      && courtyardMaterialMatch(material, MATERIAL_COURTYARD_FOLIAGE) < 0.5
      && courtyardRock < 0.5)
      surface = personalArt(surface, position, normal, material);
    float ambientDay = smoothstep(0.12, 0.62, daylight);
    float ambient = max(0.09, (0.24 + normal.y * 0.34 - uLightDrama * 0.07) * mix(0.34, 1.0, ambientDay));
    vec3 lightColor = mix(vec3(0.72, 0.78, 0.8), vec3(1.08, 0.68, 0.3), clamp(0.32 + uWarmth * 0.3 + goldenHour() * 0.68, 0.0, 1.0));
    lightColor = mix(lightColor, vec3(1.0, 0.94, 0.92), courtyardPlaster * 0.55);
    vec3 lighting = vec3(ambient) + diffuse * lightColor * (0.52 + daylight * 0.58) * (1.0 + uLightDrama * 0.48);
    float courtyardLight = max(
      courtyardMaterialMatch(material, MATERIAL_COURTYARD_STONE),
      max(courtyardRock, max(courtyardMaterialMatch(material, MATERIAL_COURTYARD_SOIL), courtyardMaterialMatch(material, MATERIAL_COURTYARD_FOLIAGE)))
    );
    if ((material > MATERIAL_TERRAIN_MAX && material < MATERIAL_BARK_MAX
      || material > MATERIAL_SUCCULENT_MAX && material < MATERIAL_GRASS_MAX)) {
      vec2 buildingCell = floor((position.xz + STRUCTURE_CELL_HALF) / STRUCTURE_CELL);
      courtyardLight = position.y < terrainFoundation(structureCenterForCell(buildingCell)) - 1.0 ? 1.0 : courtyardLight;
    }
    float courtyardDay = mix(0.06, 1.0, ambientDay);
    float uplight = 0.72 + 0.28 * max(dot(normal, normalize(vec3(0.4, -0.5, 0.3))), 0.0);
    lighting += courtyardLight * mix(vec3(0.64, 0.32, 0.12), vec3(0.38, 0.33, 0.31), courtyardPlaster) * uplight * courtyardDay;
    lighting = mix(lighting, max(lighting, mix(vec3(0.72, 0.47, 0.25), vec3(0.58, 0.52, 0.50), courtyardPlaster) * courtyardDay), courtyardLight);
    bool polishedInterior = (material > MATERIAL_CONCRETE_MAX && material < MATERIAL_BRASS_MAX) || (material > MATERIAL_CAVE_MAX && material < MATERIAL_FLOODED_MAX);
    bool ornateInterior = material > MATERIAL_SAND_MAX && material < MATERIAL_ORNATE_MAX;
    float lampHousing = 0.0, lampEmitter = 0.0;
    vec3 lampLight = vec3(0.0);
    if (courtyardLight > 0.5) lampLight = courtyardDownlights(position, lampHousing, lampEmitter);
    surface = mix(surface, vec3(0.055, 0.065, 0.07), lampHousing);
    lighting += lampLight;
    surface *= polishedInterior ? vec3(0.72) + lighting * 0.58 : lighting;
    surface += courtyardLight * mix(vec3(0.075, 0.038, 0.012), vec3(0.025, 0.019, 0.018), courtyardPlaster) * courtyardDay;
    surface += vec3(1.0, 0.72, 0.40) * lampEmitter * 3.0;
    if (polishedInterior || ornateInterior) {
      float gloss = material > MATERIAL_MARBLE_MAX && material < MATERIAL_BRASS_MAX ? 110.0 : (ornateInterior ? 58.0 : 72.0);
      float specular = pow(max(dot(reflect(-lightDirection, normal), -direction), 0.0), gloss);
      vec3 specularColor = material > MATERIAL_MARBLE_MAX && material < MATERIAL_BRASS_MAX ? vec3(2.2, 1.35, 0.42) : vec3(1.45, 1.5, 1.48);
      if (ornateInterior) specularColor = vec3(1.7, 0.88, 0.24);
      surface += specular * specularColor;
    }
    if (material > MATERIAL_FLOODED_MAX && material < MATERIAL_LIMINAL_MAX) {
      surface += vec3(0.075, 0.085, 0.045) * (0.75 + 0.25 * sin(position.z * 0.62));
    }
    if (material > MATERIAL_LIMINAL_MAX) surface += vec3(0.16, 0.82, 1.08) * (0.82 + 0.18 * sin(uTime * uMotionScale * 1.8));
    float rim = pow(1.0 - max(dot(normal, -direction), 0.0), 3.0);
    surface += rim * mix(uSkyColor, uAccentColor, clamp(material * 0.2, 0.0, 1.0)) * (0.16 + uPsychedelicIntensity * 0.08) * (1.0 - courtyardPlaster);
    float fog = aerialPerspective(distanceFromCamera);
    fog *= 1.0 - smoothstep(cameraPosition.y + 8.0, cameraPosition.y + 15.0, position.y);
    return mix(surface, aerialHazeColor(direction), fog);
  }

  vec3 shadeCourtyardWater(vec3 origin, vec3 direction, float distanceFromCamera) {
    vec3 surface = origin + direction * distanceFromCamera;
    vec3 reflected = reflect(direction, vec3(0.0, 1.0, 0.0));
    vec3 color = skyColor(reflected);
    float travel = 0.06;
    #if SHADER_QUALITY_LEVEL == 0
    const int courtyardReflectionSteps = 8;
    #elif SHADER_QUALITY_LEVEL == 1
    const int courtyardReflectionSteps = 20;
    #else
    const int courtyardReflectionSteps = 28;
    #endif
    for (int i = 0; i < courtyardReflectionSteps; i++) {
      vec3 hit = surface + vec3(0.0, 0.035, 0.0) + reflected * travel;
      vec3 distances; float material;
      float distance = sampleScene(hit, material, distances);
      if (distance < 0.022 + travel * 0.0007) {
        color = shadeScene(reflected, hit, travel, material);
        break;
      }
      travel += clamp(distance * 0.68, 0.025, 2.5);
      if (travel > 55.0) break;
    }
    float housing, emitter;
    color += courtyardDownlights(surface, housing, emitter) * 0.16;
    return mix(vec3(0.055, 0.075, 0.07), color, 0.96);
  }

  vec2 waterSurfaceGradient(vec2 point, float detail, float micro) {
    if (detail <= 0.002) return vec2(0.0);
    float time = uTime * uMotionScale;
    vec2 a = normalize(vec2(0.92, 0.38));
    vec2 b = normalize(vec2(-0.34, 0.94));
    float wind = 0.65 + uWind * 0.45;
    vec2 gradient = a * cos(dot(point, a) * 0.19 + time * 0.28 * wind) * 0.038;
    gradient += b * cos(dot(point, b) * 0.31 - time * 0.37 * wind) * 0.026;
    gradient *= detail;
    if (detail > 0.002) {
      vec2 c = normalize(vec2(0.68, -0.73));
      float drift = sin(dot(point, b) * 0.23 + time * 0.14) * 0.65;
      gradient += a * cos(dot(point, a) * 1.65 + drift + time * 0.94 * wind) * 0.115 * detail;
      gradient += b * cos(dot(point, b) * 2.7 - time * 1.18 * wind) * 0.082 * detail;
      gradient += c * cos(dot(point, c) * 4.4 + drift - time * 1.47 * wind) * 0.045 * detail;
      if (micro > 0.002) {
        gradient += c * cos(dot(point, c) * 10.2 + time * 2.1 * wind) * 0.028 * micro;
        #if SHADER_QUALITY_LEVEL > 0
        gradient += b * cos(dot(point, b) * 17.3 - time * 2.7 * wind) * 0.017 * micro;
        #endif
      }
    }
    return gradient;
  }

  vec3 shadeWater(vec3 origin, vec3 direction, float distanceFromCamera) {
    vec3 position = origin + direction * distanceFromCamera;
    float waterDetail = 1.0 - smoothstep(10.0, 82.0 * uDetailScale, distanceFromCamera);
    float rippleDetail = 1.0 - smoothstep(8.0, 52.0 * uDetailScale, distanceFromCamera);
    float microDetail = 1.0 - smoothstep(2.5, 17.0 * uDetailScale, distanceFromCamera);
    vec2 gradient = waterSurfaceGradient(position.xz, rippleDetail, microDetail);
    vec3 normal = normalize(vec3(-gradient.x, 1.0, -gradient.y));
    vec3 reflected = reflect(direction, normal);
    float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(-direction, normal), 0.0), 5.0);

    float reflectionDetail = 1.0 - smoothstep(24.0, 70.0 * uDetailScale, distanceFromCamera);
    vec3 hazeColor = aerialHazeColor(direction);
    vec3 reflectionColor = hazeColor;
    if (reflectionDetail > 0.002) {
      reflectionColor = mix(reflectionColor, skyColor(reflected), reflectionDetail);
    }
    #if ENABLE_SCENE_REFLECTIONS == 1
    vec3 reflectedPosition;
    float reflectedMaterial;
    if (waterDetail > 0.12) {
      float reflectedDistance = marchReflection(position + normal * 0.12, reflected, waterDetail, reflectedPosition, reflectedMaterial);
      if (reflectedDistance > 0.0) {
        vec3 sceneReflection = shadeScene(reflected, reflectedPosition, reflectedDistance, reflectedMaterial);
        reflectionColor = mix(reflectionColor, sceneReflection, waterDetail);
      }
    }
    #endif

    vec3 deep = mix(uGroundColor * vec3(0.16, 0.25, 0.28), uAccentColor * 0.28, clamp(uPsychedelicIntensity * 0.22, 0.0, 0.4));
    float rippleLight = clamp(0.5 + (gradient.x + gradient.y) * 1.6, 0.0, 1.0);
    deep *= 0.92 + (rippleLight - 0.5) * 0.16 * rippleDetail;
    vec3 color = mix(deep, reflectionColor, 0.24 + fresnel * 0.72);
    float highlight = pow(max(dot(reflected, sunDirection()), 0.0), mix(46.0, 110.0, rippleDetail));
    float glint = pow(max(dot(reflected, sunDirection()), 0.0), 280.0) * (0.45 + rippleLight * 0.55);
    color += (highlight * 1.55 + glint * 3.2 * microDetail) * vec3(1.0, 0.79, 0.5);
    float fog = aerialPerspective(distanceFromCamera);
    return mix(color, hazeColor, fog);
  }
`
