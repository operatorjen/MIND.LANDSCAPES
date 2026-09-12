export const architectureGlsl = `
  float architectureBoulderDistance(
    vec3 local,
    vec2 cell,
    float width,
    float depth,
    float height,
    float variant
  ) {
    float mainMass = ellipsoidDistance(
      local - vec3(0.0, height * 0.42, 0.0),
      vec3(width * 0.68, height * 0.68, depth * 0.61)
    );
    float shoulderSide = variant > 0.5 ? 1.0 : -1.0;
    float shoulder = ellipsoidDistance(
      local - vec3(shoulderSide * width * 0.27, height * 0.28, -depth * 0.08),
      vec3(width * 0.43, height * 0.43, depth * 0.5)
    );
    float boulder = smoothMinimum(mainMass, shoulder, 2.2);
    vec2 strataPoint = local.xz * 0.072 + cell * 0.31
      + vec2(local.y * 0.024, -local.y * 0.019) + uSeed * 0.07;
    float weathered = fbm(strataPoint) - 0.5;
    float strata = sin(local.y * 0.31 + weathered * 4.8 + variant * 3.1);
    return boulder + weathered * 1.05 + strata * 0.13;
  }

  float morphArchitectureDistance(float boulderDistance, float structureDistance, float detail) {
    float amount = smoothstep(0.06, 0.94, detail);
    float supported = smoothMinimum(boulderDistance, structureDistance, 1.1);
    if (amount < 0.5) {
      return mix(boulderDistance, supported, smoothstep(0.0, 0.5, amount));
    }
    return mix(supported, structureDistance, smoothstep(0.5, 1.0, amount));
  }

  float brutalistSlabDistance(
    vec3 point,
    vec3 center,
    vec3 halfBounds,
    float turn,
    vec2 lean
  ) {
    vec3 shaped = point - center;
    shaped.xz -= lean * shaped.y;
    shaped.xz = vec2(shaped.x - shaped.z * turn, shaped.z + shaped.x * turn);
    return boxDistance(shaped, halfBounds) * 0.82;
  }

  vec3 courtyardLampPosition(vec2 halfSize, float index) {
    float side = index < 2.0 ? -1.0 : 1.0;
    return vec3(side * (halfSize.x - 0.02), 2.55, (mod(index, 2.0) * 2.0 - 1.0) * halfSize.y * 0.53);
  }

  bool courtyardCoordinates(vec3 position, out vec3 point, out vec2 halfSize) {
    vec2 cell = floor((position.xz + STRUCTURE_CELL_HALF) / STRUCTURE_CELL);
    if (cultivationCell(cell)) return false;
    vec2 center = structureCenterForCell(cell);
    float ground = terrainFoundation(center);
    if (position.y > ground - 0.9) return false;
    float variant = hash21(cell + 17.8);
    float width = mix(15.0, 23.0, hash21(cell + 4.9)) * mix(0.9, 1.18, clamp(uMechanicalIntensity * 0.55 + uStructures * 0.2, 0.0, 1.0));
    float depth = mix(28.0, 44.0, hash21(cell + 11.3)) * mix(0.9, 1.2, clamp(uRitualIntensity * 0.4 + uStructures * 0.24, 0.0, 1.0));
    vec2 local = rotate2((floor(variant * 4.0) + 0.5) * 1.5707963) * (position.xz - center);
    vec4 node; vec2 nodeLocal;
    mazePlanDistance(local, cell, width, depth, variant, node, nodeLocal);
    if (node.a < 0.5 || node.a > 254.5) return false;
    float shape = floor((node.a - 1.0) / 48.0);
    vec2 count = vec2(shape > 1.5 ? 4.0 : 3.0, shape > 0.5 ? 3.0 : 2.0);
    float role = floor(mod(node.a - 1.0, 48.0) / 3.0);
    vec2 spacing = vec2(width * 0.17, (depth * 0.64 - 1.2) / 4.0);
    vec2 offset = vec2(mod(role, count.x) - (count.x - 1.0) * 0.5, -(floor(role / count.x) - (count.y - 1.0) * 0.5)) * spacing;
    point = vec3(nodeLocal.x + offset.x, position.y - ground + 5.1, nodeLocal.y + offset.y);
    halfSize = spacing * (count * 0.5 - vec2(0.04, 0.06));
    return true;
  }

  float courtyardStreamCenter(float along, vec2 halfSize, vec2 identity) {
    float phase = hash21(identity + 201.7) * 6.2831853;
    float broadBend = sin(along * 0.17 + phase) * min(halfSize.x * 0.23, 2.35);
    float smallBend = sin(along * 0.43 - phase * 0.61) * 0.52;
    return broadBend + smallBend;
  }

  float courtyardEdgeJitter(vec2 point, vec2 identity) {
    float phase = hash21(identity + 207.3) * 6.2831853;
    float broad = sin(point.x * 0.83 + phase) * sin(point.y * 1.17 - phase * 0.71);
    float broken = sin(dot(point, vec2(2.41, -1.93)) + phase * 1.37);
    float fine = sin(point.x * 5.17 - sin(point.y * 1.61 + phase) * 1.4 + phase * 2.11);
    return broad * 0.5 + broken * 0.32 + fine * 0.18;
  }

  float courtyardWaterShape(vec2 point, vec2 halfSize, vec2 identity) {
    float center = courtyardStreamCenter(point.y, halfSize, identity);
    float width = mix(1.18, 1.72, hash21(identity + 213.4));
    width *= 0.9 + 0.12 * sin(point.y * 0.31 + hash21(identity + 219.8) * 6.2831853);
    float bankSide = step(center, point.x);
    float bankJitter = courtyardEdgeJitter(vec2(point.y, point.x * 0.37), identity + bankSide * 31.4);
    float endCap = max(abs(point.y) - halfSize.y + 1.05, 0.0);
    float stream = length(vec2(point.x - center, endCap)) - width;
    stream += bankJitter * 0.52;
    float pondAlong = mix(-halfSize.y * 0.34, halfSize.y * 0.3, hash21(identity + 225.1));
    vec2 pondCenter = vec2(courtyardStreamCenter(pondAlong, halfSize, identity), pondAlong);
    vec2 pondScale = vec2(width * 1.65, mix(2.4, 3.65, hash21(identity + 229.6)));
    float pond = (length((point - pondCenter) / pondScale) - 1.0) * min(pondScale.x, pondScale.y);
    pond += courtyardEdgeJitter((point - pondCenter) * vec2(0.82, 1.14), identity + 17.9) * 0.46;
    float sideRoom = abs(point.x) - halfSize.x + 0.58
      + courtyardEdgeJitter(vec2(point.y, point.x * 0.2), identity + 58.2) * 0.2;
    return max(min(stream, pond), sideRoom);
  }

  float courtyardRockDistance(vec3 point, vec2 halfSize, vec2 identity) {
    float rocks = 1000.0;
    for (int rockIndex = 0; rockIndex < 6; rockIndex++) {
      float index = float(rockIndex);
      float seed = hash21(identity + index * 31.7 + 241.3);
      float along = mix(-halfSize.y * 0.72, halfSize.y * 0.72, fract(seed * 4.37 + index * 0.173));
      float side = mod(index, 2.0) < 0.5 ? -1.0 : 1.0;
      float stream = courtyardStreamCenter(along, halfSize, identity);
      float bank = mix(2.15, 4.35, fract(seed * 7.91 + 0.23));
      vec2 center = vec2(stream + side * bank, along);
      center = clamp(center, -halfSize + vec2(1.05), halfSize - vec2(1.05));
      float height = mix(0.32, 0.82, fract(seed * 13.13 + 0.41));
      vec3 scale = vec3(
        mix(0.72, 1.48, fract(seed * 17.17 + 0.11)),
        height,
        mix(0.62, 1.32, fract(seed * 19.31 + 0.67))
      );
      vec3 rockPoint = point - vec3(center.x, height * 0.44 - 0.02, center.y);
      rockPoint.xz = rotate2((seed - 0.5) * 2.2) * rockPoint.xz;
      float irregularity = sin(rockPoint.x * 2.7 + seed * 8.1) * sin(rockPoint.z * 2.15 - seed * 5.7);
      irregularity += sin((rockPoint.x + rockPoint.z) * 4.2 + seed * 11.3) * 0.38;
      float rock = ellipsoidDistance(rockPoint, scale) + irregularity * min(scale.x, min(scale.y, scale.z)) * 0.075;
      rocks = min(rocks, rock);
    }
    return rocks;
  }

  float indoorCourtyardDistance(
    vec3 point, vec2 halfSize, vec2 tileSpacing, vec2 tileCount, float style, vec2 identity,
    out float stone, out float rock, out float soil, out float foliage,
    out float thresholdGlow, out float flowerMaterial, float growth, bool includeFlowers
  ) {
    // A narrow, subtly lit threshold stands just inside the back corner.
    vec2 exitRoot = vec2(halfSize.x - 1.5, -halfSize.y + 0.9);
    vec3 gate = point - vec3(exitRoot.x, 0.18, exitRoot.y);
    stone = min(boxDistance(gate - vec3(-0.68, 1.3, 0.0), vec3(0.075, 1.3, 0.11)),
      boxDistance(gate - vec3(0.68, 1.3, 0.0), vec3(0.075, 1.3, 0.11)));
    stone = min(stone, boxDistance(gate - vec3(0.0, 2.57, 0.0), vec3(0.75, 0.075, 0.11)));
    thresholdGlow = min(boxDistance(gate - vec3(-0.59, 1.3, 0.0), vec3(0.012, 1.21, 0.025)),
      boxDistance(gate - vec3(0.59, 1.3, 0.0), vec3(0.012, 1.21, 0.025)));
    for (int i = 0; i < 4; i++) {
      vec3 lamp = point - courtyardLampPosition(halfSize, float(i));
      stone = min(stone, boxDistance(lamp, vec3(0.22, 0.14, 0.26)));
    }
    rock = courtyardRockDistance(point, halfSize, identity);
    vec2 soilHalfSize = halfSize - 0.32;
    vec2 soilEdgeOffset = vec2(
      courtyardEdgeJitter(vec2(point.z, point.x * 0.19), identity + 43.6),
      courtyardEdgeJitter(vec2(point.x, point.z * 0.19), identity + 71.8)
    ) * 0.62;
    float soilPlanarEdge = max(abs(point.x) - soilHalfSize.x, abs(point.z) - soilHalfSize.y);
    float irregularSoilEdge = max(abs(point.x) - soilHalfSize.x + soilEdgeOffset.x,
      abs(point.z) - soilHalfSize.y + soilEdgeOffset.y);
    float soilEdgeWeight = 1.0 - smoothstep(0.0, 1.15, abs(soilPlanarEdge));
    soil = boxDistance(point - vec3(0.0, -0.075, 0.0), vec3(soilHalfSize.x, 0.075, soilHalfSize.y));
    soil += (irregularSoilEdge - soilPlanarEdge) * soilEdgeWeight;
    foliage = 1000.0;
    flowerMaterial = MATERIAL_GRASS;
    if (!includeFlowers) return min(stone, min(rock, min(soil, thresholdGlow)));
    float phase = hash21(identity + 19.3) * 6.2831853;
    float dominantSpecies = floor(hash21(identity + 63.1) * 4.0);
    float companionSpecies = mod(dominantSpecies + 1.0 + floor(hash21(identity + 67.9) * 3.0), 4.0);
    float dominance = mix(0.64, 0.84, hash21(identity + 72.4));
    for (int clusterIndex = 0; clusterIndex < 3; clusterIndex++) {
      float group = float(clusterIndex);
      float angle = phase + group * 2.0943951 + hash21(identity + group * 11.7) * 0.6;
      vec2 cluster = vec2(cos(angle), sin(angle)) * halfSize * (0.34 + hash21(identity + group * 27.3) * 0.14);
      float groupBound = boxDistance(point - vec3(cluster.x, 1.2, cluster.y), vec3(2.75, 1.2, 2.75));
      if (groupBound >= min(foliage, min(stone, thresholdGlow))) continue;
      if (groupBound > 0.24) {
        foliage = min(foliage, groupBound);
        continue;
      }
      for (int slot = 0; slot < 4; slot++) {
        float index = group * 4.0 + float(slot);
        float random = hash21(identity + index * 7.31);
        if (random > 0.78) continue;
        float spray = phase + index * 2.39996 + random * 0.85;
        float radius = 0.55 + hash21(identity + index * 17.91) * 1.45;
        vec2 root = cluster + vec2(cos(spray), sin(spray)) * radius;
        root = clamp(root, -halfSize + 1.15, halfSize - 1.15);
        if (length(root - exitRoot) < 1.7) continue;
        vec2 tileIndex = clamp(floor(root / tileSpacing + (tileCount - 1.0) * 0.5 + 0.5), vec2(0.0), tileCount - 1.0);
        vec2 tileCenter = (tileIndex - (tileCount - 1.0) * 0.5) * tileSpacing;
        if (length(root - tileCenter) < 1.0) continue;
        vec3 plant = point - vec3(root.x, 0.18, root.y);
        float bound = boxDistance(plant - vec3(0.0, 1.2, 0.0), vec3(0.74, 1.2, 0.74));
        if (bound >= min(foliage, min(stone, thresholdGlow))) continue;
        float material = MATERIAL_GRASS;
        float speciesRoll = hash21(identity + index * 23.9 + 91.2);
        float species = group < 2.0 ? dominantSpecies : companionSpecies;
        if (speciesRoll > dominance) species = floor(hash21(identity + index * 31.7 + 113.6) * 4.0);
        float flower = bound > 0.14 ? bound : surrealFlowerDistance(plant, species, growth, random, material);
        if (flower < foliage) { foliage = flower; flowerMaterial = material; }
      }
    }
    return min(stone, min(rock, min(soil, min(foliage, thresholdGlow))));
  }

  float courtyardWaterDistance(vec3 origin, vec3 direction) {
    if (direction.y >= -0.0001) return -1.0;
    vec2 cell = floor((origin.xz + STRUCTURE_CELL_HALF) / STRUCTURE_CELL);
    if (cultivationCell(cell)) return -1.0;
    if (hash21(cell + uSeed * 0.043) > structurePresence()) return -1.0;
    vec2 center = structureCenterForCell(cell);
    float ground = terrainFoundation(center);
    if (origin.y >= ground - 0.9 || ground < uWaterLevel + STRUCTURE_WATER_CLEARANCE) return -1.0;
    float candidate = (ground - 5.42 - origin.y) / direction.y;
    if (candidate <= 0.0) return -1.0;
    float variant = hash21(cell + 17.8);
    float widthExpression = clamp(uMechanicalIntensity * 0.55 + uStructures * 0.2, 0.0, 1.0);
    float depthExpression = clamp(uRitualIntensity * 0.4 + uStructures * 0.24, 0.0, 1.0);
    float width = mix(15.0, 23.0, hash21(cell + 4.9)) * mix(0.9, 1.18, widthExpression);
    float depth = mix(28.0, 44.0, hash21(cell + 11.3)) * mix(0.9, 1.2, depthExpression);
    vec2 local = rotate2((floor(variant * 4.0) + 0.5) * 1.5707963) * (origin.xz + direction.xz * candidate - center);
    vec4 node; vec2 nodeLocal;
    float corridor = mazePlanDistance(local, cell, width, depth, variant, node, nodeLocal);
    if (node.a < 0.5 || node.a > 254.5 || corridor >= -0.02) return -1.0;
    float shape = floor((node.a - 1.0) / 48.0);
    vec2 count = vec2(shape > 1.5 ? 4.0 : 3.0, shape > 0.5 ? 3.0 : 2.0);
    float role = floor(mod(node.a - 1.0, 48.0) / 3.0);
    vec2 spacing = vec2(width * 0.17, (depth * 0.64 - 1.2) / 4.0);
    vec2 offset = vec2(mod(role, count.x) - (count.x - 1.0) * 0.5, -(floor(role / count.x) - (count.y - 1.0) * 0.5)) * spacing;
    vec2 courtyardPoint = nodeLocal + offset;
    vec2 halfSize = spacing * (count * 0.5 - vec2(0.04, 0.06));
    return courtyardWaterShape(courtyardPoint, halfSize, cell) < 0.0 ? candidate : -1.0;
  }

  float architectureComponentDistance(vec3 point, bool includeFlowers, out float material) {
    float spacing = STRUCTURE_CELL;
    vec2 cell = floor((point.xz + spacing * 0.5) / spacing);
    material = MATERIAL_CONCRETE;
    if (cultivationCell(cell)) return 1000.0;
    float random = hash21(cell + uSeed * 0.043);
    if (random > structurePresence()) return 1000.0;

    vec2 center = structureCenterForCell(cell);
    vec2 planar = point.xz - center;
    if (max(abs(planar.x), abs(planar.y)) > 48.0) return 1000.0;

    float ground = terrainFoundation(center);
    if (ground < uWaterLevel + STRUCTURE_WATER_CLEARANCE) return 1000.0;

    float variant = hash21(cell + 17.8);
    float widthExpression = clamp(uMechanicalIntensity * 0.55 + uStructures * 0.2, 0.0, 1.0);
    float depthExpression = clamp(uRitualIntensity * 0.4 + uStructures * 0.24, 0.0, 1.0);
    float heightExpression = clamp(uStructures * 0.28 + uMechanicalIntensity * 0.22 + uRitualIntensity * 0.16, 0.0, 1.0);
    float width = mix(15.0, 23.0, hash21(cell + 4.9)) * mix(0.9, 1.18, widthExpression);
    float depth = mix(28.0, 44.0, hash21(cell + 11.3)) * mix(0.9, 1.2, depthExpression);
    float height = mix(16.0, 29.0, hash21(cell + 24.7)) * mix(0.88, 1.32, heightExpression);
    float wall = mix(1.05, 1.75, variant) * mix(0.92, 1.18, clamp(uMechanicalIntensity * 0.38, 0.0, 1.0));
    vec3 local = vec3(planar.x, point.y - ground + 0.5, planar.y);
    mat2 structureRotation = rotate2((floor(variant * 4.0) + 0.5) * 1.5707963);
    local.xz = structureRotation * local.xz;
    vec2 cameraLocal = structureRotation * (cameraPosition.xz - center);
    vec2 morphEnvelope = vec2(width * 0.72, depth * 0.64);
    float distanceToEnvelope = length(max(abs(cameraLocal) - morphEnvelope, 0.0));
    float structureDetail = 1.0 - smoothstep(
      10.0 * uDetailScale,
      72.0 * uDetailScale,
      distanceToEnvelope
    );
    bool undergroundView = cameraPosition.y < ground - 0.9;
    if (undergroundView) structureDetail = 1.0;
    float boulderMass = undergroundView || structureDetail >= 0.94
      ? 1000.0
      : architectureBoulderDistance(local, cell, width, depth, height, variant);
    if (structureDetail < 0.002) return boulderMass;
    float styleRoll = fract(
      hash21(cell + 155.4)
      + uMechanicalIntensity * 0.21
      + uRitualIntensity * 0.33
      + uOrnateInteriors * 0.17
      + uAbandonedInteriors * 0.13
    );
    float structureStyle = floor(styleRoll * 4.0);
    float classicScore = 0.52 + hash21(cell + 139.1) * 0.55;
    float sandyScore = 0.12 + uSandyInteriors * 0.98 + hash21(cell + 101.3) * 0.5;
    float ornateScore = 0.1 + uOrnateInteriors * 0.98 + hash21(cell + 114.7) * 0.5;
    float abandonedScore = 0.14 + uAbandonedInteriors * 0.98 + hash21(cell + 127.9) * 0.5;
    float interiorMaterial = hash21(cell + 91.7) + uRitualIntensity * 0.22 > 0.58 ? MATERIAL_BRASS : MATERIAL_MARBLE;
    float winningScore = classicScore;
    if (sandyScore > winningScore) {
      winningScore = sandyScore;
      interiorMaterial = MATERIAL_SAND;
    }
    if (ornateScore > winningScore) {
      winningScore = ornateScore;
      interiorMaterial = MATERIAL_ORNATE;
    }
    if (abandonedScore > winningScore) interiorMaterial = MATERIAL_ABANDONED;
    float undergroundRoll = fract(
      hash21(cell + 211.7)
      + uSandyInteriors * 0.17
      + uOrnateInteriors * 0.29
      + uAbandonedInteriors * 0.37
      + uPsychedelicIntensity * 0.23
    );
    float undergroundMaterial = undergroundRoll < 0.17 ? MATERIAL_CAVE
      : undergroundRoll < 0.34 ? MATERIAL_CONCRETE
      : undergroundRoll < 0.52 ? MATERIAL_LIMINAL
      : undergroundRoll < 0.69 ? MATERIAL_ORNATE
      : undergroundRoll < 0.84 ? MATERIAL_MARBLE
      : MATERIAL_ABANDONED;

    float ceilingRoll = fract(hash21(cell + 76.2) + uCeilingVariation * 0.41);
    float ceilingMode = floor(fract(ceilingRoll + structureStyle * 0.071) * 6.0);
    float ceilingDrop = ceilingMode == 1.0 ? mix(0.8, 2.6, hash21(cell + 82.4)) : 0.0;
    ceilingDrop += ceilingMode == 2.0 ? mix(1.4, 3.8, hash21(cell + 86.1)) : 0.0;

    float outer = boxDistance(local - vec3(0.0, height * 0.5, 0.0), vec3(width * 0.5, height * 0.5, depth * 0.5));
    float innerBottom = 0.56;
    float innerTop = height - mix(1.1, 2.2, variant) - ceilingDrop;
    float inner = boxDistance(
      local - vec3(0.0, (innerBottom + innerTop) * 0.5, 0.0),
      vec3(width * 0.5 - wall, (innerTop - innerBottom) * 0.5, depth * 0.5 - wall)
    );
    float cathedral = max(outer, -inner);
    float stairSide = variant > 0.5 ? 1.0 : -1.0;
    float stairX = stairSide * width * 0.22;
    float stairStart = depth * 0.2;
    float stairEnd = -depth * 0.14;
    float stairCenter = (stairStart + stairEnd) * 0.5;
    float stairHalfDepth = (stairStart - stairEnd) * 0.5 + 0.18;
    float stairVoid = boxDistance(
      local - vec3(stairX, -2.15, stairCenter),
      vec3(STAIR_WIDTH, 3.35, stairHalfDepth)
    );
    cathedral = max(cathedral, -stairVoid);

    float doorWidth = mix(3.0, 4.6, clamp(uRitualIntensity * 0.58 + variant * 0.32, 0.0, 1.0));
    float doorHeight = mix(3.8, 5.4, variant);
    float frontDoor = boxDistance(local - vec3(0.0, doorHeight * 0.5, depth * 0.5), vec3(doorWidth * 0.5, doorHeight * 0.5, wall * 1.7));
    float backDoor = boxDistance(local - vec3(0.0, doorHeight * 0.5, -depth * 0.5), vec3(doorWidth * 0.5, doorHeight * 0.5, wall * 1.7));
    float sideDoor = boxDistance(local - vec3(width * 0.5, doorHeight * 0.46, 0.0), vec3(wall * 1.7, doorHeight * 0.46, doorWidth * 0.44));
    float skylightWidth = ceilingMode == 0.0 ? width * 0.16 : width * 0.08;
    float skylightDepth = ceilingMode == 3.0 ? depth * 0.38 : depth * 0.22;
    float skylight = boxDistance(local - vec3(0.0, height, 0.0), vec3(skylightWidth, wall * 1.8, skylightDepth));
    cathedral = max(cathedral, -frontDoor);
    cathedral = max(cathedral, -backDoor);
    cathedral = max(cathedral, -sideDoor);
    cathedral = max(cathedral, -skylight);
    float dominantSide = hash21(cell + 274.1) > 0.5 ? 1.0 : -1.0;
    float angularity = mix(0.08, 0.24, hash21(cell + 286.7));
    float upperCornerCut = brutalistSlabDistance(
      local,
      vec3(dominantSide * width * 0.48, height * 0.82, depth * 0.48),
      vec3(width * 0.2, height * 0.25, wall * 2.4),
      dominantSide * angularity,
      vec2(dominantSide * angularity * 0.72, 0.0)
    );
    float diagonalReveal = brutalistSlabDistance(
      local,
      vec3(-dominantSide * width * 0.25, height * 0.61, -depth * 0.49),
      vec3(width * 0.105, height * 0.2, wall * 2.2),
      -dominantSide * angularity * 0.58,
      vec2(-dominantSide * angularity * 0.34, 0.0)
    );
    cathedral = max(cathedral, -upperCornerCut);
    cathedral = max(cathedral, -diagonalReveal);
    if (interiorMaterial > MATERIAL_ORNATE_MAX) {
      float roofBreach = boxDistance(
        local - vec3(width * 0.2, height, -depth * 0.24),
        vec3(width * 0.13, wall * 2.1, depth * 0.1)
      );
      cathedral = max(cathedral, -roofBreach);
    }

    vec3 pylonBounds = vec3(mix(1.1, 1.9, variant), height * 0.36, mix(2.2, 3.8, variant));
    float pylonOne = brutalistSlabDistance(
      local,
      vec3(width * 0.5 + pylonBounds.x * 0.55, pylonBounds.y, depth * 0.27),
      pylonBounds,
      angularity * 0.34,
      vec2(0.0)
    );
    float pylonTwo = brutalistSlabDistance(
      local,
      vec3(-width * 0.5 - pylonBounds.x * 0.55, pylonBounds.y * 0.88, depth * 0.27),
      vec3(pylonBounds.x * 0.82, pylonBounds.y * 0.88, pylonBounds.z * 1.12),
      -angularity * 0.58,
      vec2(0.0)
    );
    float pylonThree = brutalistSlabDistance(
      local,
      vec3(width * 0.5 + pylonBounds.x * 0.55, pylonBounds.y * 0.72, -depth * 0.27),
      vec3(pylonBounds.x * 1.14, pylonBounds.y * 0.72, pylonBounds.z * 0.84),
      -angularity * 0.76,
      vec2(0.0)
    );
    float pylonFour = brutalistSlabDistance(
      local,
      vec3(-width * 0.5 - pylonBounds.x * 0.55, pylonBounds.y * 1.08, -depth * 0.27),
      vec3(pylonBounds.x * 0.74, pylonBounds.y * 1.08, pylonBounds.z),
      angularity * 0.46,
      vec2(0.0)
    );
    float approachLeft = brutalistSlabDistance(
      local,
      vec3(-doorWidth * 0.9, height * 0.24, depth * 0.5 + 3.2),
      vec3(0.58, height * 0.24, 2.6),
      angularity * 0.24,
      vec2(0.0)
    );
    float approachRight = brutalistSlabDistance(
      local,
      vec3(doorWidth * 0.9, height * 0.2, depth * 0.5 + 3.2),
      vec3(0.48, height * 0.2, 2.25),
      -angularity * 0.42,
      vec2(0.0)
    );
    float plinth = boxDistance(local - vec3(0.0, -0.03, 0.0), vec3(width * 0.62, 0.59, depth * 0.58));
    plinth = max(plinth, -stairVoid);

    float exteriorMass = min(plinth, min(min(pylonOne, pylonTwo), min(pylonThree, pylonFour)));
    exteriorMass = min(exteriorMass, min(approachLeft, approachRight));
    if (structureDetail > 0.002) {
      float primaryLean = mix(0.055, 0.14, hash21(cell + 301.2));
      float primaryMass = brutalistSlabDistance(
        local,
        vec3(dominantSide * width * 0.56, height * 0.68, -depth * 0.06),
        vec3(width * 0.12, height * 0.32, depth * mix(0.22, 0.34, variant)),
        dominantSide * angularity * 0.46,
        vec2(dominantSide * primaryLean, angularity * 0.08)
      );
      float counterweight = brutalistSlabDistance(
        local,
        vec3(-dominantSide * width * 0.1, height + 0.32, depth * 0.1),
        vec3(width * 0.34, 0.38, depth * 0.2),
        -dominantSide * angularity,
        vec2(-dominantSide * primaryLean * 0.22, 0.0)
      );
      float silhouette = min(primaryMass, counterweight);
      if (structureStyle < 0.5) {
        float crown = brutalistSlabDistance(
          local,
          vec3(-dominantSide * width * 0.08, height + 0.92, -depth * 0.07),
          vec3(width * 0.43, 0.92, depth * 0.28),
          dominantSide * angularity * 0.74,
          vec2(dominantSide * 0.045, -angularity * 0.08)
        );
        silhouette = min(silhouette, crown);
      } else if (structureStyle < 1.5) {
        float secondaryTower = brutalistSlabDistance(
          local,
          vec3(-dominantSide * width * 0.48, height * 0.86, depth * 0.04),
          vec3(width * 0.1, height * 0.24, depth * 0.31),
          -dominantSide * angularity * 0.62,
          vec2(-dominantSide * primaryLean * 0.72, -angularity * 0.07)
        );
        float bridge = brutalistSlabDistance(
          local,
          vec3(dominantSide * width * 0.08, height + 0.25, depth * 0.02),
          vec3(width * 0.38, 0.42, depth * 0.14),
          dominantSide * angularity * 0.38,
          vec2(0.0, angularity * 0.05)
        );
        silhouette = min(silhouette, min(secondaryTower, bridge));
      } else if (structureStyle < 2.5) {
        float lowerCrown = brutalistSlabDistance(
          local,
          vec3(dominantSide * width * 0.06, height + 0.44, depth * 0.01),
          vec3(width * 0.49, 0.44, depth * 0.4),
          dominantSide * angularity * 0.58,
          vec2(dominantSide * 0.035, 0.0)
        );
        float upperCrown = brutalistSlabDistance(
          local,
          vec3(-dominantSide * width * 0.12, height + 1.28, -depth * 0.09),
          vec3(width * 0.32, 0.4, depth * 0.28),
          -dominantSide * angularity * 0.9,
          vec2(-dominantSide * 0.06, angularity * 0.08)
        );
        silhouette = min(silhouette, min(lowerCrown, upperCrown));
      } else {
        float roofSpine = brutalistSlabDistance(
          local,
          vec3(dominantSide * width * 0.08, height + 1.65, -depth * 0.03),
          vec3(0.5, 1.65, depth * 0.4),
          dominantSide * angularity,
          vec2(dominantSide * primaryLean * 0.84, angularity * 0.12)
        );
        float cantilever = brutalistSlabDistance(
          local,
          vec3(-dominantSide * width * 0.08, height + 0.4, depth * 0.08),
          vec3(width * 0.62, 0.4, depth * 0.14),
          -dominantSide * angularity * 0.78,
          vec2(-dominantSide * 0.04, 0.0)
        );
        silhouette = min(silhouette, min(roofSpine, cantilever));
      }
      exteriorMass = min(exteriorMass, silhouette);
    }
    float interiorMass = 1000.0;
    float repeatZ = mod(local.z + 3.0, 6.0) - 3.0;
    float ceilingBounds = boxDistance(
      local - vec3(0.0, innerTop - 0.55, 0.0),
      vec3(width * 0.5 - wall - 0.1, 0.85, depth * 0.5 - wall - 0.2)
    );
    if (structureDetail > 0.002 && (ceilingMode == 1.0 || ceilingMode == 3.0)) {
      float transverseRibs = boxDistance(
        vec3(local.x, local.y - innerTop + 0.48, repeatZ),
        vec3(width * 0.5 - wall, 0.34, ceilingMode == 3.0 ? 0.2 : 0.38)
      );
      interiorMass = max(transverseRibs, ceilingBounds);
    }
    if (structureDetail > 0.002 && ceilingMode == 2.0) {
      float repeatX = mod(local.x + 2.5, 5.0) - 2.5;
      float crossRibs = boxDistance(
        vec3(repeatX, local.y - innerTop + 0.62, local.z),
        vec3(0.26, 0.46, depth * 0.5 - wall)
      );
      float transverseRibs = boxDistance(
        vec3(local.x, local.y - innerTop + 0.62, repeatZ),
        vec3(width * 0.5 - wall, 0.46, 0.28)
      );
      interiorMass = max(min(crossRibs, transverseRibs), ceilingBounds);
    }
    if (structureDetail > 0.002 && ceilingMode == 4.0) {
      float repeatX = mod(local.x + 2.1, 4.2) - 2.1;
      float repeatCofferZ = mod(local.z + 2.1, 4.2) - 2.1;
      float cofferX = boxDistance(
        vec3(repeatX, local.y - innerTop + 0.42, local.z),
        vec3(0.16, 0.3, depth * 0.5 - wall)
      );
      float cofferZ = boxDistance(
        vec3(local.x, local.y - innerTop + 0.42, repeatCofferZ),
        vec3(width * 0.5 - wall, 0.3, 0.16)
      );
      interiorMass = max(min(cofferX, cofferZ), ceilingBounds);
    }
    if (structureDetail > 0.002 && ceilingMode == 5.0) {
      float repeatX = mod(local.x + 1.65, 3.3) - 1.65;
      float hangingFins = boxDistance(
        vec3(repeatX, local.y - innerTop + 0.72, local.z),
        vec3(0.12, 0.58, depth * 0.5 - wall)
      );
      interiorMass = max(hangingFins, ceilingBounds);
    }
    if (structureDetail > 0.002 && interiorMaterial > MATERIAL_ORNATE_MAX && ceilingMode == 0.0) {
      float brokenBeam = boxDistance(
        local - vec3(width * 0.12, innerTop - 1.1, -depth * 0.12),
        vec3(width * 0.32, 0.32, 0.38)
      );
      interiorMass = brokenBeam;
    }
    float undergroundMass = 1000.0;
    float portalSurface = 0.0;
    float seedBagMass = 1000.0;
    float seedBagSurface = 0.0;
    float courtyardFlowerMaterial = MATERIAL_COURTYARD_FOLIAGE;
    float courtyardExitMass = 1000.0;
    float courtyardExitSurface = 0.0;
    float courtyardStoneMass = 1000.0;
    float courtyardRockMass = 1000.0;
    float courtyardSoilMass = 1000.0;
    float courtyardFoliageMass = 1000.0;
    float courtyardSurface = 0.0;
    float courtyardStoneSurface = 0.0;
    float courtyardRockSurface = 0.0;
    float courtyardSoilSurface = 0.0;
    float courtyardFoliageSurface = 0.0;
    float courtyardSkyShaft = 1000.0;
    if (structureDetail > 0.002) {
      vec4 mazeNode;
      vec2 mazeLocal;
      float corridor = mazePlanDistance(local.xz, cell, width, depth, variant, mazeNode, mazeLocal);
      float firstRow = stairEnd - 1.2;
      float lastRow = -depth * 0.78;
      float ceilingUnderside = -0.8 - fract(hash21(cell + 76.2) + uCeilingVariation * 0.41) * 0.55;
      bool courtyardNode = mazeNode.a > 0.5 && mazeNode.a < 254.5 && undergroundView;
      float ceilingBoundary = courtyardNode ? -1000.0 : local.y - ceilingUnderside;
      float cavity = max(corridor, max(-5.1 - local.y, ceilingBoundary));
      float envelope = boxDistance(
        local - vec3(0.0, -2.3, (firstRow + 2.1 + lastRow - mazeRearMargin(depth)) * 0.5),
        vec3(width * 0.5, 2.8, (firstRow + 2.1 - lastRow + mazeRearMargin(depth)) * 0.5)
      );
      float shell = max(envelope, -cavity);
      shell = max(shell, -stairVoid);
      vec4 ecology = ecologyDataForCell(cell);
      if (ecology.b < 0.5 && ecology.a > 0.0) {
        vec3 bagPoint = local - vec3(stairX, -UNDERGROUND_DESCENT + 0.92, stairEnd - 2.4);
        seedBagMass = ellipsoidDistance(bagPoint, vec3(0.34, 0.42, 0.26));
        seedBagMass = min(seedBagMass, ellipsoidDistance(bagPoint - vec3(0.0, 0.38, 0.0), vec3(0.16, 0.15, 0.14)));
        seedBagSurface = step(seedBagMass, shell);
        shell = min(shell, seedBagMass);
      }
      float marker = 1000.0;
      if (courtyardNode) {
        vec2 spacing = vec2(width * 0.17, (depth * 0.64 - 1.2) / 4.0);
        float courtyardShape = floor((mazeNode.a - 1.0) / 48.0);
        float columns = courtyardShape > 1.5 ? 4.0 : 3.0;
        float rows = courtyardShape > 0.5 ? 3.0 : 2.0;
        float encodedCourtyard = mod(mazeNode.a - 1.0, 48.0);
        float courtyardRole = floor(encodedCourtyard / 3.0);
        float courtyardStyle = mod(encodedCourtyard, 3.0) + 1.0;
        vec2 courtyardOffset = vec2((mod(courtyardRole, columns) - (columns - 1.0) * 0.5) * spacing.x,
          -(floor(courtyardRole / columns) - (rows - 1.0) * 0.5) * spacing.y);
        vec3 courtyardPoint = vec3(mazeLocal + courtyardOffset, local.y + 5.1);
        courtyardPoint = courtyardPoint.xzy;
        courtyardSkyShaft = mazeBox(courtyardPoint.xz, spacing * vec2(columns * 0.5 - 0.04, rows * 0.5 - 0.06));
        float courtyardDecor = indoorCourtyardDistance(
          courtyardPoint,
          spacing * vec2(columns * 0.5 - 0.04, rows * 0.5 - 0.06),
          spacing,
          vec2(columns, rows),
          courtyardStyle,
          cell + courtyardStyle * 17.3,
          courtyardStoneMass,
          courtyardRockMass,
          courtyardSoilMass,
          courtyardFoliageMass,
          courtyardExitMass,
          courtyardFlowerMaterial,
          proximityDetail(point.xz, 7.0, 46.0),
          includeFlowers
        );
        courtyardDecor = min(courtyardStoneMass, min(courtyardRockMass, min(courtyardSoilMass, min(courtyardFoliageMass, courtyardExitMass))));
        courtyardSurface = 1.0;
        courtyardStoneSurface = step(courtyardStoneMass, min(shell, min(courtyardRockMass, min(courtyardSoilMass, courtyardFoliageMass))));
        courtyardRockSurface = step(courtyardRockMass, min(shell, min(courtyardStoneMass, min(courtyardSoilMass, courtyardFoliageMass))));
        float courtyardSoilBand = 1.0 - step(0.075, abs(courtyardSoilMass));
        courtyardSoilSurface = max(courtyardSoilBand,
          step(courtyardSoilMass, min(shell, min(courtyardStoneMass, min(courtyardRockMass, courtyardFoliageMass)))));
        courtyardFoliageSurface = step(courtyardFoliageMass, min(shell, min(courtyardStoneMass, min(courtyardRockMass, courtyardSoilMass))));
        courtyardExitSurface = step(courtyardExitMass, min(shell, min(courtyardStoneMass, min(courtyardRockMass, min(courtyardSoilMass, courtyardFoliageMass)))));
        shell = min(shell, courtyardDecor);
      }
      if (mazeNode.b > 0.0 && mazeNode.a > 0.0) {
        vec3 portalPoint = vec3(mazeLocal.x, local.y + 3.78, mazeLocal.y);
        float portalTime = mod(uTime * uMotionScale, 628.31854);
        float breathPhase = portalTime * 1.22 + mazeNode.b * 2.0;
        float breath = sin(breathPhase) * 0.72 + sin(breathPhase * 2.0 - 1.1) * 0.2;
        float spasm = sin(portalTime * 4.2 + mazeNode.b * 4.3) * sin(breathPhase) * 0.014;
        vec3 breathingPoint = portalPoint;
        breathingPoint.xz /= 1.0 + breath * 0.2;
        breathingPoint.y /= 1.0 + breath * 0.24;
        vec3 spinningPoint = portalPoint;
        spinningPoint.xz = rotate2(portalTime * 0.22) * spinningPoint.xz;
        float membrane = sin(spinningPoint.y * 7.0 - spinningPoint.x * 3.2);
        membrane *= sin((spinningPoint.x - spinningPoint.z) * 8.5 + portalTime * 0.35);
        marker = length(breathingPoint) - (0.625 + breath * 0.065 + membrane * 0.016 + spasm);
      }
      portalSurface = step(marker, shell);
      undergroundMass = min(shell, marker);
    }

    float baseMass = min(cathedral, exteriorMass);
    float aboveStructure = min(baseMass, interiorMass);
    aboveStructure = max(aboveStructure, -courtyardSkyShaft);
    float structure = min(aboveStructure, undergroundMass);
    float cathedralSurface = step(cathedral, min(exteriorMass, interiorMass));
    float ceilingSurface = step(interiorMass, baseMass);
    float undergroundSurface = step(undergroundMass, aboveStructure);
    float innerSurface = step(outer, -inner);
    if (undergroundSurface > 0.5) {
      material = portalSurface > 0.5 ? MATERIAL_PORTAL
        : seedBagSurface > 0.5 ? MATERIAL_SEED_BAG
        : courtyardExitSurface > 0.5 ? MATERIAL_COURTYARD_EXIT
        : courtyardRockSurface > 0.5 ? MATERIAL_COURTYARD_ROCK
        : courtyardFoliageSurface > 0.5 ? courtyardFlowerMaterial
        : courtyardSoilSurface > 0.5 ? MATERIAL_COURTYARD_SOIL
        : courtyardStoneSurface > 0.5 || courtyardSurface > 0.5 ? MATERIAL_COURTYARD_STONE
        : undergroundMaterial;
    } else if (cathedralSurface * innerSurface > 0.5 || ceilingSurface > 0.5) {
      material = interiorMaterial;
    }
    return undergroundView ? structure : morphArchitectureDistance(boulderMass, structure, structureDetail);
  }

  float architectureDistance(vec3 point, out float material) {
    float architectureMaterial;
    float architecture = architectureComponentDistance(point, true, architectureMaterial);
    float plantMaterial;
    float plant = plantedDistance(point, plantMaterial);
    material = plant < architecture ? plantMaterial : architectureMaterial;
    return min(plant, architecture);
  }
`
