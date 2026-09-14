export const plantedGeometryGlsl = `
  float moonbellBloomDistance(vec3 point, vec3 center, float radius, float phase) {
    float bloom = ellipsoidDistance(point - center - vec3(0.0, radius * 0.22, 0.0), vec3(0.16, 0.18, 0.16) * radius);
    for (int i = 0; i < 9; i++) {
      float fi = float(i);
      float angle = fi * 0.6981317 + phase;
      float irregularity = 0.92 + 0.12 * sin(fi * 4.17 + phase * 2.3);
      vec3 lobeCenter = center + vec3(cos(angle) * radius * 0.5, -radius * (0.24 + 0.06 * sin(fi * 2.7)), sin(angle) * radius * 0.5);
      vec3 lobe = point - lobeCenter;
      lobe.xz = rotate2(-angle) * lobe.xz;
      lobe.xy = rotate2(0.28 + 0.08 * sin(fi * 1.9 + phase)) * lobe.xy;
      float petal = ellipsoidDistance(lobe, vec3(radius * 0.29, radius * 0.78, radius * 0.115) * irregularity);
      petal += sin(lobe.y * 42.0 / max(radius, 0.02) + fi) * radius * 0.008;
      bloom = min(bloom, petal);
    }
    for (int i = 0; i < 5; i++) {
      float angle = float(i) * 1.2566371 + phase * 0.7;
      vec3 filamentTop = center - vec3(0.0, radius * 0.12, 0.0);
      vec3 filamentTip = center + vec3(cos(angle) * radius * 0.13, -radius * (0.82 + float(i) * 0.035), sin(angle) * radius * 0.13);
      bloom = min(bloom, taperedSegmentDistance(point, filamentTop, filamentTip, radius * 0.03, radius * 0.012));
      bloom = min(bloom, ellipsoidDistance(point - filamentTip, vec3(radius * 0.06, radius * 0.085, radius * 0.06)));
    }
    return bloom;
  }

  float moonbellBudDistance(vec3 point, vec3 center, float radius, float angle) {
    vec3 bud = point - center;
    bud.xz = rotate2(-angle) * bud.xz;
    bud.xy = rotate2(0.44) * bud.xy;
    float shell = ellipsoidDistance(bud, vec3(radius * 0.5, radius, radius * 0.5));
    float sepal = taperedSegmentDistance(bud, vec3(0.0, radius * 0.34, 0.0), vec3(0.0, radius * 0.82, 0.0), radius * 0.2, radius * 0.025);
    return min(shell, sepal);
  }

  float cultivatedLeafDistance(vec3 point, vec3 center, float angle, float size, float tilt) {
    vec3 leaf = point - center;
    leaf.xz = rotate2(-angle) * leaf.xz;
    leaf.xy = rotate2(tilt) * leaf.xy;
    float blade = ellipsoidDistance(leaf, vec3(size, size * 0.12, size * 0.32));
    float serration = sin(atan(leaf.z, leaf.x) * 18.0 + leaf.x * 19.0 / max(size, 0.02));
    blade += serration * size * 0.018 * smoothstep(0.12, 0.88, abs(leaf.x) / max(size, 0.02));
    return min(blade, taperedSegmentDistance(leaf, vec3(-size * 0.7, 0.0, 0.0), vec3(size * 0.72, 0.0, 0.0), size * 0.045, size * 0.012));
  }

  float seedlingRosetteDistance(vec3 point, float growth, float phase) {
    float rosette = 1000.0;
    float opening = smoothstep(0.025, 0.28, growth);
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float angle = phase + fi * 1.5707963;
      float size = mix(0.06, 0.34, opening) * mix(0.82, 1.12, 0.5 + 0.5 * sin(fi * 3.7 + phase));
      vec3 center = vec3(cos(angle) * size * 0.52, 0.055 + size * 0.2, sin(angle) * size * 0.52);
      rosette = min(rosette, cultivatedLeafDistance(point, center, angle, size, -0.38 + opening * 0.22));
    }
    return rosette;
  }

  float fernLeafletDistance(vec3 point, vec3 tip, float angle, float growth) {
    vec3 local = point;
    local.xz = rotate2(-angle) * local.xz;
    vec3 localTip = tip;
    localTip.xz = rotate2(-angle) * localTip.xz;
    float leaflets = 1000.0;
    for (int i = 0; i < 7; i++) {
      float along = 0.18 + float(i) * 0.105;
      vec3 center = localTip * along + vec3(0.0, 0.06, 0.0);
      float reach = (0.085 + sin(along * 3.1415927) * 0.11) * growth;
      float leafletLength = mix(0.25, 0.1, along) * growth;
      vec3 rightLeaf = local - center - vec3(0.0, 0.0, reach + leafletLength * 0.38);
      vec3 leftLeaf = local - center + vec3(0.0, 0.0, reach + leafletLength * 0.38);
      rightLeaf.yz = rotate2(-0.18 + along * 0.12) * rightLeaf.yz;
      leftLeaf.yz = rotate2(0.18 - along * 0.12) * leftLeaf.yz;
      float rightBlade = ellipsoidDistance(rightLeaf, vec3(leafletLength * 0.29, leafletLength * 0.075, leafletLength));
      float leftBlade = ellipsoidDistance(leftLeaf, vec3(leafletLength * 0.29, leafletLength * 0.075, leafletLength));
      rightBlade += sin(rightLeaf.z * 48.0) * leafletLength * 0.012;
      leftBlade += sin(leftLeaf.z * 48.0) * leafletLength * 0.012;
      leaflets = min(leaflets, min(rightBlade, leftBlade));
    }
    vec3 terminal = local - localTip * 0.9;
    terminal.xy = rotate2(-0.3) * terminal.xy;
    leaflets = min(leaflets, ellipsoidDistance(terminal, vec3(0.19, 0.028, 0.065) * growth));
    vec3 curlA = localTip * 0.82;
    vec3 curlB = localTip * 0.94 + vec3(0.0, 0.08 * growth, 0.0);
    vec3 curlC = localTip * 0.9 + vec3(0.0, 0.15 * growth, 0.06 * growth);
    leaflets = min(leaflets, taperedSegmentDistance(local, curlA, curlB, 0.024 * growth, 0.016 * growth));
    leaflets = min(leaflets, taperedSegmentDistance(local, curlB, curlC, 0.016 * growth, 0.006 * growth));
    return leaflets;
  }

  float thistleFloretDistance(vec3 point, vec3 center, float radius, float phase) {
    float florets = ellipsoidDistance(point - center, vec3(radius * 0.54, radius * 0.42, radius * 0.54));
    for (int i = 0; i < 16; i++) {
      float fi = float(i);
      float angle = fi * 2.3999632 + phase;
      float ring = sqrt((fi + 0.5) / 16.0);
      vec3 base = center + vec3(cos(angle) * ring * radius * 0.62, radius * (0.12 - ring * 0.2), sin(angle) * ring * radius * 0.62);
      vec3 tip = base + normalize(base - center + vec3(0.0, 0.48, 0.0)) * radius * 0.46;
      florets = min(florets, taperedSegmentDistance(point, base, tip, radius * 0.12, radius * 0.035));
    }
    for (int i = 0; i < 8; i++) {
      float angle = float(i) * 0.7853982 + phase * 0.53;
      vec3 base = center + vec3(cos(angle) * radius * 0.48, -radius * 0.32, sin(angle) * radius * 0.48);
      vec3 tip = center + vec3(cos(angle) * radius * 1.02, -radius * 0.62, sin(angle) * radius * 1.02);
      florets = min(florets, taperedSegmentDistance(point, base, tip, radius * 0.085, radius * 0.012));
    }
    return florets;
  }

  float plantedSpecimenDistance(vec3 point, vec2 cell, vec2 center, vec2 specimenOffset, float species, float growth, out float material) {
    material = MATERIAL_MOONBELL;
    if (species < 0.5 || growth < 0.001) return 1000.0;

    center += specimenOffset;
    float cameraDistance = length(center - cameraPosition.xz);
    if (cameraDistance > 68.0 * uDetailScale) return 1000.0;
    float ground = terrainHeight(center);
    vec3 plant = vec3(point.x - center.x, point.y - ground, point.z - center.y);
    float form = mod(species - 1.0, 3.0);
    float phenotype = hash21(vec2(species * 17.3, species * 43.1));
    float secondaryTrait = hash21(vec2(species * 31.7, species * 11.9));
    float stature = mix(0.84, 1.16, phenotype);
    float breadth = mix(0.82, 1.2, secondaryTrait);
    float height = mix(0.09, (form < 0.5 ? 3.2 : form < 1.5 ? 2.25 : 2.8) * stature, smoothstep(0.0, 0.82, growth));
    float widthGrowth = smoothstep(0.08, 0.68, growth);
    float detail = 1.0 - smoothstep(18.0 * uDetailScale, 48.0 * uDetailScale, cameraDistance);
    float closeDetail = smoothstep(0.24, 0.76, growth) * (1.0 - smoothstep(9.0 * uDetailScale, 22.0 * uDetailScale, cameraDistance));
    float stem = taperedSegmentDistance(plant, vec3(0.0, -0.03, 0.0), vec3(0.0, height, 0.0), mix(0.025, 0.12, growth), 0.025);
    float stemPart = stem;
    float foliagePart = 1000.0;
    float bloomPart = 1000.0;
    float coarse = min(stem, ellipsoidDistance(plant - vec3(0.0, height * 0.78, 0.0), vec3(mix(0.03, 0.48, widthGrowth), mix(0.04, 0.62, widthGrowth), mix(0.03, 0.48, widthGrowth))));
    if (detail < 0.002) {
      material = form < 0.5 ? MATERIAL_MOONBELL : form < 1.5 ? MATERIAL_RIBBON_FERN : MATERIAL_EMBER_THISTLE;
      return coarse;
    }

    float rosette = seedlingRosetteDistance(plant, growth, hash21(cell + species * 5.7) * 6.2831853);
    foliagePart = rosette;
    float shape = min(stem, rosette);
    if (form < 0.5) {
      float spread = 0.72 * breadth * widthGrowth;
      float branchA = taperedSegmentDistance(plant, vec3(0.0, height * 0.46, 0.0), vec3(spread, height * 0.82, 0.18), 0.055, 0.018);
      float branchB = taperedSegmentDistance(plant, vec3(0.0, height * 0.58, 0.0), vec3(-spread * 0.82, height * 0.91, -0.24), 0.05, 0.016);
      stemPart = min(stemPart, min(branchA, branchB));
      shape = min(shape, min(branchA, branchB));
      float bellA = ellipsoidDistance(plant - vec3(spread, height * 0.76, 0.18), vec3(0.34, 0.44, 0.34) * widthGrowth);
      float bellB = ellipsoidDistance(plant - vec3(-spread * 0.82, height * 0.85, -0.24), vec3(0.3, 0.4, 0.3) * widthGrowth);
      float crown = ellipsoidDistance(plant - vec3(0.0, height, 0.0), vec3(0.4, 0.32, 0.4) * widthGrowth);
      float simpleBlooms = min(bellA, min(bellB, crown));
      if (closeDetail > 0.002) {
        float bellScale = mix(0.82, 1.16, secondaryTrait);
        float detailedBlooms = moonbellBloomDistance(plant, vec3(spread, height * 0.76, 0.18), 0.44 * bellScale * widthGrowth, hash21(cell + 4.2 + species) * 6.2831853);
        detailedBlooms = min(detailedBlooms, moonbellBloomDistance(plant, vec3(-spread * 0.82, height * 0.85, -0.24), 0.4 * bellScale * widthGrowth, hash21(cell + 8.7 + species) * 6.2831853));
        detailedBlooms = min(detailedBlooms, moonbellBloomDistance(plant, vec3(0.0, height, 0.0), 0.42 * bellScale * widthGrowth, hash21(cell + 13.1 + species) * 6.2831853));
        float budGrowth = smoothstep(0.36, 0.72, growth);
        if (budGrowth > 0.002) {
          vec3 budCenter = vec3(spread * 0.46, height * 0.93, -spread * 0.34);
          detailedBlooms = min(detailedBlooms, moonbellBudDistance(plant, budCenter, 0.2 * bellScale * budGrowth, hash21(cell + species * 2.4) * 6.2831853));
        }
        float leafStems = 1000.0;
        float leafBlades = 1000.0;
        for (int i = 0; i < 5; i++) {
          float angle = float(i) * 2.3999632 + hash21(cell + 22.4) * 6.2831853;
          vec3 leafTip = vec3(cos(angle) * spread * 0.76, height * (0.22 + float(i) * 0.075), sin(angle) * spread * 0.76);
          leafStems = min(leafStems, taperedSegmentDistance(plant, vec3(0.0, leafTip.y * 0.72, 0.0), leafTip, 0.042, 0.009));
          leafBlades = min(leafBlades, cultivatedLeafDistance(plant, leafTip * 0.82, angle, 0.25 * widthGrowth, -0.22));
        }
        stemPart = min(stemPart, leafStems);
        foliagePart = min(foliagePart, leafBlades);
        bloomPart = mix(simpleBlooms, detailedBlooms, closeDetail);
        shape = min(stemPart, min(foliagePart, bloomPart));
      } else {
        bloomPart = simpleBlooms;
        shape = min(shape, simpleBlooms);
      }
      material = MATERIAL_MOONBELL;
    } else if (form < 1.5) {
      for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float angle = fi * 1.256637 + hash21(cell + fi * 9.1 + species) * 0.5 + phenotype * 0.7;
        vec3 tip = vec3(cos(angle), 0.3 + mix(0.08, 0.16, phenotype) * sin(fi), sin(angle)) * vec3(1.15 * breadth * widthGrowth, height, 1.15 * breadth * widthGrowth);
        float frond = taperedSegmentDistance(plant, vec3(0.0, 0.05, 0.0), tip, 0.075, 0.018);
        vec3 middle = tip * 0.68 + vec3(0.0, 0.15, 0.0);
        float simpleBlade = ellipsoidDistance(plant - middle, vec3(0.36, 0.11, 0.15) * mix(0.35, 1.0, widthGrowth));
        float detailedBlade = closeDetail > 0.002 ? fernLeafletDistance(plant, tip, angle, widthGrowth) : simpleBlade;
        float blade = mix(simpleBlade, detailedBlade, closeDetail);
        stemPart = min(stemPart, frond);
        foliagePart = min(foliagePart, blade);
        frond = min(frond, blade);
        shape = min(shape, frond);
      }
      material = MATERIAL_RIBBON_FERN;
    } else {
      float crownRadius = mix(0.04, mix(0.48, 0.7, secondaryTrait), widthGrowth);
      float simpleCrown = raggedCrown(plant - vec3(0.0, height, 0.0), vec3(crownRadius, crownRadius * 0.92, crownRadius), hash21(cell + 71.4) * 13.0);
      float detailedCrown = closeDetail > 0.002
        ? thistleFloretDistance(plant, vec3(0.0, height, 0.0), crownRadius, hash21(cell + 84.6) * 6.2831853)
        : simpleCrown;
      bloomPart = mix(simpleCrown, detailedCrown, closeDetail);
      shape = min(shape, bloomPart);
      if (closeDetail > 0.002) {
        float satelliteGrowth = smoothstep(0.62, 0.94, growth);
        if (satelliteGrowth > 0.002) {
          for (int i = 0; i < 3; i++) {
            float angle = float(i) * 2.0943951 + phenotype * 2.3;
            vec3 base = vec3(0.0, height * (0.52 + float(i) * 0.08), 0.0);
            vec3 tip = vec3(cos(angle) * 0.52 * breadth * satelliteGrowth, height * (0.78 + float(i) * 0.045), sin(angle) * 0.52 * breadth * satelliteGrowth);
            float sideStem = taperedSegmentDistance(plant, base, tip, 0.038 * satelliteGrowth, 0.01 * satelliteGrowth);
            float sideBloom = thistleFloretDistance(plant, tip, crownRadius * 0.32 * satelliteGrowth, angle);
            stemPart = min(stemPart, sideStem);
            bloomPart = min(bloomPart, sideBloom);
          }
        }
        shape = min(shape, min(stemPart, bloomPart));
      }
      for (int i = 0; i < 4; i++) {
        float angle = float(i) * 1.5707963 + 0.2 + phenotype * 0.48;
        vec3 tip = vec3(cos(angle) * 0.82 * breadth * widthGrowth, height * mix(0.62, 0.78, secondaryTrait), sin(angle) * 0.82 * breadth * widthGrowth);
        float branch = taperedSegmentDistance(plant, vec3(0.0, height * 0.32, 0.0), tip, 0.06, 0.012);
        stemPart = min(stemPart, branch);
        shape = min(shape, branch);
      }
      if (closeDetail > 0.002) {
        float leafStems = 1000.0;
        float leafBlades = 1000.0;
        for (int i = 0; i < 7; i++) {
          float angle = float(i) * 2.3999632 + hash21(cell + 91.3) * 6.2831853;
          float level = 0.3 + float(i) * 0.065;
          vec3 leafTip = vec3(cos(angle) * 0.88 * widthGrowth, height * level, sin(angle) * 0.88 * widthGrowth);
          leafStems = min(leafStems, taperedSegmentDistance(plant, vec3(0.0, height * level * 0.84, 0.0), leafTip, 0.045, 0.006));
          leafBlades = min(leafBlades, cultivatedLeafDistance(plant, leafTip * 0.84, angle, 0.24 * widthGrowth, -0.34));
        }
        stemPart = min(stemPart, leafStems);
        foliagePart = min(foliagePart, leafBlades);
        shape = mix(shape, min(stemPart, min(foliagePart, bloomPart)), closeDetail);
      }
      material = MATERIAL_EMBER_THISTLE;
    }
    if (detail > 0.55) {
      if (stemPart <= min(foliagePart, bloomPart)) material = MATERIAL_CULTIVATED_STEM;
      else if (foliagePart <= bloomPart) material = MATERIAL_CULTIVATED_LEAF;
    }
    return morphPlantDistance(coarse, shape, detail);
  }

  float plantedDistance(vec3 point, out float material) {
    vec2 cell = floor((point.xz + STRUCTURE_CELL_HALF) / STRUCTURE_CELL);
    material = MATERIAL_MOONBELL;
    if (!cultivationCell(cell)) return 1000.0;
    vec4 ecology = ecologyDataForCell(cell);
    float primarySpecies = floor(ecology.r * 255.0 + 0.5);
    float secondarySpecies = floor(ecology.b * 255.0 + 0.5);
    if (max(primarySpecies, secondarySpecies) < 0.5) return 1000.0;
    vec2 center = plantingCenterForCell(cell);
    float angle = hash21(cell + 407.3) * 6.2831853;
    vec2 pairOffset = vec2(cos(angle), sin(angle)) * 0.42;
    bool paired = secondarySpecies > 0.5;
    float primaryMaterial;
    float primary = plantedSpecimenDistance(point, cell, center, paired ? -pairOffset : vec2(0.0), primarySpecies, ecology.g, primaryMaterial);
    float secondaryMaterial;
    float secondary = plantedSpecimenDistance(point, cell, center, pairOffset, secondarySpecies, ecology.a, secondaryMaterial);
    material = secondary < primary ? secondaryMaterial : primaryMaterial;
    return min(primary, secondary);
  }
`
