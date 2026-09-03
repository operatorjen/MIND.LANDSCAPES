export const lightingGlsl = `
  vec3 shadeScene(vec3 direction, vec3 position, float distanceFromCamera, float material) {
    vec3 normal = sceneNormal(position, distanceFromCamera, material);
    vec3 lightDirection = sunDirection();
    float daylight = daylightAmount();
    float season = seasonalCycle();
    float surfaceDetail = proximityDetail(position.xz, 7.0, 64.0);
    float microDetail = proximityDetail(position.xz, 3.0, 18.0);
    float diffuse = pow(max(dot(normal, lightDirection), 0.0), 1.0 + uLightDrama * 1.35);
    float pattern = fbm(position.xz * 0.12 + uSeed * 0.4);
    vec3 surface;

    if (material < 0.5) {
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
      float grassWave = sin(position.x * 7.0 + sin(position.z * 2.3) + uTime * uWind * (0.7 + uMechanicalIntensity * 0.5) * uMotionScale);
      float grassTexture = smoothstep(0.42, 0.98, grassWave * 0.5 + 0.5) * noise21(position.xz * 3.2 + uSeed);
      if (surfaceDetail > 0.002) {
        float bladeLines = pow(0.5 + 0.5 * sin(position.x * 31.0 + position.z * 17.0 + grassWave * 2.4), 7.0);
        float seedHeads = smoothstep(0.84, 0.98, noise21(position.xz * 18.0 + uSeed * 1.7));
        grassTexture = mix(grassTexture, max(grassTexture, bladeLines * 0.72 + seedHeads * 0.28), surfaceDetail);
      }
      float grassCover = clamp(0.08 + uGrasses * 0.7, 0.0, 0.86) * meadowBiome;
      grassCover *= (1.0 - smoothstep(0.05, 0.48, slope)) * (1.0 - river) * (1.0 - duneBiome) * (1.0 - rockBiome);
      float autumn = smoothstep(0.58, 0.76, season) * (1.0 - smoothstep(0.9, 1.0, season));
      float winter = 1.0 - smoothstep(0.04, 0.22, season) + smoothstep(0.9, 1.0, season);
      vec3 grassGreen = vec3(0.12, 0.27, 0.11) + uAccentColor * 0.18;
      vec3 grassColor = mix(grassGreen, mix(uAccentColor, vec3(0.52, 0.31, 0.09), 0.45), autumn);
      grassColor = mix(grassColor, uGroundColor * 0.56, clamp(winter, 0.0, 1.0));
      grassColor = mix(uGroundColor * 0.48, grassColor, 0.62);
      surface = mix(surface, grassColor * (0.78 + grassTexture * 0.35), grassCover);
      float pigmentBand = 0.5 + 0.5 * sin(position.y * 1.7 + pattern * 6.0);
      surface = mix(surface, mix(uAccentColor, uSkyColor, pigmentBand), clamp(uPsychedelicIntensity * 0.34, 0.0, 0.62));
    } else if (material < 1.5) {
      float spacing = TREE_CELL;
      vec2 treeCell = floor((position.xz + spacing * 0.5) / spacing);
      vec2 barkLocal = position.xz - treeCenterForCell(treeCell);
      float barkSeed = hash21(treeCell + uSeed * 0.07);
      float treeSpecies = hash21(treeCell + 42.6);
      float barkAngle = atan(barkLocal.y, barkLocal.x);
      float barkFlow = 0.0;
      float bark = 0.5;
      float fissures = 0.0;
      float lichen = 0.0;
      if (surfaceDetail > 0.002) {
        barkFlow = fbm(vec2(barkAngle * 2.6 + position.y * 0.045, position.y * 0.13) + barkSeed * 11.0);
        bark = mix(0.5, fbm(vec2(barkAngle * 3.4 + barkFlow, position.y * 0.32) + barkSeed * 17.0), surfaceDetail);
        float grooves = noise21(vec2(barkAngle * 9.0 + barkFlow * 1.8, position.y * 0.22) + barkSeed * 23.0);
        fissures = smoothstep(0.76, 0.94, grooves) * surfaceDetail;
        lichen = smoothstep(0.68, 0.9, noise21(vec2(barkAngle * 2.1, position.y * 0.38) + barkSeed * 31.0)) * surfaceDetail;
      }
      float knots = microDetail > 0.002
        ? smoothstep(0.9, 0.985, noise21(vec2(position.y * 1.7, barkAngle * 5.0) + barkSeed * 43.0)) * microDetail
        : 0.0;
      vec3 youngBark = mix(uGroundColor * 0.3, vec3(0.16, 0.11, 0.075), 0.42);
      vec3 oldBark = mix(uGroundColor * 0.16, vec3(0.28, 0.24, 0.19), smoothstep(0.45, 0.9, treeSpecies));
      surface = mix(oldBark, mix(youngBark, uAccentColor * 0.27, bark), 0.55);
      surface *= 1.0 - fissures * 0.38;
      surface *= 1.0 - knots * 0.32;
      surface = mix(surface, uSkyColor * 0.28 + vec3(0.1, 0.14, 0.07), lichen * 0.32);
    } else if (material < 3.5) {
      float spacing = TREE_CELL;
      vec2 treeCell = floor((position.xz + spacing * 0.5) / spacing);
      float treeSpecies = hash21(treeCell + 42.6);
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
        float veins = smoothstep(0.7, 0.91, fbm(position.xz * 3.4 + position.y * vec2(0.72, -0.54) + uSeed * 0.6));
        float leafFlecks = smoothstep(0.72, 0.94, noise21(position.xz * 12.0 + position.y + uSeed));
        foliage = mix(foliage, foliage * (0.86 + veins * 0.24) + uAccentColor * leafFlecks * 0.09, surfaceDetail * 0.72);
      }
      vec3 spectralLeaf = mix(uAccentColor.gbr, uSkyColor.brg, leafPattern);
      surface = mix(foliage, spectralLeaf, clamp(uPsychedelicIntensity * 0.32, 0.0, 0.64));
      surface += pow(leafPattern, 8.0) * uRitualIntensity * uAccentColor * 0.18;
    } else if (material < 3.9) {
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
    } else if (material < 4.5) {
      vec3 axisWeight = pow(abs(normal), vec3(4.0));
      axisWeight /= max(axisWeight.x + axisWeight.y + axisWeight.z, 0.001);
      float aggregate = 0.5;
      if (surfaceDetail > 0.002) {
        aggregate = noise21(position.yz * 2.8 + uSeed) * axisWeight.x;
        aggregate += noise21(position.xz * 2.8 + uSeed * 1.3) * axisWeight.y;
        aggregate += noise21(position.xy * 2.8 - uSeed * 0.7) * axisWeight.z;
        aggregate = mix(0.5, aggregate, surfaceDetail);
      }
      float largeAggregate = 0.5;
      float pores = surfaceDetail > 0.002 ? smoothstep(0.72, 0.93, noise21(position.xz * 7.4 + position.y * 0.31 + uSeed)) * surfaceDetail : 0.0;
      float microPits = microDetail > 0.002
        ? smoothstep(0.88, 0.985, noise21(position.xy * 22.0 + position.z * 0.73 + uSeed * 2.1)) * microDetail
        : 0.0;
      float weathering = 0.5;
      if (surfaceDetail > 0.002) {
        largeAggregate = mix(0.5, fbm(position.xz * 0.82 + position.y * 0.09 + uSeed * 0.14), surfaceDetail);
        weathering = mix(0.5, fbm(vec2(position.y * 0.1, (position.x + position.z) * 0.065) + uSeed * 0.2), surfaceDetail);
      }
      float panelJoint = smoothstep(0.46, 0.5, abs(fract(position.y * 0.38 + weathering * 0.08) - 0.5));
      float runoff = smoothstep(0.56, 0.86, noise21(position.xz * 0.23 + uSeed * 0.41)) * smoothstep(0.15, 0.85, weathering);
      vec3 dryConcrete = vec3(0.43, 0.435, 0.42);
      vec3 dampConcrete = vec3(0.19, 0.215, 0.22);
      surface = mix(dryConcrete, dampConcrete, runoff * 0.5 + weathering * 0.18);
      surface *= 0.74 + aggregate * 0.3 + largeAggregate * 0.16;
      surface *= 1.0 - pores * 0.4 - microPits * 0.28 - panelJoint * 0.14;
      surface = mix(surface, uGroundColor * 0.36, 0.16);
    } else if (material < 5.5) {
      float marbleFlow = fbm(vec2(position.x * 0.17 + position.y * 0.055, position.z * 0.14 - position.y * 0.038) + uSeed * 0.3);
      float veins = smoothstep(0.035, 0.0, abs(marbleFlow - 0.52 + sin(position.y * 0.18) * 0.035)) * mix(0.24, 1.0, surfaceDetail);
      surface = mix(vec3(0.7, 0.73, 0.72), vec3(0.98, 0.95, 0.88), pattern * 0.42);
      surface = mix(surface, vec3(0.22, 0.27, 0.29), veins * 0.72);
      float reflection = pow(1.0 - max(dot(normal, -direction), 0.0), 3.0);
      vec3 reflectedSky = skyColor(reflect(direction, normal));
      surface = mix(surface, reflectedSky + vec3(0.12), 0.16 + reflection * 0.52);
    } else if (material < 6.5) {
      float brushed = 0.5 + 0.5 * sin(position.y * 18.0 + noise21(position.xz * 1.4 + uSeed) * 5.0);
      vec3 deepGold = vec3(0.34, 0.13, 0.018);
      vec3 brightGold = vec3(1.15, 0.66, 0.16);
      surface = mix(deepGold, brightGold, 0.34 + brushed * 0.28);
      float reflection = pow(1.0 - max(dot(normal, -direction), 0.0), 2.2);
      vec3 reflectedSky = skyColor(reflect(direction, normal));
      surface = mix(surface, reflectedSky * vec3(1.15, 0.72, 0.26) + brightGold * 0.16, 0.34 + reflection * 0.5);
    } else if (material < 7.5) {
      float sediment = fbm(vec2(position.y * 0.22, (position.x + position.z) * 0.045) + uSeed * 0.35);
      float grain = noise21(position.xz * 5.8 + position.y * 0.48 + uSeed);
      float strata = 0.5 + 0.5 * sin(position.y * 0.72 + sediment * 5.4);
      vec3 paleSand = vec3(0.72, 0.57, 0.36);
      vec3 ochre = vec3(0.48, 0.25, 0.09);
      surface = mix(paleSand, ochre, strata * 0.42 + sediment * 0.2);
      surface *= 0.82 + grain * 0.22;
      surface = mix(surface, uAccentColor * 0.56, clamp(uWarmth * 0.15, 0.0, 0.18));
    } else if (material < 8.5) {
      float weave = 0.5 + 0.5 * sin((position.x + position.z) * 2.8 + sin(position.y * 1.35) * 1.8);
      float petal = abs(sin(position.y * 0.72 + sin((position.x - position.z) * 0.76) * 2.1));
      float damask = smoothstep(0.66, 0.9, weave * 0.58 + petal * 0.55) * mix(0.28, 1.0, surfaceDetail);
      float tarnish = fbm(position.xz * 0.18 + position.y * 0.035 + uSeed * 0.4);
      vec3 velvet = mix(vec3(0.085, 0.025, 0.055), uAccentColor * 0.42, 0.36);
      vec3 gilt = mix(vec3(0.58, 0.24, 0.035), vec3(1.08, 0.7, 0.2), tarnish);
      surface = mix(velvet * (0.7 + tarnish * 0.38), gilt, damask * 0.72);
      surface = mix(surface, uSkyColor * 0.24, (1.0 - damask) * uPsychedelicIntensity * 0.12);
    } else if (material < 9.5) {
      float damp = fbm(vec2(position.y * 0.075, (position.x + position.z) * 0.055) + uSeed * 0.7);
      float flakes = smoothstep(0.62, 0.87, noise21(position.xz * 1.65 + position.y * 0.21 + uSeed));
      float rust = smoothstep(0.54, 0.83, fbm(position.xy * 0.2 - position.z * 0.04 + uSeed * 0.28));
      float markings = smoothstep(0.78, 0.94, sin(position.y * 1.4 + sin(position.x * 0.44 + position.z * 0.31) * 3.0) * 0.5 + 0.5);
      vec3 bare = mix(vec3(0.34, 0.35, 0.33), vec3(0.13, 0.17, 0.16), damp * 0.68);
      vec3 exposed = mix(vec3(0.5, 0.46, 0.38), vec3(0.34, 0.12, 0.035), rust);
      surface = mix(bare, exposed, flakes * 0.48 + rust * 0.24);
      surface = mix(surface, uAccentColor * 0.34, markings * flakes * 0.3);
    } else if (material < 10.5) {
      float caveFlow = fbm(position.xz * 0.22 + position.y * vec2(0.055, -0.073) + uSeed * 0.51);
      float fissures = smoothstep(0.075, 0.0, abs(caveFlow - 0.48));
      float mineral = smoothstep(0.72, 0.93, noise21(position.xy * 0.72 + position.z * 0.09 + uSeed));
      float dampStone = fbm(position.yz * 0.15 + position.x * 0.035 - uSeed * 0.23);
      vec3 basalt = mix(vec3(0.045, 0.055, 0.058), vec3(0.14, 0.16, 0.15), caveFlow);
      vec3 limestone = mix(vec3(0.24, 0.22, 0.18), vec3(0.42, 0.38, 0.29), dampStone);
      surface = mix(basalt, limestone, smoothstep(0.42, 0.77, caveFlow) * 0.62);
      surface *= 1.0 - fissures * 0.38;
      surface += mineral * mix(vec3(0.22, 0.35, 0.28), uAccentColor, 0.42) * (0.18 + uPsychedelicIntensity * 0.12);
    } else if (material < 11.5) {
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
    } else {
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
    }

    float ambientDay = smoothstep(0.12, 0.62, daylight);
    float ambient = max(0.09, (0.24 + normal.y * 0.34 - uLightDrama * 0.07) * mix(0.34, 1.0, ambientDay));
    vec3 lightColor = mix(vec3(0.72, 0.78, 0.8), vec3(1.08, 0.68, 0.3), clamp(0.32 + uWarmth * 0.3 + goldenHour() * 0.68, 0.0, 1.0));
    vec3 lighting = vec3(ambient) + diffuse * lightColor * (0.52 + daylight * 0.58) * (1.0 + uLightDrama * 0.48);
    bool polishedInterior = (material > 4.5 && material < 6.5) || (material > 10.5 && material < 11.5);
    bool ornateInterior = material > 7.5 && material < 8.5;
    surface *= polishedInterior ? vec3(0.72) + lighting * 0.58 : lighting;
    if (polishedInterior || ornateInterior) {
      float gloss = material > 5.5 && material < 6.5 ? 110.0 : (ornateInterior ? 58.0 : 72.0);
      float specular = pow(max(dot(reflect(-lightDirection, normal), -direction), 0.0), gloss);
      vec3 specularColor = material > 5.5 && material < 6.5 ? vec3(2.2, 1.35, 0.42) : vec3(1.45, 1.5, 1.48);
      if (ornateInterior) specularColor = vec3(1.7, 0.88, 0.24);
      surface += specular * specularColor;
    }
    if (material > 11.5) {
      surface += vec3(0.075, 0.085, 0.045) * (0.75 + 0.25 * sin(position.z * 0.62));
    }
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

    vec3 reflectedPosition;
    float reflectedMaterial;
    vec3 reflectionColor = skyColor(reflected);
    if (waterDetail > 0.12) {
      float reflectedDistance = marchReflection(position + normal * 0.12, reflected, waterDetail, reflectedPosition, reflectedMaterial);
      if (reflectedDistance > 0.0) {
        vec3 sceneReflection = shadeScene(reflected, reflectedPosition, reflectedDistance, reflectedMaterial);
        reflectionColor = mix(reflectionColor, sceneReflection, waterDetail);
      }
    }

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
