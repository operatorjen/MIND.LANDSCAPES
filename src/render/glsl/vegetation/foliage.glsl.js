export const foliageGeometryGlsl = `  float leafSphereDistance(vec3 point, vec3 center, float radius) {
    return length(point - center) - radius;
  }

  float grapeLeafClusterDistance(
    vec3 point,
    vec3 center,
    vec3 scale,
    float rotation,
    float detail
  ) {
    vec3 local = point - center;
    local.xz = rotate2(rotation) * local.xz;
    float cluster = ellipsoidDistance(local, scale * vec3(0.94, 0.92, 0.94));
    float sphereDetail = smoothstep(0.34, 0.82, detail);
    if (sphereDetail > 0.002) {
      float spread = smoothstep(0.0, 1.0, sphereDetail);
      float radius = (min(scale.x, scale.z) * 0.24 + scale.y * 0.07) * mix(1.16, 1.0, spread);
      float vertical = max(scale.y, radius * 1.4);
      vec3 first = vec3(-scale.x * 0.6, vertical * 0.02, scale.z * 0.16) * spread;
      vec3 second = vec3(-scale.x * 0.22, -vertical * 0.48, -scale.z * 0.48) * spread;
      vec3 third = vec3(scale.x * 0.16, vertical * 0.22, scale.z * 0.46) * spread;
      vec3 fourth = vec3(scale.x * 0.6, -vertical * 0.12, -scale.z * 0.12) * spread;
      vec3 fifth = vec3(0.0, vertical * 0.62, -scale.z * 0.04) * spread;
      float spheres = leafSphereDistance(local, first, radius * 0.78);
      spheres = min(spheres, leafSphereDistance(local, second, radius * 0.96));
      spheres = min(spheres, leafSphereDistance(local, third, radius * 1.12));
      spheres = min(spheres, leafSphereDistance(local, fourth, radius * 0.86));
      spheres = min(spheres, leafSphereDistance(local, fifth, radius * 0.66));
      cluster = mix(cluster, spheres, sphereDetail);
    }
    return cluster;
  }

  float treeFoliageDistance(
    vec3 point,
    vec2 cell,
    float species,
    float age,
    float random,
    float side,
    float height,
    vec2 lean,
    float leanAmount,
    vec2 solarBias,
    float solarLean,
    vec2 solarCross,
    float trunkCurve,
    float detail
  ) {
    float foliageGrowth = smoothstep(0.18, 0.78, detail);
    if (foliageGrowth < 0.002 || species >= 0.88) return 1000.0;
    float season = seasonalCycle();
    float leaffulness = smoothstep(0.08, 0.34, season) * (1.0 - smoothstep(0.88, 1.0, season));
    float leafScale = mix(0.38, 1.0, leaffulness) * foliageGrowth;
    float foliage = 1000.0;

    if (species < 0.24) {
      leafScale = mix(0.8, 1.0, leaffulness) * foliageGrowth;
      vec3 lower = trunkGrowthPoint(0.44, height, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve);
      vec3 middle = trunkGrowthPoint(0.61, height, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve);
      vec3 high = trunkGrowthPoint(0.77, height, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve);
      vec3 top = trunkGrowthPoint(0.91, height, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve);
      foliage = grapeLeafClusterDistance(point, lower, vec3(1.5, 0.38, 1.18) * age * leafScale, random * 8.0, detail);
      foliage = min(foliage, grapeLeafClusterDistance(point, middle, vec3(1.24, 0.4, 1.02) * age * leafScale, random * 12.0, detail));
      foliage = min(foliage, grapeLeafClusterDistance(point, high, vec3(0.94, 0.43, 0.8) * age * leafScale, random * 16.0, detail));
      return min(foliage, grapeLeafClusterDistance(point, top, vec3(0.58, 0.52, 0.54) * age * leafScale, random * 20.0, detail));
    }

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
    float primaryGrowth = smoothstep(0.0, 0.46, detail);
    branchOne = mix(trunkGrowthPoint(0.35, height, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve), branchOne, primaryGrowth);
    branchTwo = mix(trunkGrowthPoint(0.52, height, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve), branchTwo, primaryGrowth);
    branchThree = mix(trunkGrowthPoint(0.67, height, lean, leanAmount, solarBias, solarLean, solarCross, trunkCurve), branchThree, primaryGrowth);
    vec3 firstScale = species < 0.5 ? vec3(1.32, 0.5, 0.88) : vec3(1.28, 0.76, 1.08);
    vec3 secondScale = species < 0.5 ? vec3(1.06, 0.48, 0.82) : vec3(1.12, 0.7, 1.18);
    foliage = grapeLeafClusterDistance(point, branchOne, firstScale * age * leafScale, random * 9.0, detail);
    foliage = min(foliage, grapeLeafClusterDistance(point, branchTwo, secondScale * age * leafScale, random * 13.0, detail));
    foliage = min(foliage, grapeLeafClusterDistance(point, branchThree, vec3(0.92, 0.68, 0.9) * age * leafScale, random * 17.0, detail));

    float tipDetail = smoothstep(0.52, 0.96, detail) * smoothstep(0.72, 0.96, uDetailScale);
    if (tipDetail > 0.002) {
      float tipGrowth = smoothstep(0.0, 1.0, tipDetail);
      vec3 tipOneTarget = branchOne + vec3(side * 0.64, height * 0.08, 0.5) * age;
      vec3 tipTwoTarget = branchTwo + vec3(-side * 0.56, height * 0.1, -0.46) * age;
      vec3 tipThreeTarget = branchThree + vec3(side * 0.42, height * 0.075, 0.38) * age;
      vec3 tipOne = mix(branchOne, tipOneTarget, tipGrowth);
      vec3 tipTwo = mix(branchTwo, tipTwoTarget, tipGrowth);
      vec3 tipThree = mix(branchThree, tipThreeTarget, tipGrowth);
      tipOne.xz = containedGrowth(tipOne.xz + solarBias * 0.16 * age, 3.48);
      tipTwo.xz = containedGrowth(tipTwo.xz + solarBias * 0.2 * age, 3.48);
      tipThree.xz = containedGrowth(tipThree.xz + solarBias * 0.22 * age, 3.48);
      float tips = grapeLeafClusterDistance(point, tipOne, vec3(0.48, 0.34, 0.42) * age * leafScale * tipGrowth, random * 23.0, detail);
      tips = min(tips, grapeLeafClusterDistance(point, tipTwo, vec3(0.44, 0.32, 0.46) * age * leafScale * tipGrowth, random * 29.0, detail));
      tips = min(tips, grapeLeafClusterDistance(point, tipThree, vec3(0.42, 0.36, 0.4) * age * leafScale * tipGrowth, random * 35.0, detail));
      foliage = min(foliage, tips);
    }
    return foliage;
  }`
