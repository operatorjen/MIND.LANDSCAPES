export const coreGlsl = `
  mat2 rotate2(float angle) {
    float sine = sin(angle);
    float cosine = cos(angle);
    return mat2(cosine, -sine, sine, cosine);
  }

  float undergroundCenterOffset(
    float z,
    float chamberStart,
    float chamberEnd,
    float chamberHalfX,
    float variant,
    float structureStyle
  ) {
    float progress = clamp((chamberStart - z) / (chamberStart - chamberEnd), 0.0, 1.0);
    float envelope = smoothstep(0.0, 0.18, progress);
    float phase = variant * 6.2831853 + structureStyle * 1.17;
    float primary = sin(progress * 5.2 + phase) - sin(phase);
    float secondaryPhase = phase * 0.61;
    float secondary = sin(progress * 10.7 + secondaryPhase) - sin(secondaryPhase);
    return envelope * chamberHalfX * 0.32 * (primary * 0.68 + secondary * 0.24);
  }

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32 + uSeed * 0.001);
    return fract(point.x * point.y);
  }

  float noise21(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), local.x),
      mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + 1.0), local.x),
      local.y
    );
  }

  float fbm(vec2 point) {
    float value = 0.0;
    float weight = 0.5;
    mat2 rotation = mat2(0.82, -0.57, 0.57, 0.82);

    for (int octave = 0; octave < 5; octave++) {
      value += noise21(point) * weight;
      point = rotation * point * 2.03 + 17.4;
      weight *= 0.5;
    }

    return value;
  }

  float cloudFbm(vec2 point) {
    float value = 0.0;
    float weight = 0.5;
    mat2 rotation = mat2(0.82, -0.57, 0.57, 0.82);

    for (int octave = 0; octave < 5; octave++) {
      if (float(octave) >= uCloudDetail) break;
      value += noise21(point) * weight;
      point = rotation * point * 2.03 + 17.4;
      weight *= 0.5;
    }

    return value;
  }
`
