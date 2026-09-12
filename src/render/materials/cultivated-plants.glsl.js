export const cultivatedPlantsGlsl = `
  vec3 cultivatedPlantColor(vec3 position, vec3 normal, float material) {
    float light = 0.42 + max(normal.y, 0.0) * 0.58;
    float grain = noise21(position.xz * 12.0 + position.y * 4.0 + uSeed);
    if (material < MATERIAL_RIBBON_FERN - 0.003) {
      return mix(vec3(0.08, 0.24, 0.26), vec3(0.67, 0.86, 1.0), light * 0.78 + grain * 0.12);
    }
    if (material < MATERIAL_EMBER_THISTLE - 0.003) {
      return mix(vec3(0.045, 0.19, 0.12), vec3(0.34, 0.78, 0.48), light * 0.82 + grain * 0.1);
    }
    return mix(vec3(0.18, 0.035, 0.025), vec3(1.0, 0.34, 0.11), light * 0.76 + grain * 0.14);
  }
`
