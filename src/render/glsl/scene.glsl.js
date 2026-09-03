export const sceneGlsl = `
  float sampleScene(vec3 point, out float material, out vec3 componentDistances) {
    float terrainSurface = terrainHeight(point.xz);
    float terrain = point.y - terrainSurface;
    float forestMaterial;
    float forest = forestDistance(point, terrainSurface, forestMaterial);
    float growthMaterial;
    float growth = groundGrowthDistance(point, growthMaterial);
    if (growth < forest) {
      forest = growth;
      forestMaterial = growthMaterial;
    }
    float architectureMaterial;
    float architecture = architectureDistance(point, architectureMaterial);
    componentDistances = vec3(terrain, forest, architecture);

    if (architecture < terrain && architecture < forest) {
      material = architectureMaterial;
      return architecture;
    }

    if (forest < terrain) {
      material = forestMaterial;
      return forest;
    }

    material = 0.0;
    return terrain;
  }

  float componentDistanceOnly(vec3 point, float material) {
    if (material < 0.5) return point.y - terrainHeight(point.xz);
    if (material < 4.0) {
      float forestMaterial;
      float forest = forestDistance(point, terrainHeight(point.xz), forestMaterial);
      float growthMaterial;
      return min(forest, groundGrowthDistance(point, growthMaterial));
    }
    float architectureMaterial;
    return architectureDistance(point, architectureMaterial);
  }

  vec3 sceneNormal(vec3 point, float distanceFromCamera, float material) {
    float epsilon = 0.018 + distanceFromCamera * 0.00065;
    vec2 offset = vec2(1.0, -1.0);
    return normalize(
      offset.xyy * componentDistanceOnly(point + offset.xyy * epsilon, material) +
      offset.yyx * componentDistanceOnly(point + offset.yyx * epsilon, material) +
      offset.yxy * componentDistanceOnly(point + offset.yxy * epsilon, material) +
      offset.xxx * componentDistanceOnly(point + offset.xxx * epsilon, material)
    );
  }
`
