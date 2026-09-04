export const lightingGlsl = `
  vec3 shadeScene(vec3 direction, vec3 position, float distanceFromCamera, float material) {
    vec3 normal = sceneNormal(position, distanceFromCamera, material);
    vec3 lightDirection = sunDirection();
    float daylight = daylightAmount();
    float season = seasonalCycle();
    float surfaceDetail = proximityDetail(position.xz, 7.0, 64.0);
    float microDetail = proximityDetail(position.xz, 3.0, 18.0);
    BarkContourSample barkSample;
    ConcreteAggregateSample concreteSample;
    if (material > MATERIAL_TERRAIN_MAX && material < MATERIAL_BARK_MAX) {
      normal = barkContourNormal(position, normal, surfaceDetail, microDetail, barkSample);
    }
    if (material >= MATERIAL_CONCRETE && material < MATERIAL_CONCRETE_MAX) {
      normal = concreteAggregateNormal(position, normal, surfaceDetail, microDetail, concreteSample);
    }
    if (material > MATERIAL_BARK_MAX && material < MATERIAL_FOLIAGE_DETAIL_MAX && surfaceDetail > 0.002) {
      float leafRipple = sin(position.x * 17.0 + position.y * 11.0 + uSeed) * sin(position.z * 19.0 - position.y * 7.0);
      vec3 leafGrain = vec3(
        sin(position.y * 23.0 + position.z * 8.0),
        leafRipple,
        cos(position.y * 21.0 - position.x * 9.0)
      );
      normal = normalize(normal + leafGrain * leafRipple * surfaceDetail * 0.075);
    }
    float diffuse = pow(max(dot(normal, lightDirection), 0.0), 1.0 + uLightDrama * 1.35);
    vec3 surface;

    if (material < MATERIAL_TERRAIN_MAX) {
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
      vec3 paleSand = mix(vec3(0.63, 0.53, 0.37), uAccentColor * 0.68, 0.2);
      vec3 duneSand = mix(paleSand * 0.7, paleSand * 1.18, windLines * 0.58 + sandGrain * 0.18);
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
      float pigmentBand = 0.5 + 0.5 * sin(position.y * 1.7 + pattern * 6.0);
      surface = mix(surface, mix(uAccentColor, uSkyColor, pigmentBand), clamp(uPsychedelicIntensity * 0.34, 0.0, 0.62));
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
      if (surfaceDetail > 0.002) {
        vec2 leafCell = floor(position.xz * 5.8 + position.y * vec2(1.9, -1.4));
        float leafIdentity = hash21(leafCell + uSeed * 0.37);
        float midrib = pow(abs(sin(position.y * 12.0 + position.x * 4.8 + position.z * 2.6)), 22.0);
        float sideVeins = pow(abs(sin(position.y * 27.0 - position.x * 8.0 + position.z * 6.0)), 34.0);
        float leafFlecks = smoothstep(0.74, 0.94, noise21(position.xz * 12.0 + position.y + uSeed));
        vec3 detailedLeaf = foliage * mix(0.82, 1.16, leafIdentity);
        detailedLeaf = mix(detailedLeaf, detailedLeaf * 0.7 + uSkyColor * 0.12, clamp(midrib * 0.72 + sideVeins * 0.34, 0.0, 0.82));
        detailedLeaf += uAccentColor * leafFlecks * 0.08;
        foliage = mix(foliage, detailedLeaf, surfaceDetail * 0.8);
      }
      vec3 spectralLeaf = mix(uAccentColor.gbr, uSkyColor.brg, leafPattern);
      surface = mix(foliage, spectralLeaf, clamp(uPsychedelicIntensity * 0.32, 0.0, 0.64));
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
      surface = meadowGrassBladeColor(position, season);
      surface = mix(surface, uAccentColor * 0.48 + surface * 0.62, clamp(uPsychedelicIntensity * 0.12, 0.0, 0.24));
    } else if (material < MATERIAL_CONCRETE_MAX) {
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
      float portalPulse = 0.86 + 0.14 * sin(uTime * uMotionScale * 1.8 + position.y * 2.4);
      float portalGrain = 0.5 + 0.5 * sin(position.x * 8.4 + position.y * 11.2 + position.z * 5.7);
      surface = mix(vec3(0.08, 0.48, 0.62), vec3(0.62, 0.92, 0.76), portalGrain * 0.28 + 0.46) * portalPulse;
    }

    float ambientDay = smoothstep(0.12, 0.62, daylight);
    float ambient = max(0.09, (0.24 + normal.y * 0.34 - uLightDrama * 0.07) * mix(0.34, 1.0, ambientDay));
    vec3 lightColor = mix(vec3(0.72, 0.78, 0.8), vec3(1.08, 0.68, 0.3), clamp(0.32 + uWarmth * 0.3 + goldenHour() * 0.68, 0.0, 1.0));
    vec3 lighting = vec3(ambient) + diffuse * lightColor * (0.52 + daylight * 0.58) * (1.0 + uLightDrama * 0.48);
    bool polishedInterior = (material > MATERIAL_CONCRETE_MAX && material < MATERIAL_BRASS_MAX) || (material > MATERIAL_CAVE_MAX && material < MATERIAL_FLOODED_MAX);
    bool ornateInterior = material > MATERIAL_SAND_MAX && material < MATERIAL_ORNATE_MAX;
    surface *= polishedInterior ? vec3(0.72) + lighting * 0.58 : lighting;
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
    surface += rim * mix(uSkyColor, uAccentColor, clamp(material * 0.2, 0.0, 1.0)) * (0.16 + uPsychedelicIntensity * 0.08);
    float fog = aerialPerspective(distanceFromCamera);
    fog *= 1.0 - smoothstep(cameraPosition.y + 8.0, cameraPosition.y + 15.0, position.y);
    return mix(surface, aerialHazeColor(direction), fog);
  }

  vec3 shadeWater(vec3 origin, vec3 direction, float distanceFromCamera) {
    vec3 position = origin + direction * distanceFromCamera;
    float waterDetail = proximityDetail(position.xz, 10.0, 82.0);
    float rippleTime = uTime * uMotionScale;
    vec2 directionA = normalize(vec2(0.92, 0.38));
    vec2 directionB = normalize(vec2(-0.34, 0.94));
    vec2 directionC = normalize(vec2(0.68, -0.73));
    float phaseA = dot(position.xz, directionA) * 0.72 + rippleTime * (0.24 + uWind * 0.22);
    float phaseB = dot(position.xz, directionB) * 1.18 - rippleTime * (0.31 + uWind * 0.18);
    float phaseC = dot(position.xz, directionC) * 2.85 + rippleTime * (0.42 + uWind * 0.2);
    vec2 gradient = directionA * cos(phaseA) * 0.086;
    gradient += directionB * cos(phaseB) * 0.061;
    gradient += directionC * cos(phaseC) * 0.026 * waterDetail;
    if (waterDetail > 0.002) {
      float wandering = noise21(position.xz * 0.16 + vec2(rippleTime * 0.018, -rippleTime * 0.014)) - 0.5;
      float capillary = sin(position.x * 8.2 - position.z * 6.7 + rippleTime * 0.7) * 0.008;
      gradient += (vec2(wandering, -wandering) * 0.035 + vec2(capillary, -capillary * 0.7)) * waterDetail;
    }
    vec3 normal = normalize(vec3(-gradient.x, 1.0, -gradient.y));
    vec3 reflected = reflect(direction, normal);
    float fresnel = pow(1.0 - max(dot(-direction, normal), 0.0), 3.0);

    vec3 reflectionColor = skyColor(reflected);
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
    float rippleLight = 0.5 + 0.5 * sin(phaseA + phaseB * 0.72 + phaseC * 0.18);
    deep *= 0.86 + rippleLight * 0.12;
    vec3 color = mix(deep, reflectionColor, 0.43 + fresnel * 0.5);
    float highlight = pow(max(dot(reflected, sunDirection()), 0.0), 86.0);
    float glint = pow(max(dot(reflected, sunDirection()), 0.0), 280.0) * (0.45 + rippleLight * 0.55);
    color += (highlight * 1.55 + glint * 3.2) * vec3(1.0, 0.79, 0.5);
    float fog = aerialPerspective(distanceFromCamera);
    return mix(color, aerialHazeColor(direction), fog);
  }
`
