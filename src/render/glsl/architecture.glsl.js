export const architectureGlsl = `
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

  float architectureDistance(vec3 point, out float material) {
    float spacing = STRUCTURE_CELL;
    vec2 cell = floor((point.xz + spacing * 0.5) / spacing);
    float random = hash21(cell + uSeed * 0.043);
    material = MATERIAL_CONCRETE;
    if (random > structurePresence()) return 1000.0;

    vec2 center = structureCenterForCell(cell);
    vec2 planar = point.xz - center;
    if (max(abs(planar.x), abs(planar.y)) > 38.0) return 1000.0;
    float structureDetail = proximityDetail(center, 18.0, 88.0);

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
    local.xz = rotate2((floor(variant * 4.0) + 0.5) * 1.5707963) * local.xz;
    if (structureDetail < 0.035) {
      float distantBase = boxDistance(
        local - vec3(0.0, height * 0.5, 0.0),
        vec3(width * 0.5, height * 0.5, depth * 0.5)
      );
      float distantSide = variant > 0.5 ? 1.0 : -1.0;
      float distantCrown = brutalistSlabDistance(
        local,
        vec3(distantSide * width * 0.12, height * 0.91, -depth * 0.06),
        vec3(width * 0.41, height * 0.18, depth * 0.32),
        distantSide * mix(0.06, 0.17, variant),
        vec2(distantSide * 0.075, 0.018)
      );
      return min(distantBase, distantCrown);
    }
    float styleRoll = fract(
      hash21(cell + 155.4)
      + uMechanicalIntensity * 0.21
      + uRitualIntensity * 0.33
      + uOrnateInteriors * 0.17
      + uAbandonedInteriors * 0.13
    );
    float structureStyle = floor(styleRoll * 4.0);
    float tunnelRoll = fract(
      hash21(cell + 233.1)
      + uSandyInteriors * 0.16
      + uOrnateInteriors * 0.24
      + uPsychedelicIntensity * 0.18
    );
    float tunnelFactor = mix(TUNNEL_FACTOR_MIN, TUNNEL_FACTOR_MAX, tunnelRoll);

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
      : undergroundRoll < 0.34 ? MATERIAL_FLOODED
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
      vec3(1.55, 3.35, stairHalfDepth)
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
    if (structureDetail > 0.002) {
      float chamberHalfX = width * 0.2;
      float chamberStart = stairEnd + 0.2;
      float chamberEnd = -depth * min(0.84, tunnelFactor + 0.25);
      float portalMarkerZ = chamberEnd + 0.3;
      float chamberCenter = (chamberStart + chamberEnd) * 0.5;
      float chamberHalfDepth = (chamberStart - chamberEnd) * 0.5;
      float corridorOffset = undergroundCenterOffset(local.z, chamberStart, chamberEnd, chamberHalfX, variant, structureStyle);
      vec3 corridorLocal = vec3(local.x - stairX - corridorOffset, local.y, local.z);
      float endOffset = undergroundCenterOffset(chamberEnd, chamberStart, chamberEnd, chamberHalfX, variant, structureStyle);
      float ceilingUnderside = undergroundMaterial > MATERIAL_FLOODED_MAX ? -1.38 : -0.62;
      if (undergroundMaterial > MATERIAL_ABANDONED_MAX && undergroundMaterial < MATERIAL_CAVE_MAX) ceilingUnderside = -0.34;
      if (undergroundMaterial > MATERIAL_CAVE_MAX && undergroundMaterial < MATERIAL_FLOODED_MAX) ceilingUnderside = -0.82;
      float chamberCenterY = (-5.1 + ceilingUnderside) * 0.5;
      float chamberHalfHeight = (ceilingUnderside + 5.1) * 0.5;
      float wallThickness = undergroundMaterial > MATERIAL_FLOODED_MAX ? 0.18 : 0.24;
      if (undergroundMaterial > MATERIAL_ABANDONED_MAX && undergroundMaterial < MATERIAL_CAVE_MAX) wallThickness = 0.4;
      float sideLeft = boxDistance(
        corridorLocal - vec3(-chamberHalfX, chamberCenterY, chamberCenter),
        vec3(wallThickness, chamberHalfHeight, chamberHalfDepth)
      );
      float sideRight = boxDistance(
        corridorLocal - vec3(chamberHalfX, chamberCenterY, chamberCenter),
        vec3(wallThickness, chamberHalfHeight, chamberHalfDepth)
      );
      float backWall = boxDistance(
        local - vec3(stairX + endOffset, chamberCenterY, chamberEnd),
        vec3(chamberHalfX, chamberHalfHeight, 0.26)
      );
      float rhythm = mix(2.5, 5.4, fract(hash21(cell + 247.6) + styleRoll));
      if (undergroundMaterial > MATERIAL_FLOODED_MAX) rhythm = 2.75;
      if (undergroundMaterial > MATERIAL_ABANDONED_MAX && undergroundMaterial < MATERIAL_CAVE_MAX) rhythm = 5.8;
      if (undergroundMaterial > MATERIAL_SAND_MAX && undergroundMaterial < MATERIAL_ORNATE_MAX) rhythm = 3.05;
      float repeatingZ = mod(local.z - chamberEnd, rhythm) - rhythm * 0.5;
      float wallRibs = boxDistance(
        vec3(abs(corridorLocal.x) - chamberHalfX + 0.34, local.y - chamberCenterY, repeatingZ),
        vec3(0.34, chamberHalfHeight, undergroundMaterial > MATERIAL_FLOODED_MAX ? 0.12 : 0.22)
      );
      float ceilingBeams = boxDistance(
        vec3(corridorLocal.x, local.y - ceilingUnderside - 0.18, repeatingZ),
        vec3(chamberHalfX, undergroundMaterial > MATERIAL_FLOODED_MAX ? 0.12 : 0.2, undergroundMaterial > MATERIAL_CAVE_MAX && undergroundMaterial < MATERIAL_FLOODED_MAX ? 0.14 : 0.28)
      );
      if (undergroundMaterial > MATERIAL_ABANDONED_MAX && undergroundMaterial < MATERIAL_CAVE_MAX) {
        wallRibs = 1000.0;
        ceilingBeams = 1000.0;
      }
      float ceilingHalfHeight = (0.5 - ceilingUnderside) * 0.5;
      float ceilingCenterY = (0.5 + ceilingUnderside) * 0.5;
      float chamberCeiling = boxDistance(
        corridorLocal - vec3(0.0, ceilingCenterY, chamberCenter),
        vec3(chamberHalfX, ceilingHalfHeight, chamberHalfDepth)
      );
      float chamberFloor = boxDistance(
        corridorLocal - vec3(0.0, -5.19, chamberCenter),
        vec3(chamberHalfX, 0.12, chamberHalfDepth)
      );
      vec3 portalPoint = vec3(corridorLocal.x, local.y + 2.86, local.z - portalMarkerZ);
      float portalOuter = boxDistance(portalPoint, vec3(min(1.62, chamberHalfX * 0.46), 1.72, 0.16));
      float portalInner = boxDistance(portalPoint, vec3(min(1.18, chamberHalfX * 0.34), 1.28, 0.34));
      float portalMarker = max(portalOuter, -portalInner);
      float undergroundShell = min(min(sideLeft, sideRight), min(backWall, min(wallRibs, min(ceilingBeams, min(chamberCeiling, chamberFloor)))));
      portalSurface = step(portalMarker, undergroundShell);
      undergroundMass = min(undergroundShell, portalMarker);
      if (undergroundMaterial > MATERIAL_ABANDONED_MAX && undergroundMaterial < MATERIAL_CAVE_MAX) {
        float caveRelief = fbm(point.xz * 0.34 + point.y * vec2(0.07, -0.09) + uSeed * 0.31) - 0.5;
        undergroundMass += caveRelief * 0.16 * structureDetail;
      }
    }

    float baseMass = min(cathedral, exteriorMass);
    float aboveStructure = min(baseMass, interiorMass);
    float structure = min(aboveStructure, undergroundMass);
    float cathedralSurface = step(cathedral, min(exteriorMass, interiorMass));
    float ceilingSurface = step(interiorMass, baseMass);
    float undergroundSurface = step(undergroundMass, aboveStructure);
    float innerSurface = step(outer, -inner);
    if (undergroundSurface > 0.5) {
      material = portalSurface > 0.5 ? MATERIAL_PORTAL : undergroundMaterial;
    } else if (cathedralSurface * innerSurface > 0.5 || ceilingSurface > 0.5) {
      material = interiorMaterial;
    }
    return structure;
  }
`
