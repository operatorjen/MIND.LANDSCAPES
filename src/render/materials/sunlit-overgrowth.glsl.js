export const sunlitOvergrowthDefaults = Object.freeze({
  textureScale: 0.11,
  mossCoverageStart: 0.06,
  mossCoverageEnd: 0.38,
  vineThreshold: 0.68,
  morphStart: 0.04,
  morphEnd: 0.9
})

const glslFloat = (value) => Number(value).toFixed(4)

export const sunlitOvergrowthGlsl = `
  const float OVERGROWTH_TEXTURE_SCALE = ${glslFloat(sunlitOvergrowthDefaults.textureScale)};
  const float OVERGROWTH_MOSS_START = ${glslFloat(sunlitOvergrowthDefaults.mossCoverageStart)};
  const float OVERGROWTH_MOSS_END = ${glslFloat(sunlitOvergrowthDefaults.mossCoverageEnd)};
  const float OVERGROWTH_VINE_THRESHOLD = ${glslFloat(sunlitOvergrowthDefaults.vineThreshold)};
  const float OVERGROWTH_MORPH_START = ${glslFloat(sunlitOvergrowthDefaults.morphStart)};
  const float OVERGROWTH_MORPH_END = ${glslFloat(sunlitOvergrowthDefaults.morphEnd)};

  struct SunlitOvergrowthSample {
    float moss;
    float vines;
    float exposure;
    float pattern;
  };

  vec2 sunlitOvergrowthCoordinates(vec3 position, vec3 surfaceNormal) {
    return abs(surfaceNormal.x) > abs(surfaceNormal.z)
      ? vec2(position.z, position.y)
      : vec2(position.x, position.y);
  }

  float stableSolarPathExposure(vec3 surfaceNormal) {
    vec3 facing = normalize(surfaceNormal);
    float verticalWall = smoothstep(0.28, 0.82, 1.0 - abs(facing.y));
    float solarArc = clamp(facing.z * 0.78 + abs(facing.x) * 0.26, 0.0, 1.0);
    return verticalWall * smoothstep(0.06, 0.68, solarArc);
  }

  SunlitOvergrowthSample sampleSunlitOvergrowth(
    vec3 position,
    vec3 surfaceNormal,
    float surfaceDetail,
    float weathering
  ) {
    SunlitOvergrowthSample result;
    result.moss = 0.0;
    result.vines = 0.0;
    result.exposure = 0.0;
    result.pattern = 0.0;
    float growth = smoothstep(OVERGROWTH_MORPH_START, OVERGROWTH_MORPH_END, surfaceDetail);
    if (growth < 0.002 || dryStructureInterior(position)) return result;

    float exposure = stableSolarPathExposure(surfaceNormal);
    if (exposure < 0.002) return result;
    vec2 uv = sunlitOvergrowthCoordinates(position, surfaceNormal) * OVERGROWTH_TEXTURE_SCALE;
    uv += vec2(uSeed * 0.013, uSeed * 0.021);
    float pattern = texture2D(uSunlitOvergrowthMap, uv).r;
    float colonization = mix(0.74, 1.08, weathering);
    float qualityDetail = smoothstep(0.62, 1.04, uDetailScale);
    float moss = smoothstep(OVERGROWTH_MOSS_START, OVERGROWTH_MOSS_END, pattern);
    float vines = smoothstep(OVERGROWTH_VINE_THRESHOLD, 0.94, pattern);
    result.moss = moss * exposure * growth * colonization;
    result.vines = vines * exposure * growth * colonization * mix(0.42, 1.0, qualityDetail);
    result.exposure = exposure;
    result.pattern = pattern;
    return result;
  }
`
