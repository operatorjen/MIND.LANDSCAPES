export const indoorCourtyardGlsl = `
  float courtyardMaterialMatch(float material, float target) {
    return 1.0 - step(0.045, abs(material - target));
  }

  float courtyardPlasterHeight(vec3 position, vec3 weights) {
    return dot(vec3(texture2D(uConcreteHeightMap, position.zy * 0.85).r,
      texture2D(uConcreteHeightMap, position.xz * 0.85).r,
      texture2D(uConcreteHeightMap, position.xy * 0.85).r), weights);
  }

  vec2 courtyardPlasterGradient(vec2 position) {
    float base = texture2D(uConcreteHeightMap, position * 0.85).r;
    return vec2(texture2D(uConcreteHeightMap, (position + vec2(0.035, 0.0)) * 0.85).r - base,
      texture2D(uConcreteHeightMap, (position + vec2(0.0, 0.035)) * 0.85).r - base);
  }

  vec3 courtyardPlasterNormal(vec3 position, vec3 normal, float detail) {
    vec3 weights = pow(abs(normal), vec3(4.0));
    weights /= max(dot(weights, vec3(1.0)), 0.001);
    vec3 gradient = vec3(0.0);
    if (weights.x > 0.0) gradient.zy += courtyardPlasterGradient(position.zy) * weights.x;
    if (weights.y > 0.0) gradient.xz += courtyardPlasterGradient(position.xz) * weights.y;
    if (weights.z > 0.0) gradient.xy += courtyardPlasterGradient(position.xy) * weights.z;
    gradient /= 0.035;
    return normalize(normal - (gradient - normal * dot(normal, gradient)) * detail * 0.17);
  }

  vec3 courtyardStoneColor(vec3 position, vec3 normal) {
    vec2 wall = abs(normal.x) > abs(normal.z) ? position.zy : position.xy;
    float grain = noise21(wall * 1.05 + uSeed * 0.23);
    float trowel = fbm(wall * 0.42 + uSeed * 0.21);
    vec3 dustyShadow = vec3(0.52, 0.28, 0.22);
    vec3 sunFadedTerracotta = vec3(0.88, 0.54, 0.42);
    vec3 clay = mix(dustyShadow, sunFadedTerracotta, 0.34 + grain * 0.2 + trowel * 0.24);
    vec3 weights = pow(abs(normal), vec3(4.0));
    weights /= max(dot(weights, vec3(1.0)), 0.001);
    float plaster = courtyardPlasterHeight(position, weights);
    float fine = noise21(wall * 38.0);
    clay = mix(clay, vec3(0.93, 0.63, 0.51), smoothstep(0.68, 0.92, trowel) * 0.12);
    clay *= 0.82 + plaster * 0.3 + fine * 0.08;
    vec2 buildingCell = floor((position.xz + STRUCTURE_CELL_HALF) / STRUCTURE_CELL);
    float waterHeight = terrainFoundation(structureCenterForCell(buildingCell)) - 5.42;
    float aboveWater = position.y - waterHeight;
    float waterline = 1.0 - smoothstep(0.045, 0.14, abs(aboveWater - 0.045));
    float dampBase = 1.0 - smoothstep(0.05, 0.38, aboveWater);
    clay *= 1.0 - dampBase * 0.16;
    return mix(clay, vec3(0.25, 0.13, 0.105), waterline * 0.65);
  }

  vec3 courtyardRockNormal(vec3 position, vec3 normal, float detail) {
    vec3 textured = courtyardPlasterNormal(position * 0.58, normal, detail);
    return normalize(mix(normal, textured, 0.72));
  }

  vec3 courtyardRockColor(vec3 position, vec3 normal) {
    float coarse = fbm(position.xz * 0.43 + position.y * vec2(0.19, -0.16) + uSeed * 0.37);
    float grain = noise21(position.xz * 4.8 + position.y * vec2(1.7, -1.3) + uSeed * 0.73);
    float strata = 0.5 + 0.5 * sin(position.y * 13.5 + coarse * 5.2 + position.x * 0.34);
    vec3 darkStone = vec3(0.105, 0.095, 0.08);
    vec3 warmStone = vec3(0.34, 0.285, 0.235);
    vec3 rock = mix(darkStone, warmStone, 0.38 + coarse * 0.5 + strata * 0.12);
    rock *= mix(0.76, 1.08, grain);
    float skyFacing = 0.48 + max(normal.y, 0.0) * 0.52;
    vec2 buildingCell = floor((position.xz + STRUCTURE_CELL_HALF) / STRUCTURE_CELL);
    float waterHeight = terrainFoundation(structureCenterForCell(buildingCell)) - 5.42;
    float contactShade = smoothstep(-0.02, 0.48, position.y - waterHeight);
    float wetEdge = 1.0 - smoothstep(0.02, 0.22, abs(position.y - waterHeight));
    rock *= mix(0.54, 1.0, contactShade) * skyFacing;
    return mix(rock, vec3(0.055, 0.07, 0.06), wetEdge * 0.48);
  }

  vec3 courtyardDownlights(vec3 position, out float housing, out float emitter) {
    housing = 0.0;
    emitter = 0.0;
    vec3 point; vec2 halfSize;
    if (!courtyardCoordinates(position, point, halfSize)) return vec3(0.0);
    float fade = 1.0 - smoothstep(0.18, 0.48, daylightAmount());
    float pool = 0.0;
    for (int i = 0; i < 4; i++) {
      vec3 delta = point - courtyardLampPosition(halfSize, float(i));
      float body = boxDistance(delta, vec3(0.235, 0.155, 0.275));
      housing = max(housing, 1.0 - smoothstep(0.0, 0.025, body));
      emitter = max(emitter, (1.0 - smoothstep(0.015, 0.04, abs(delta.y + 0.14))) * (1.0 - step(0.19, abs(delta.x))) * (1.0 - step(0.23, abs(delta.z))) * fade);
      float below = -delta.y - 0.14;
      float radius = 0.18 + max(below, 0.0) * 0.62;
      float cone = 1.0 - smoothstep(radius * 0.5, radius, length(delta.xz));
      pool += cone * smoothstep(0.0, 0.14, below) / (1.0 + below * below * 0.23);
    }
    return vec3(1.0, 0.64, 0.30) * pool * fade * 2.8;
  }

  vec3 courtyardSoilColor(vec3 position) {
    float loam = fbm(position.xz * 0.72 + uSeed * 0.43);
    float moss = smoothstep(0.3, 0.78, fbm(position.xz * 0.31 - uSeed * 0.27));
    vec3 soil = mix(vec3(0.025, 0.045, 0.035), vec3(0.2, 0.12, 0.055), loam);
    return mix(soil, mix(vec3(0.035, 0.17, 0.045), vec3(0.18, 0.28, 0.09), 0.34), moss * 0.24);
  }

  vec3 courtyardFoliageColor(vec3 position, vec3 normal) {
    float flow = fbm(position.xz * 0.34 + vec2(position.y * 0.12, -position.y * 0.08) + uSeed * 0.51);
    float veins = 0.5 + 0.5 * sin((position.x + position.z) * 5.2 + position.y * 3.4 + flow * 5.0);
    vec3 deepLeaf = mix(vec3(0.018, 0.085, 0.025), uGroundColor * 0.18 + vec3(0.025, 0.12, 0.035), 0.24);
    vec3 freshLeaf = mix(vec3(0.11, 0.38, 0.07), uAccentColor * 0.18 + vec3(0.08, 0.28, 0.055), 0.16);
    vec3 leaf = mix(deepLeaf, freshLeaf, flow * 0.52 + veins * 0.16);
    float edgeLight = pow(1.0 - abs(dot(normal, normalize(vec3(0.2, 0.85, 0.35)))), 2.0);
    leaf = mix(leaf, vec3(0.78, 0.59, 0.38), smoothstep(0.79, 0.9, flow));
    return leaf + mix(vec3(0.18, 0.24, 0.12), uSkyColor * 0.24, 0.18) * edgeLight * 0.08;
  }
`
