export const sceneGlsl = `
  float forestMarchDistance(vec2 point, float forestDistance) {
    vec2 cellPoint = mod(point + TREE_CELL * 0.5, TREE_CELL) - TREE_CELL * 0.5;
    vec2 edgeDistance = TREE_CELL * 0.5 - abs(cellPoint);
    float nearestEdge = min(edgeDistance.x, edgeDistance.y);
    if (nearestEdge >= TREE_CELL / 3.0) return forestDistance;
    return min(forestDistance, nearestEdge + TREE_CELL_GUARD);
  }

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
    componentDistances = vec3(terrain, forestMarchDistance(point.xz, forest), architecture);

    if (architecture < terrain && architecture < forest) {
      material = architectureMaterial;
      return architecture;
    }

    if (forest < terrain) {
      material = forestMaterial;
      return forest;
    }

    material = MATERIAL_TERRAIN;
    return terrain;
  }

  float componentDistanceOnly(vec3 point, float material) {
    if (material < MATERIAL_TERRAIN_MAX) return point.y - terrainHeight(point.xz);
    if (material > MATERIAL_SUCCULENT_MAX && material < MATERIAL_GRASS_MAX) {
      float growthMaterial;
      return groundGrowthDistance(point, growthMaterial);
    }
    if (material < MATERIAL_GRASS_MAX) {
      float forestMaterial;
      return forestDistance(point, terrainHeight(point.xz), forestMaterial);
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
