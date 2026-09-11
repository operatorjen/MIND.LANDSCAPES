export const flowersGlsl = `
  float petalDetailAmount(vec3 position) {
    return 1.0 - smoothstep(1.2, 4.5, length(position - cameraPosition));
  }

  float petalMicroRelief(vec3 p) {
    float curl = sin(p.y * 7.0 + p.z * 4.0) * 1.3;
    float veins = sin(p.x * 78.0 + p.z * 43.0 + curl);
    float branches = sin(p.x * 147.0 - p.y * 31.0 + curl * 2.0);
    float cells = noise21(vec2(p.x + p.z * 0.43, p.y - p.z * 0.71) * 110.0);
    return veins * 0.0007 + branches * 0.00022 + (cells - 0.5) * 0.0005;
  }

  vec3 petalMicroNormal(vec3 position, vec3 normal, float material) {
    if (material < MATERIAL_DAHLIA - 0.006 || material > MATERIAL_SUNFLOWER + 0.006) return normal;
    float detail = petalDetailAmount(position);
    if (detail < 0.002) return normal;
    float epsilon = 0.004;
    float height = petalMicroRelief(position);
    vec3 gradient = vec3(
      petalMicroRelief(position + vec3(epsilon, 0.0, 0.0)),
      petalMicroRelief(position + vec3(0.0, epsilon, 0.0)),
      petalMicroRelief(position + vec3(0.0, 0.0, epsilon))
    );
    gradient = (gradient - height) / epsilon;
    gradient -= normal * dot(gradient, normal);
    return normalize(normal - gradient * detail);
  }

  vec3 surrealFlowerColor(vec3 position, vec3 normal, float material) {
    float part = (material - MATERIAL_DAHLIA) / (MATERIAL_RHODODENDRON - MATERIAL_DAHLIA);
    if (material < MATERIAL_GRASS + 0.012) return mix(vec3(0.055, 0.18, 0.095), vec3(0.19, 0.38, 0.15), max(normal.y, 0.0));
    if (material > MATERIAL_GRASS + 0.15) {
      float seedTone = noise21(position.xz * 35.0 + position.y * 9.0);
      return mix(vec3(0.12, 0.035, 0.012), vec3(0.58, 0.24, 0.035), seedTone) * 0.92;
    }
    float identity = noise21(position.xz * 0.19 + uSeed * 0.29);
    vec3 dark = part < 0.5 ? vec3(0.42, 0.035, 0.15)
      : part < 1.5 ? vec3(0.31, 0.09, 0.43)
      : part < 2.5 ? vec3(0.48, 0.018, 0.035) : vec3(0.62, 0.25, 0.015);
    vec3 light = part < 0.5 ? vec3(1.0, 0.38, 0.62)
      : part < 1.5 ? vec3(0.86, 0.55, 0.96)
      : part < 2.5 ? vec3(1.0, 0.22, 0.28) : vec3(1.0, 0.78, 0.08);
    vec3 color = mix(dark, light, 0.46 + identity * 0.42);
    float petalFacing = 0.32 + max(normal.y, 0.0) * 0.68;
    vec3 base = mix(color * 0.62, color * 1.18, petalFacing);
    vec3 viewDirection = normalize(cameraPosition - position);
    float petalEdge = pow(1.0 - abs(dot(normal, viewDirection)), 3.0);
    base = mix(base, dark * 0.68, petalEdge * 0.3);
    float detail = petalDetailAmount(position);
    if (detail < 0.002) return base;
    float veins = abs(petalMicroRelief(position)) / 0.0014;
    float pigment = noise21(position.xz * 16.0 + position.y * 3.0);
    float tonalBreak = smoothstep(0.35, 0.72, pigment + normal.y * 0.18);
    vec3 textured = mix(base * 0.72, base * 1.16, tonalBreak);
    textured = mix(textured, light * 1.08, clamp(veins * 0.28, 0.0, 0.5));
    return mix(base, textured, detail);
  }

`
