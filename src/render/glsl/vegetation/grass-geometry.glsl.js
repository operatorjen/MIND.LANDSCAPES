export const grassGeometryGlsl = `
  float surrealFlowerDistance(vec3 p, float species, float growth, float variation, out float material) {
    float scale = mix(0.70, 0.80, variation);
    p /= scale;
    float height = mix(1.25, 2.15, variation) * (species > 2.5 ? 1.35 : 1.0);
    float stemGrowth = smoothstep(0.0, 0.7, growth);
    vec3 tip = vec3(0.12 * stemGrowth, height * stemGrowth, 0.06 * stemGrowth);
    float stem = windingTaperedDistance(p, vec3(0.0), tip, vec3(0.12, 0.0, -0.07) * stemGrowth, vec3(0.0), 0.043, 0.024);
    float opening = smoothstep(0.18, 0.98, growth);
    vec3 q = p - tip;
    // Sunflowers face outward; the other blooms form layered bowls.
    if (species > 2.5) q.yz = rotate2(0.85) * q.yz;
    float radius = mix(0.10, 0.64, opening);
    float bloom = ellipsoidDistance(q, vec3(radius * 0.42, mix(0.14, 0.22, opening), radius * 0.42));
    float petals = species < 0.5 ? 12.0 : species < 1.5 ? 5.0 : species < 2.5 ? 7.0 : 13.0;
    for (int layer = 0; layer < 3; layer++) {
      float ring = float(layer);
      vec3 petal = q;
      float angle = atan(petal.z, petal.x);
      float sector = 6.2831853 / petals;
      float folded = mod(angle + sector * 0.5 + ring * 0.27, sector) - sector * 0.5;
      petal.xz = vec2(cos(folded), sin(folded)) * length(petal.xz);
      float reach = radius * (0.54 + ring * 0.17);
      petal.x -= reach;
      petal.y -= (0.14 - ring * 0.075) * opening;
      petal.y += petal.x * (species > 2.5 ? 0.08 : 0.48);
      vec3 petalSize = vec3(radius * 0.43, mix(0.045, 0.095, step(1.5, species)), radius * (species < 0.5 ? 0.12 : 0.22));
      bloom = min(bloom, ellipsoidDistance(petal, max(petalSize, vec3(0.008))));
    }
    // A compact bud unfolds continuously into the full petal geometry.
    float bud = ellipsoidDistance(q, vec3(0.11, 0.18, 0.11));
    bloom = mix(bud, bloom, opening);
    material = bloom < stem ? MATERIAL_DAHLIA + species * (MATERIAL_RHODODENDRON - MATERIAL_DAHLIA) : MATERIAL_GRASS;
    if (species > 2.5 && length(q.xz) < radius * 0.36 && bloom < stem) material = MATERIAL_FLOWER_DISK;
    return min(stem, bloom) * scale;
  }

`
