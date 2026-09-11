export const grassGeometryGlsl = `
  float surrealFlowerDistance(vec3 p, float species, float growth, float variation, out float material) {
    float sizeRoll = fract(variation * 7.13 + 0.31);
    float heightRoll = fract(variation * 11.71 + 0.47);
    float scale = mix(0.46, 0.64, sizeRoll);
    p /= scale;
    float height = mix(0.95, 1.85, heightRoll) * (species > 2.5 ? 1.35 : 1.0);
    float stemGrowth = smoothstep(0.0, 0.7, growth);
    vec2 lean = (vec2(fract(variation * 17.3), fract(variation * 23.7 + 0.2)) - 0.5) * 0.28;
    vec3 tip = vec3(lean.x * stemGrowth, height * stemGrowth, lean.y * stemGrowth);
    float thickness = mix(0.68, 1.0, heightRoll);
    float stemBase = (species > 2.5 ? 0.075 : 0.062) * thickness;
    float stemTip = (species > 2.5 ? 0.052 : 0.042) * thickness;
    float stem = windingTaperedDistance(p, vec3(0.0), tip, vec3(lean.x * 0.55 + 0.05, 0.0, lean.y * 0.45 - 0.04) * stemGrowth, vec3(0.0), stemBase, stemTip);
    float calyx = ellipsoidDistance(p - tip + vec3(0.0, 0.045, 0.0), vec3(0.105, 0.075, 0.105));
    float support = min(stem, calyx);
    float opening = smoothstep(0.18, 0.98, growth);
    vec3 q = p - tip;
    float tiltX = (fract(variation * 19.31 + 0.17) - 0.5) * 0.52 + (species > 2.5 ? 0.66 : 0.0);
    float tiltZ = (fract(variation * 29.17 + 0.63) - 0.5) * 0.46;
    q.yz = rotate2(tiltX) * q.yz;
    q.xy = rotate2(tiltZ) * q.xy;
    float radius = mix(0.10, 0.64, opening) * mix(0.78, 1.08, sizeRoll);
    float bloom = 1000.0;
    float lastLayer = sizeRoll < 0.16 ? 0.0 : sizeRoll < 0.45 ? 1.0 : 2.0;
    for (int layer = 0; layer < 3; layer++) {
      float ring = float(layer);
      if (ring > lastLayer) continue;
      float petals = species < 0.5 ? 11.0 + ring * 3.0
        : species < 1.5 ? 5.0
        : species < 2.5 ? 5.0 + ring * 2.0 : 17.0;
      petals = max(4.0, floor(petals * mix(0.68, 1.0, sizeRoll) + 0.5));
      vec3 petal = q;
      float angle = atan(petal.z, petal.x);
      float sector = 6.2831853 / petals;
      float folded = mod(angle + sector * 0.5 + ring * (species < 1.5 ? 0.36 : 0.24), sector) - sector * 0.5;
      petal.xz = vec2(cos(folded), sin(folded)) * length(petal.xz);
      float reach = radius * (species < 0.5 ? 0.34 + ring * 0.17
        : species < 1.5 ? 0.48 + ring * 0.13
        : species < 2.5 ? 0.3 + ring * 0.16 : 0.58 + ring * 0.16);
      petal.x -= reach;
      float layerHeight = species < 0.5 ? 0.17 - ring * 0.115
        : species < 1.5 ? 0.15 - ring * 0.12
        : species < 2.5 ? 0.19 - ring * 0.135 : 0.065 - ring * 0.055;
      float layerProgress = ring * 0.5;
      float petalTilt = mix(
        species < 0.5 ? -0.52 : species < 1.5 ? -0.7 : species < 2.5 ? -0.82 : -0.24,
        species < 0.5 ? 0.38 : species < 1.5 ? 0.52 : species < 2.5 ? 0.64 : 0.16,
        layerProgress
      );
      float petalCup = mix(-0.46, species > 2.5 ? 0.18 : 0.56, layerProgress);
      petal.y -= layerHeight * opening;
      petal.y += petal.x * petalTilt + petal.x * abs(petal.x) * petalCup / max(radius, 0.08);
      float lengthProgress = 0.7 + ring * 0.19;
      vec3 petalSize = vec3(
        radius * (species < 0.5 ? 0.3 : species < 1.5 ? 0.48 : species < 2.5 ? 0.36 : 0.48) * lengthProgress,
        radius * (species < 0.5 ? 0.075 : species < 1.5 ? 0.11 : species < 2.5 ? 0.085 : 0.055),
        radius * (species < 0.5 ? 0.09 : species < 1.5 ? 0.26 : species < 2.5 ? 0.17 : 0.08)
      );
      bloom = min(bloom, ellipsoidDistance(petal, max(petalSize, vec3(0.008))));
    }
    float petalsDistance = bloom;
    float coreRadius = species < 0.5 ? 0.19 : species < 1.5 ? 0.22 : species < 2.5 ? 0.21 : 0.34;
    float coreLift = species > 2.5 ? 0.025 : 0.1;
    float core = ellipsoidDistance(q - vec3(0.0, coreLift * opening, 0.0), vec3(radius * coreRadius, radius * 0.16, radius * coreRadius));
    bloom = min(bloom, core);
    float bud = ellipsoidDistance(q, vec3(0.11, 0.18, 0.11));
    bloom = mix(bud, bloom, opening);
    material = bloom < support ? MATERIAL_DAHLIA + species * (MATERIAL_RHODODENDRON - MATERIAL_DAHLIA) : MATERIAL_GRASS;
    if (opening > 0.35 && core < petalsDistance && bloom < support) material = MATERIAL_FLOWER_DISK;
    return min(support, bloom) * scale;
  }

`
