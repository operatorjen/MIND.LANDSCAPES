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
    if (material > MATERIAL_GRASS + 0.15) return vec3(0.16, 0.065, 0.025) * (0.8 + noise21(position.xz * 35.0) * 0.4);
    vec3 color = part < 0.5 ? vec3(0.94, 0.25, 0.46)
      : part < 1.5 ? vec3(0.73, 0.37, 0.84)
      : part < 2.5 ? vec3(0.92, 0.12, 0.21) : vec3(1.0, 0.70, 0.075);
    vec3 base = color * (0.88 + max(normal.y, 0.0) * 0.12);
    float detail = petalDetailAmount(position);
    if (detail < 0.002) return base;
    float veins = petalMicroRelief(position) / 0.0014;
    float pigment = noise21(position.xz * 16.0 + position.y * 3.0);
    vec3 textured = base * (0.97 + veins * 0.08 + pigment * 0.06);
    return mix(base, textured, detail);
  }

`
