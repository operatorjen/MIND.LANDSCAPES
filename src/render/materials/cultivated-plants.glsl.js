export const cultivatedPlantsGlsl = `
  vec3 cultivatedGradient(vec3 shadow, vec3 middle, vec3 highlight, float amount) {
    float value = clamp(amount, 0.0, 1.0);
    return value < 0.5 ? mix(shadow, middle, value * 2.0) : mix(middle, highlight, (value - 0.5) * 2.0);
  }

  vec3 cultivatedHsv(float hue, float saturation, float value) {
    vec3 rgb = clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return value * mix(vec3(1.0), rgb, saturation);
  }

  float cultivatedSpeciesHue(float species) {
    if (species < 1.5) return 0.56;
    if (species < 2.5) return 0.35;
    if (species < 3.5) return 0.02;
    if (species < 4.5) return 0.71;
    if (species < 5.5) return 0.95;
    if (species < 6.5) return 0.47;
    if (species < 7.5) return 0.55;
    if (species < 8.5) return 0.08;
    if (species < 9.5) return 0.1;
    if (species < 10.5) return 0.54;
    if (species < 11.5) return 0.76;
    if (species < 12.5) return 0.43;
    return 0.95;
  }

  vec3 cultivatedSeedColor(float species) {
    if (species < 1.5) return vec3(0.725, 0.851, 1.0);
    if (species < 2.5) return vec3(0.439, 0.788, 0.627);
    if (species < 3.5) return vec3(1.0, 0.541, 0.357);
    if (species < 4.5) return vec3(0.784, 0.722, 1.0);
    if (species < 5.5) return vec3(1.0, 0.435, 0.569);
    if (species < 6.5) return vec3(0.451, 0.878, 0.82);
    if (species < 7.5) return vec3(0.851, 0.937, 1.0);
    if (species < 8.5) return vec3(0.827, 0.604, 0.384);
    if (species < 9.5) return vec3(1.0, 0.702, 0.278);
    if (species < 10.5) return vec3(0.447, 0.843, 1.0);
    if (species < 11.5) return vec3(0.78, 0.49, 1.0);
    if (species < 12.5) return vec3(0.557, 0.941, 0.78);
    return vec3(1.0, 0.439, 0.588);
  }

  vec3 cultivatedPlantColor(vec3 position, vec3 normal, float material) {
    vec2 cell = floor((position.xz + STRUCTURE_CELL_HALF) / STRUCTURE_CELL);
    vec4 ecology = ecologyDataForCell(cell);
    float primarySpecies = floor(ecology.r * 255.0 + 0.5);
    float secondarySpecies = floor(ecology.b * 255.0 + 0.5);
    vec2 center = plantingCenterForCell(cell);
    float pairAngle = hash21(cell + 407.3) * 6.2831853;
    vec2 pairOffset = vec2(cos(pairAngle), sin(pairAngle)) * 0.42;
    bool secondary = secondarySpecies > 0.5 && length(position.xz - center - pairOffset) < length(position.xz - center + pairOffset);
    float species = secondary ? secondarySpecies : primarySpecies;
    float growth = secondary ? ecology.a : ecology.g;
    center += secondary ? pairOffset : secondarySpecies > 0.5 ? -pairOffset : vec2(0.0);
    float ground = terrainHeight(center);
    vec3 local = vec3(position.x - center.x, position.y - ground, position.z - center.y);
    float form = mod(species - 1.0, 3.0);
    float phenotype = hash21(vec2(species * 17.3, species * 43.1));
    float maximumHeight = (form < 0.5 ? 3.2 : form < 1.5 ? 2.25 : 2.8) * mix(0.84, 1.16, phenotype);
    float heightTone = clamp(local.y / maximumHeight, 0.0, 1.0);
    float light = 0.35 + max(normal.y, 0.0) * 0.65;
    float grain = noise21(position.xz * 12.0 + position.y * 4.0 + uSeed);
    float tone = clamp(heightTone * 0.46 + light * 0.34 + grain * 0.2, 0.0, 1.0);
    float closeDetail = 1.0 - smoothstep(5.0, 18.0, length(position - cameraPosition));
    float facing = pow(1.0 - abs(dot(normal, normalize(cameraPosition - position))), 3.0);
    float azimuth = atan(local.z, local.x);
    float speciesPhase = species * 1.6180339 + phenotype * 4.7;
    float ageSaturation = mix(0.66, 1.0, smoothstep(0.12, 0.82, growth));
    bool stemPart = abs(material - MATERIAL_CULTIVATED_STEM) < 0.0005;
    bool leafPart = abs(material - MATERIAL_CULTIVATED_LEAF) < 0.0005;

    if (stemPart) {
      vec3 shadow = species < 1.5 ? vec3(0.025, 0.13, 0.17)
        : species < 2.5 ? vec3(0.035, 0.13, 0.055)
        : species < 3.5 ? vec3(0.1, 0.025, 0.065) : cultivatedHsv(cultivatedSpeciesHue(species), 0.68, 0.13);
      vec3 middle = species < 1.5 ? vec3(0.075, 0.29, 0.31)
        : species < 2.5 ? vec3(0.12, 0.3, 0.12)
        : species < 3.5 ? vec3(0.25, 0.065, 0.09) : cultivatedHsv(cultivatedSpeciesHue(species), 0.62, 0.32);
      vec3 highlight = species < 1.5 ? vec3(0.22, 0.48, 0.45)
        : species < 2.5 ? vec3(0.32, 0.49, 0.2)
        : species < 3.5 ? vec3(0.43, 0.15, 0.105) : cultivatedHsv(cultivatedSpeciesHue(species) + 0.035, 0.48, 0.5);
      float fiber = 0.5 + 0.5 * sin(local.y * 38.0 + atan(local.z, local.x) * 3.0);
      float nodes = pow(0.5 + 0.5 * cos(local.y * 19.0 + speciesPhase), 14.0);
      float freckles = smoothstep(0.77, 0.94, noise21(vec2(local.y * 21.0, azimuth * 3.0) + speciesPhase));
      vec3 color = cultivatedGradient(shadow, middle, highlight, tone * 0.82);
      color *= mix(0.82, 1.12, fiber * closeDetail);
      color = mix(color, highlight * 1.16, nodes * closeDetail * 0.22);
      return mix(color, shadow * 0.72, freckles * closeDetail * 0.18);
    }

    if (leafPart) {
      vec3 shadow = species < 1.5 ? vec3(0.035, 0.19, 0.22)
        : species < 2.5 ? vec3(0.025, 0.15, 0.065)
        : species < 3.5 ? vec3(0.13, 0.025, 0.07) : cultivatedHsv(cultivatedSpeciesHue(species) + 0.04, 0.72, 0.18);
      vec3 middle = species < 1.5 ? vec3(0.12, 0.39, 0.4)
        : species < 2.5 ? vec3(0.075, 0.4, 0.17)
        : species < 3.5 ? vec3(0.34, 0.065, 0.11) : cultivatedHsv(cultivatedSpeciesHue(species) + 0.04, 0.68, 0.46);
      vec3 highlight = species < 1.5 ? vec3(0.39, 0.67, 0.63)
        : species < 2.5 ? vec3(0.42, 0.76, 0.42)
        : species < 3.5 ? vec3(0.59, 0.19, 0.12) : cultivatedHsv(cultivatedSpeciesHue(species) + 0.075, 0.5, 0.78);
      float veins = pow(0.5 + 0.5 * sin(position.y * 36.0 + position.x * 27.0 - position.z * 23.0 + speciesPhase), 7.0);
      float pinstripe = pow(0.5 + 0.5 * cos(azimuth * (8.0 + mod(species, 5.0)) + local.y * 13.0), 10.0);
      float variegation = smoothstep(0.22, 0.82, fbm(position.xz * 1.8 + vec2(position.y * 0.37, speciesPhase)));
      vec3 color = cultivatedGradient(shadow, middle, highlight, tone);
      vec3 veinColor = species < 1.5 ? vec3(0.58, 0.75, 0.7)
        : species < 2.5 ? vec3(0.62, 0.3, 0.12)
        : species < 3.5 ? vec3(0.78, 0.31, 0.12) : cultivatedHsv(cultivatedSpeciesHue(species) + 0.48, 0.62, 0.9);
      color = mix(color, veinColor, veins * closeDetail * 0.34);
      color = mix(color, veinColor * 0.76 + highlight * 0.24, pinstripe * closeDetail * 0.12);
      color = mix(color, highlight, variegation * closeDetail * (species > 3.5 ? 0.16 : 0.08));
      color *= ageSaturation;
      return mix(color, highlight * 1.04, facing * closeDetail * 0.24);
    }

    if (species < 1.5) {
      vec3 color = cultivatedGradient(
        vec3(0.18, 0.26, 0.46),
        vec3(0.56, 0.69, 0.88),
        vec3(0.94, 0.97, 1.0),
        clamp(tone * 0.72 + facing * 0.2, 0.0, 1.0)
      );
      float pearl = pow(0.5 + 0.5 * sin(position.y * 47.0 + position.x * 29.0 - position.z * 31.0), 6.0);
      float throat = (1.0 - smoothstep(0.08, 0.72, length(local.xz))) * smoothstep(0.42, 0.78, heightTone);
      float petalRays = pow(0.5 + 0.5 * cos(azimuth * 9.0 + speciesPhase), 5.0);
      color = mix(color, vec3(0.82, 0.74, 0.96), pearl * closeDetail * 0.2);
      color = mix(color, vec3(0.48, 0.9, 0.88), throat * closeDetail * 0.24);
      return mix(color, vec3(1.0, 0.91, 0.74), petalRays * throat * closeDetail * 0.18);
    }
    if (species < 2.5) {
      vec3 color = cultivatedGradient(
        vec3(0.035, 0.17, 0.075),
        vec3(0.14, 0.49, 0.22),
        vec3(0.57, 0.82, 0.47),
        tone
      );
      float copperBands = pow(0.5 + 0.5 * cos(local.y * 31.0 + azimuth * 5.0), 9.0);
      color = mix(color, vec3(0.76, 0.31, 0.095), copperBands * closeDetail * 0.28);
      return mix(color, vec3(0.7, 0.94, 0.55), facing * closeDetail * 0.14);
    }
    if (species < 3.5) {
      vec3 color = cultivatedGradient(
      vec3(0.21, 0.018, 0.045),
      vec3(0.78, 0.11, 0.065),
      vec3(1.0, 0.6, 0.12),
      clamp(tone * 0.82 + facing * 0.22, 0.0, 1.0)
      );
      float filaments = pow(0.5 + 0.5 * sin(position.x * 58.0 - position.z * 47.0 + position.y * 21.0), 5.0);
      float emberCore = (1.0 - smoothstep(0.12, 0.75, length(local.xz))) * smoothstep(0.64, 0.92, heightTone);
      color = mix(color, vec3(1.0, 0.76, 0.2), filaments * closeDetail * 0.34);
      color += vec3(0.34, 0.055, 0.012) * emberCore * closeDetail;
      return mix(color, vec3(1.0, 0.9, 0.36), facing * emberCore * closeDetail * 0.32);
    }
    float hue = cultivatedSpeciesHue(species);
    vec3 hybrid = cultivatedGradient(
      cultivatedHsv(hue + 0.47, 0.76, 0.24),
      cultivatedHsv(hue + 0.5, 0.64, 0.7),
      cultivatedHsv(hue + 0.54, 0.38, 1.0),
      clamp(tone * 0.78 + facing * 0.24, 0.0, 1.0)
    );
    float accentRays = pow(0.5 + 0.5 * cos(azimuth * (7.0 + mod(species, 6.0)) + local.y * 8.0 + speciesPhase), 7.0);
    float stipple = smoothstep(0.8, 0.96, noise21(position.xz * 24.0 + position.y * 11.0 + speciesPhase));
    vec3 complement = cultivatedHsv(hue + 0.5, 0.46, 1.0);
    hybrid = mix(hybrid, cultivatedHsv(hue + 0.06, 0.42, 0.98), grain * closeDetail * 0.18);
    hybrid = mix(hybrid, complement, accentRays * closeDetail * 0.16);
    hybrid = mix(hybrid, vec3(1.0), stipple * closeDetail * 0.12);
    return hybrid * ageSaturation;
  }
`
