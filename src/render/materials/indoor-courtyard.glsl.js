export const indoorCourtyardGlsl = `
  float courtyardMaterialMatch(float material, float target) {
    return 1.0 - step(0.045, abs(material - target));
  }

  float courtyardPlasterHeight(vec3 position, vec3 weights) {
    return dot(vec3(texture2D(uConcreteHeightMap, position.zy * 0.85).r,
      texture2D(uConcreteHeightMap, position.xz * 0.85).r,
      texture2D(uConcreteHeightMap, position.xy * 0.85).r), weights);
  }

  vec3 courtyardPlasterNormal(vec3 position, vec3 normal, float detail) {
    vec3 weights = pow(abs(normal), vec3(4.0));
    weights /= max(dot(weights, vec3(1.0)), 0.001);
    vec3 gradient = vec3(0.0);
    if (weights.x > 0.0) {
      float base = texture2D(uConcreteHeightMap, position.zy * 0.85).r;
      gradient.z += (texture2D(uConcreteHeightMap, (position.zy + vec2(0.035, 0.0)) * 0.85).r - base) * weights.x;
      gradient.y += (texture2D(uConcreteHeightMap, (position.zy + vec2(0.0, 0.035)) * 0.85).r - base) * weights.x;
    }
    if (weights.y > 0.0) {
      float base = texture2D(uConcreteHeightMap, position.xz * 0.85).r;
      gradient.x += (texture2D(uConcreteHeightMap, (position.xz + vec2(0.035, 0.0)) * 0.85).r - base) * weights.y;
      gradient.z += (texture2D(uConcreteHeightMap, (position.xz + vec2(0.0, 0.035)) * 0.85).r - base) * weights.y;
    }
    if (weights.z > 0.0) {
      float base = texture2D(uConcreteHeightMap, position.xy * 0.85).r;
      gradient.x += (texture2D(uConcreteHeightMap, (position.xy + vec2(0.035, 0.0)) * 0.85).r - base) * weights.z;
      gradient.y += (texture2D(uConcreteHeightMap, (position.xy + vec2(0.0, 0.035)) * 0.85).r - base) * weights.z;
    }
    gradient /= 0.035;
    return normalize(normal - (gradient - normal * dot(normal, gradient)) * detail * 0.14);
  }

  vec3 courtyardStoneColor(vec3 position, vec3 normal) {
    vec2 wall = abs(normal.x) > abs(normal.z) ? position.zy : position.xy;
    float grain = noise21(wall * 1.35 + uSeed * 0.13);
    vec3 clay = mix(vec3(0.56, 0.47, 0.45), vec3(0.72, 0.63, 0.60), 0.28 + grain * 0.36);
    vec3 weights = pow(abs(normal), vec3(4.0));
    weights /= max(dot(weights, vec3(1.0)), 0.001);
    float plaster = courtyardPlasterHeight(position, weights);
    float fine = noise21(wall * 38.0);
    clay *= 0.70 + plaster * 0.52 + fine * 0.16;
    vec2 buildingCell = floor((position.xz + STRUCTURE_CELL_HALF) / STRUCTURE_CELL);
    float waterHeight = terrainFoundation(structureCenterForCell(buildingCell)) - 5.42;
    float aboveWater = position.y - waterHeight;
    float waterline = 1.0 - smoothstep(0.045, 0.14, abs(aboveWater - 0.045));
    float dampBase = 1.0 - smoothstep(0.05, 0.38, aboveWater);
    clay *= 1.0 - dampBase * 0.16;
    return mix(clay, vec3(0.24, 0.175, 0.165), waterline * 0.65);
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
    float moss = smoothstep(0.3, 0.58, fbm(position.xz * 0.31 - uSeed * 0.27));
    vec3 soil = mix(vec3(0.075, 0.045, 0.025), vec3(0.2, 0.12, 0.055), loam);
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
