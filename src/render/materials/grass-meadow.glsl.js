export const grassMeadowDefaults = Object.freeze({
  cellSize: 1.7,
  cellJitter: 0.96,
  maximumHeight: 1.5,
  maximumReach: 1.45,
  lowQualityBlades: 2,
  mediumQualityBlades: 4,
  highQualityBlades: 5,
  mediumQualityThreshold: 0.74,
  highQualityThreshold: 0.96,
  nearDistance: 4,
  farDistance: 24
})

const glslFloat = (value) => Number(value).toFixed(4)

export const grassMeadowGlsl = `
  const float GRASS_CELL_SIZE = ${glslFloat(grassMeadowDefaults.cellSize)};
  const float GRASS_CELL_JITTER = ${glslFloat(grassMeadowDefaults.cellJitter)};

  struct MeadowGrassSample {
    float coverage;
    float fiber;
    float dryness;
    vec3 color;
  };

  float meadowGrassDryness(vec2 point, float season) {
    float climate = fbm(foldedPoint(point) * 0.026 + uSeed * 0.43);
    float summer = smoothstep(0.42, 0.82, season);
    return clamp(climate * 0.38 + summer * 0.16 + max(uWarmth, 0.0) * 0.1, 0.0, 1.0);
  }

  vec3 meadowGrassPalette(float dryness, float variation, float height) {
    vec3 deepOlive = vec3(0.105, 0.22, 0.065);
    vec3 fadedGreen = vec3(0.245, 0.34, 0.12);
    vec3 sageGreen = vec3(0.36, 0.405, 0.19);
    vec3 strawGreen = vec3(0.455, 0.41, 0.145);
    vec3 fadedYellow = vec3(0.64, 0.525, 0.2);
    vec3 green = variation < 0.42
      ? mix(deepOlive, fadedGreen, variation / 0.42)
      : mix(fadedGreen, sageGreen, (variation - 0.42) / 0.58);
    vec3 dry = mix(strawGreen, fadedYellow, smoothstep(0.48, 1.0, variation + height * 0.22));
    float dryAmount = smoothstep(0.34, 0.9, dryness + height * mix(0.06, 0.2, variation));
    vec3 color = mix(green, dry, dryAmount);
    return mix(color, uAccentColor * 0.34 + color * 0.78, 0.055);
  }

  MeadowGrassSample sampleMeadowGrass(
    vec3 position,
    float detail,
    float meadowBiome,
    float slope,
    float river,
    float duneBiome,
    float rockBiome,
    float season
  ) {
    float broadFlow = 0.5 + 0.5 * sin(position.x * 0.72 + sin(position.z * 0.11) * 2.35);
    float patchNoise = noise21(position.xz * 2.85 + uSeed);
    float fiber = broadFlow * patchNoise;
    if (detail > 0.002) {
      float direction = sin(position.x * 25.0 + position.z * 14.0 + broadFlow * 3.2);
      float strands = pow(0.5 + 0.5 * direction, 9.0);
      fiber = mix(fiber, max(fiber, strands), detail * 0.72);
    }
    float exclusions = (1.0 - smoothstep(0.05, 0.48, slope))
      * (1.0 - river)
      * (1.0 - duneBiome)
      * (1.0 - rockBiome);
    float clusterNoise = noise21(foldedPoint(position.xz) * 0.085 + uSeed * 0.53);
    float clusterField = smoothstep(0.44, 0.7, clusterNoise + meadowBiome * 0.13);
    float coverage = clamp(0.08 + uGrasses * 0.7, 0.0, 0.86) * meadowBiome * exclusions;
    coverage *= mix(0.16, 1.0, clusterField);
    coverage *= mix(0.12, 1.0, detail);
    float dryness = meadowGrassDryness(position.xz, season);
    float variation = noise21(position.xz * 0.31 + uSeed * 1.31);
    MeadowGrassSample grassResult;
    grassResult.coverage = coverage;
    grassResult.fiber = fiber;
    grassResult.dryness = dryness;
    grassResult.color = meadowGrassPalette(dryness, variation, 0.0);
    return grassResult;
  }

  vec3 meadowGrassBladeColor(vec3 position, float season) {
    vec2 cell = floor((position.xz + GRASS_CELL_SIZE * 0.5) / GRASS_CELL_SIZE);
    vec2 jitter = vec2(hash21(cell + 14.2), hash21(cell + 39.7)) - 0.5;
    vec2 center = cell * GRASS_CELL_SIZE + jitter * GRASS_CELL_JITTER;
    float ground = terrainHeight(center);
    float height = clamp((position.y - ground) / ${glslFloat(grassMeadowDefaults.maximumHeight)}, 0.0, 1.0);
    float dryness = meadowGrassDryness(center, season);
    float clumpVariation = hash21(cell + uSeed * 0.37 + 211.4);
    float bladeVariation = noise21(position.xz * 2.3 + uSeed * 1.71);
    float variation = mix(clumpVariation, bladeVariation, 0.46);
    return meadowGrassPalette(dryness, variation, height) * mix(0.72, 1.12, height);
  }
`
