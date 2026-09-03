export const architectureGlsl = `
  float architectureDistance(vec3 point, out float material) {
    float spacing = STRUCTURE_CELL;
    vec2 cell = floor((point.xz + spacing * 0.5) / spacing);
    float random = hash21(cell + uSeed * 0.043);
    material = 4.0;
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
      return boxDistance(
        local - vec3(0.0, height * 0.5, 0.0),
        vec3(width * 0.5, height * 0.5, depth * 0.5)
      );
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
    float interiorMaterial = hash21(cell + 91.7) + uRitualIntensity * 0.22 > 0.58 ? 6.0 : 5.0;
    float winningScore = classicScore;
    if (sandyScore > winningScore) {
      winningScore = sandyScore;
      interiorMaterial = 7.0;
    }
    if (ornateScore > winningScore) {
      winningScore = ornateScore;
      interiorMaterial = 8.0;
    }
    if (abandonedScore > winningScore) interiorMaterial = 9.0;
    float undergroundRoll = fract(
      hash21(cell + 211.7)
      + uSandyInteriors * 0.17
      + uOrnateInteriors * 0.29
      + uAbandonedInteriors * 0.37
      + uPsychedelicIntensity * 0.23
    );
    float undergroundMaterial = undergroundRoll < 0.17 ? 10.0
      : undergroundRoll < 0.34 ? 11.0
      : undergroundRoll < 0.52 ? 12.0
      : undergroundRoll < 0.69 ? 8.0
      : undergroundRoll < 0.84 ? 5.0
      : 9.0;

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
    if (interiorMaterial > 8.5) {
      float roofBreach = boxDistance(
        local - vec3(width * 0.2, height, -depth * 0.24),
        vec3(width * 0.13, wall * 2.1, depth * 0.1)
      );
      cathedral = max(cathedral, -roofBreach);
    }

    vec3 pylonBounds = vec3(mix(1.1, 1.9, variant), height * 0.36, mix(2.2, 3.8, variant));
    float pylonOne = boxDistance(local - vec3(width * 0.5 + pylonBounds.x * 0.55, pylonBounds.y, depth * 0.27), pylonBounds);
    float pylonTwo = boxDistance(local - vec3(-width * 0.5 - pylonBounds.x * 0.55, pylonBounds.y, depth * 0.27), pylonBounds);
    float pylonThree = boxDistance(local - vec3(width * 0.5 + pylonBounds.x * 0.55, pylonBounds.y, -depth * 0.27), pylonBounds);
    float pylonFour = boxDistance(local - vec3(-width * 0.5 - pylonBounds.x * 0.55, pylonBounds.y, -depth * 0.27), pylonBounds);
    float approachLeft = boxDistance(local - vec3(-doorWidth * 0.9, height * 0.24, depth * 0.5 + 3.2), vec3(0.58, height * 0.24, 2.6));
    float approachRight = boxDistance(local - vec3(doorWidth * 0.9, height * 0.24, depth * 0.5 + 3.2), vec3(0.58, height * 0.24, 2.6));
    float plinth = boxDistance(local - vec3(0.0, -0.03, 0.0), vec3(width * 0.62, 0.59, depth * 0.58));
    plinth = max(plinth, -stairVoid);

    float exteriorMass = min(plinth, min(min(pylonOne, pylonTwo), min(pylonThree, pylonFour)));
    exteriorMass = min(exteriorMass, min(approachLeft, approachRight));
    if (structureDetail > 0.002) {
      float silhouette = 1000.0;
      if (structureStyle < 0.5) {
        silhouette = boxDistance(
          local - vec3(0.0, height + 1.05, 0.0),
          vec3(width * 0.42, 1.05, depth * 0.28)
        );
      } else if (structureStyle < 1.5) {
        float towerLeft = boxDistance(
          local - vec3(-width * 0.27, height * 0.88, 0.0),
          vec3(width * 0.14, height * 0.3, depth * 0.34)
        );
        float towerRight = boxDistance(
          local - vec3(width * 0.27, height * 0.88, 0.0),
          vec3(width * 0.14, height * 0.3, depth * 0.34)
        );
        silhouette = min(towerLeft, towerRight);
      } else if (structureStyle < 2.5) {
        float lowerCrown = boxDistance(
          local - vec3(0.0, height + 0.48, 0.0),
          vec3(width * 0.47, 0.48, depth * 0.43)
        );
        float upperCrown = boxDistance(
          local - vec3(0.0, height + 1.36, 0.0),
          vec3(width * 0.34, 0.4, depth * 0.31)
        );
        silhouette = min(lowerCrown, upperCrown);
      } else {
        float roofSpine = boxDistance(
          local - vec3(0.0, height + 1.8, 0.0),
          vec3(0.5, 1.8, depth * 0.43)
        );
        float cantilever = boxDistance(
          local - vec3(0.0, height + 0.42, depth * 0.08),
          vec3(width * 0.66, 0.42, depth * 0.14)
        );
        silhouette = min(roofSpine, cantilever);
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
    if (structureDetail > 0.002 && interiorMaterial > 8.5 && ceilingMode == 0.0) {
      float brokenBeam = boxDistance(
        local - vec3(width * 0.12, innerTop - 1.1, -depth * 0.12),
        vec3(width * 0.32, 0.32, 0.38)
      );
      interiorMass = brokenBeam;
    }

    float undergroundMass = 1000.0;
    if (structureDetail > 0.002) {
      float chamberHalfX = width * 0.2;
      float chamberStart = stairEnd + 0.2;
      float chamberEnd = -depth * min(0.7, tunnelFactor + 0.12);
      float chamberCenter = (chamberStart + chamberEnd) * 0.5;
      float chamberHalfDepth = (chamberStart - chamberEnd) * 0.5;
      float ceilingUnderside = undergroundMaterial > 11.5 ? -1.38 : -0.62;
      if (undergroundMaterial > 9.5 && undergroundMaterial < 10.5) ceilingUnderside = -0.34;
      if (undergroundMaterial > 10.5 && undergroundMaterial < 11.5) ceilingUnderside = -0.82;
      float chamberCenterY = (-5.1 + ceilingUnderside) * 0.5;
      float chamberHalfHeight = (ceilingUnderside + 5.1) * 0.5;
      float wallThickness = undergroundMaterial > 11.5 ? 0.18 : 0.24;
      if (undergroundMaterial > 9.5 && undergroundMaterial < 10.5) wallThickness = 0.4;
      float sideLeft = boxDistance(
        local - vec3(stairX - chamberHalfX, chamberCenterY, chamberCenter),
        vec3(wallThickness, chamberHalfHeight, chamberHalfDepth)
      );
      float sideRight = boxDistance(
        local - vec3(stairX + chamberHalfX, chamberCenterY, chamberCenter),
        vec3(wallThickness, chamberHalfHeight, chamberHalfDepth)
      );
      float backWall = boxDistance(
        local - vec3(stairX, chamberCenterY, chamberEnd),
        vec3(chamberHalfX, chamberHalfHeight, 0.26)
      );
      float rhythm = mix(2.5, 5.4, fract(hash21(cell + 247.6) + styleRoll));
      if (undergroundMaterial > 11.5) rhythm = 2.75;
      if (undergroundMaterial > 9.5 && undergroundMaterial < 10.5) rhythm = 5.8;
      if (undergroundMaterial > 7.5 && undergroundMaterial < 8.5) rhythm = 3.05;
      float repeatingZ = mod(local.z - chamberEnd, rhythm) - rhythm * 0.5;
      float wallRibs = boxDistance(
        vec3(abs(local.x - stairX) - chamberHalfX + 0.34, local.y - chamberCenterY, repeatingZ),
        vec3(0.34, chamberHalfHeight, undergroundMaterial > 11.5 ? 0.12 : 0.22)
      );
      float ceilingBeams = boxDistance(
        vec3(local.x - stairX, local.y - ceilingUnderside - 0.18, repeatingZ),
        vec3(chamberHalfX, undergroundMaterial > 11.5 ? 0.12 : 0.2, undergroundMaterial > 10.5 && undergroundMaterial < 11.5 ? 0.14 : 0.28)
      );
      if (undergroundMaterial > 9.5 && undergroundMaterial < 10.5) {
        wallRibs = 1000.0;
        ceilingBeams = 1000.0;
      }
      float ceilingHalfHeight = (0.5 - ceilingUnderside) * 0.5;
      float ceilingCenterY = (0.5 + ceilingUnderside) * 0.5;
      float chamberCeiling = boxDistance(
        local - vec3(stairX, ceilingCenterY, chamberCenter),
        vec3(chamberHalfX, ceilingHalfHeight, chamberHalfDepth)
      );
      float chamberFloor = boxDistance(
        local - vec3(stairX, -5.19, chamberCenter),
        vec3(chamberHalfX, 0.12, chamberHalfDepth)
      );
      undergroundMass = min(min(sideLeft, sideRight), min(backWall, min(wallRibs, min(ceilingBeams, min(chamberCeiling, chamberFloor)))));
      if (undergroundMaterial > 9.5 && undergroundMaterial < 10.5) {
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
      material = undergroundMaterial;
    } else if (cathedralSurface * innerSurface > 0.5 || ceilingSurface > 0.5) {
      material = interiorMaterial;
    } else if (structureDetail > 0.002) {
      float coarseBump = noise21(point.yz * 3.9 + point.x * 0.31 + uSeed) - 0.5;
      float fineBump = noise21(point.xy * 9.2 - point.z * 0.27 + uSeed * 0.43) - 0.5;
      float reliefDetail = smoothstep(0.24, 0.82, structureDetail);
      structure += coarseBump * 0.085 * structureDetail + fineBump * 0.032 * reliefDetail;
    }
    return structure;
  }
`
