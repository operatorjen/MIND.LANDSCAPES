export const atmosphereGlsl = `
  vec3 sunDirection() {
    float phase = timelessPhase();
    float daylight = daylightAmount();
    float angle = mix(-0.52, 0.88, daylight);
    return normalize(vec3(cos(phase) * cos(angle), sin(angle), sin(phase) * cos(angle)));
  }

  float goldenHour() {
    float daylight = daylightAmount();
    float distanceFromGold = (daylight - 0.42) * 4.35;
    float glow = exp(-distanceFromGold * distanceFromGold) * smoothstep(0.16, 0.28, daylight);
    return clamp(glow * (0.78 + uLightDrama * 0.48), 0.0, 1.24);
  }

  vec3 skyColor(vec3 direction) {
    float daylight = daylightAmount();
    float horizon = pow(1.0 - max(direction.y, 0.0), 3.0);
    float dusk = 1.0 - smoothstep(-0.15, 0.35, cos(timelessPhase()));
    float deepNight = 1.0 - smoothstep(0.15, 0.235, daylight);
    float earlyNight = smoothstep(0.16, 0.28, daylight) * (1.0 - smoothstep(0.39, 0.5, daylight)) * dusk;
    float starVisibility = (1.0 - smoothstep(0.28, 0.52, daylight)) * mix(0.46, 1.0, deepNight);
    float gold = goldenHour();
    float twilight = exp(-pow((daylight - 0.3) * 6.0, 2.0)) * smoothstep(0.15, 0.25, daylight);
    float dayAmount = smoothstep(0.18, 0.62, daylight);
    vec3 nightZenith = mix(uSkyColor * 0.05 + vec3(0.006, 0.008, 0.025), vec3(0.002, 0.004, 0.014), deepNight);
    vec3 dayZenith = uSkyColor * 1.25 + vec3(0.08, 0.12, 0.14);
    vec3 zenith = mix(nightZenith, dayZenith, dayAmount);
    zenith = mix(zenith, vec3(0.18, 0.045, 0.22) + uSkyColor * 0.14, twilight * 0.46);
    vec3 nightHorizon = mix(uSkyColor * 0.09 + vec3(0.018, 0.012, 0.04), vec3(0.008, 0.009, 0.022), deepNight);
    vec3 dayHorizon = uSkyColor + vec3(0.24, 0.22, 0.17);
    vec3 horizonColor = mix(nightHorizon, dayHorizon, dayAmount);
    horizonColor += vec3(0.2, 0.08, -0.04) * uWarmth * mix(0.08, 1.0, dayAmount);
    horizonColor += vec3(1.02, 0.3, 0.025) * gold + vec3(0.44, 0.035, 0.17) * twilight;
    vec3 color = mix(zenith, horizonColor, horizon);
    color += vec3(0.5, 0.11, 0.012) * gold * pow(horizon, 0.48);
    vec3 solarDirection = sunDirection();
    float sun = max(dot(direction, solarDirection), 0.0);
    color += pow(sun, 180.0) * vec3(4.0, 3.25, 2.4) * daylight * (1.0 + uLightDrama * 0.5);
    color += pow(sun, mix(18.0, 7.0, clamp(uLightDrama, 0.0, 1.0))) * vec3(0.62, 0.28, 0.08) * (0.4 + uWarmth * 0.2 + uLightDrama * 0.25 + gold * 0.45);

    float solarAngle = acos(clamp(sun, 0.0, 1.0));
    float solarRings = smoothstep(0.012, 0.0, abs(solarAngle - 0.075));
    solarRings += smoothstep(0.01, 0.0, abs(solarAngle - 0.12));
    color += solarRings * mix(uAccentColor, vec3(1.0, 0.58, 0.18), 0.6) * uPsychedelicIntensity * uRitualIntensity * 0.35;

    vec3 lunarDirection = normalize(-solarDirection + vec3(0.08, 0.04, 0.05));
    float moonFacing = max(dot(direction, lunarDirection), 0.0);
    color += pow(moonFacing, 1400.0) * vec3(0.09, 0.12, 0.18) * starVisibility;

    if (moonFacing > 0.996 && starVisibility > 0.001) {
      vec3 moonRight = normalize(cross(vec3(0.0, 1.0, 0.0), lunarDirection));
      vec3 moonUp = normalize(cross(lunarDirection, moonRight));
      vec2 moonPoint = vec2(dot(direction, moonRight), dot(direction, moonUp)) / 0.026;
      float moonRadius = length(moonPoint);
      float moonDisc = 1.0 - smoothstep(0.975, 1.015, moonRadius);
      float moonLimb = sqrt(max(1.0 - moonRadius * moonRadius, 0.0));
      float maria = 0.46 * (1.0 - smoothstep(0.18, 0.42, length(moonPoint - vec2(-0.22, 0.18))));
      maria += 0.3 * (1.0 - smoothstep(0.1, 0.27, length(moonPoint - vec2(0.34, -0.16))));
      maria += 0.2 * (1.0 - smoothstep(0.08, 0.2, length(moonPoint - vec2(0.18, 0.42))));
      float crater = exp(-pow((length(moonPoint - vec2(-0.48, -0.31)) - 0.11) * 48.0, 2.0));
      crater += exp(-pow((length(moonPoint - vec2(0.42, 0.3)) - 0.075) * 62.0, 2.0));
      crater += exp(-pow((length(moonPoint - vec2(0.08, -0.52)) - 0.06) * 72.0, 2.0));
      vec3 moonSurface = mix(vec3(0.86, 0.88, 0.84), vec3(0.47, 0.51, 0.5), clamp(maria, 0.0, 0.65));
      moonSurface *= 0.72 + moonLimb * 0.3 + crater * 0.09;
      color += moonSurface * moonDisc * starVisibility * (1.55 + deepNight * 0.32);
    }

    if (starVisibility > 0.001) {
      float azimuth = atan(direction.x, direction.z) / 6.2831853 + 0.5;
      vec3 galacticNormal = normalize(vec3(0.58, 0.68, 0.44));
      float galacticRipple = sin(direction.x * 3.2 + direction.z * 2.7 + uSeed * 0.07) * 0.035;
      float galacticDistance = abs(dot(direction, galacticNormal) - galacticRipple);
      float milkyWay = exp(-galacticDistance * galacticDistance * 92.0) * smoothstep(0.0, 0.15, direction.y) * starVisibility;
      float starCluster = fbm(direction.xz * 2.8 + direction.y * vec2(1.7, -2.1) + uSeed * 0.07);
      vec2 starPoint = vec2(azimuth, direction.y * 0.5 + 0.5) * vec2(420.0, 210.0);
      vec2 starCell = floor(starPoint);
      vec2 starOffset = vec2(hash21(starCell + 2.1), hash21(starCell + 9.7)) - 0.5;
      vec2 starLocal = fract(starPoint) - 0.5 - starOffset * 0.72;
      float starSeed = hash21(starCell + uSeed * 0.13);
      float starSize = mix(0.035, 0.1, hash21(starCell + 8.2));
      float starThreshold = mix(0.986, 0.957, clamp(milkyWay * (0.58 + starCluster * 0.42), 0.0, 1.0)) - deepNight * 0.013;
      float stars = smoothstep(starSize, 0.0, length(starLocal)) * step(starThreshold, starSeed);
      stars *= smoothstep(0.0, 0.16, direction.y) * starVisibility * (0.86 + 0.14 * sin(uTime * 0.45 * uMotionScale + starSeed * 18.0));
      vec3 starColor = mix(vec3(0.68, 0.78, 1.0), vec3(1.0, 0.76, 0.5), starSeed);
      color += stars * starColor * (0.65 + deepNight * 0.72 + uPsychedelicIntensity * 0.4);
      color += milkyWay * (0.018 + starCluster * (0.065 + deepNight * 0.038)) * mix(vec3(0.2, 0.24, 0.42), vec3(0.42, 0.28, 0.34), starCluster);

      vec2 brightPoint = vec2(azimuth, direction.y * 0.5 + 0.5) * vec2(150.0, 75.0);
      vec2 brightCell = floor(brightPoint);
      vec2 brightOffset = vec2(hash21(brightCell + 19.4), hash21(brightCell + 27.2)) - 0.5;
      vec2 brightLocal = fract(brightPoint) - 0.5 - brightOffset * 0.68;
      float brightSeed = hash21(brightCell + uSeed * 0.29);
      float brightStars = smoothstep(0.095, 0.0, length(brightLocal)) * step(mix(0.994, 0.98 - deepNight * 0.006, milkyWay), brightSeed) * starVisibility;
      color += brightStars * mix(vec3(0.55, 0.7, 1.0), vec3(1.0, 0.74, 0.4), brightSeed) * (1.35 + deepNight * 0.55);

      float veilPath = 0.32 + sin(atan(direction.x, direction.z) * 2.0 + timelessPhase() * 0.3) * 0.09;
      float celestialVeil = exp(-abs(direction.y - veilPath) * 12.0) * starVisibility;
      vec3 veilSpectrum = mix(uSkyColor.gbr, uAccentColor.brg, 0.5 + 0.5 * sin(direction.x * 9.0 + timelessPhase()));
      color += veilSpectrum * celestialVeil * uPsychedelicIntensity * 0.16;
    }

    float ceremony = 0.5 + 0.5 * sin(atan(direction.x, direction.z) * 5.0 + direction.y * 12.0 + uSeed);
    vec3 spectral = mix(uAccentColor, uSkyColor.brg, ceremony);
    color = mix(color, color + spectral * 0.3, clamp(uPsychedelicIntensity * ceremony * 0.13, 0.0, 0.28));
    if (earlyNight > 0.001) {
      float auroraAltitude = smoothstep(0.035, 0.18, direction.y) * (1.0 - smoothstep(0.48, 0.82, direction.y));
      float northernSky = smoothstep(-0.45, 0.55, -direction.z);
      vec2 auroraPoint = direction.xz * 2.7 + direction.y * vec2(1.4, -2.1);
      auroraPoint += vec2(uTime * 0.012, -uTime * 0.008) * uMotionScale + uSeed * 0.09;
      float auroraFlow = fbm(auroraPoint);
      float auroraFold = 0.5 + 0.5 * sin(direction.x * 15.0 + direction.z * 5.0 + auroraFlow * 5.2 + uTime * 0.11 * uMotionScale);
      float auroraCurtain = mix(0.16 + pow(auroraFold, 6.0) * 0.22, 1.0, smoothstep(0.34, 0.65, auroraFlow + pow(auroraFold, 3.0) * 0.48));
      float nightIndex = floor(uDayPhase / 6.2831853);
      float auroraActivity = 0.68 + hash21(vec2(nightIndex, uSeed * 0.017)) * 0.32;
      float auroraStrength = clamp(0.52 + uPsychedelicIntensity * 0.4 + uWeather * 0.1, 0.48, 1.0);
      float aurora = auroraCurtain * auroraAltitude * northernSky * earlyNight * auroraActivity * auroraStrength;
      vec3 auroraColor = mix(vec3(0.06, 1.0, 0.5), vec3(0.55, 0.16, 1.0), auroraFold * 0.62 + uPsychedelicIntensity * 0.12);
      color += auroraColor * aurora * 1.55;
    }

    if (direction.y > 0.025) {
      float cloudDistance = (70.0 - cameraPosition.y) / direction.y;
      vec2 cloudPoint = cameraPosition.xz + direction.xz * cloudDistance;
      cloudPoint += vec2(uTime * uWind * uMotionScale * 1.05, uTime * uWind * uMotionScale * 0.2);
      float clouds = cloudFbm(cloudPoint * 0.012 + uSeed * 0.2) + (uClouds - 0.3) * 0.2;
      float cloudMask = smoothstep(0.54, 0.76, clouds) * smoothstep(0.02, 0.25, direction.y);
      float storm = smoothstep(0.38, 1.1, uWeather) * smoothstep(0.5, 0.82, clouds);
      vec3 daylightCloud = mix(vec3(0.34, 0.36, 0.39), vec3(0.96, 0.91, 0.82), dayAmount * (1.0 - storm * 0.7));
      vec3 cloudColor = mix(vec3(0.025, 0.032, 0.055), daylightCloud, dayAmount);
      cloudColor = mix(cloudColor, uAccentColor * 0.3 + vec3(0.1, 0.12, 0.14), storm * uWeatherDetail);
      float sunward = pow(max(dot(direction, solarDirection), 0.0), 5.0);
      cloudColor += vec3(1.05, 0.34, 0.055) * gold * sunward;
      color = mix(color, cloudColor, cloudMask * mix(0.38, 0.78, clamp(uClouds, 0.0, 1.0)));
      color *= 1.0 - storm * 0.16 * uWeatherDetail;

      if (uCloudDetail > 2.5) {
        float highCloudDistance = (115.0 - cameraPosition.y) / direction.y;
        vec2 highCloudPoint = cameraPosition.xz + direction.xz * highCloudDistance;
        highCloudPoint += vec2(-uTime * uWind * uMotionScale * 0.48, uTime * uWind * uMotionScale * 0.14);
        float highClouds = cloudFbm(highCloudPoint * 0.007 + uSeed * 0.47);
        float highMask = smoothstep(0.61, 0.76, highClouds) * smoothstep(0.03, 0.34, direction.y);
        float veil = highMask * uWeatherDetail * clamp(uClouds * 0.48, 0.0, 0.55);
        vec3 veilColor = mix(vec3(0.035, 0.04, 0.065), mix(vec3(0.58, 0.62, 0.66), vec3(1.0, 0.58, 0.22), gold * 0.82), dayAmount);
        color = mix(color, veilColor, veil);
      }
    }

    return color;
  }

  vec3 aerialHazeColor(vec3 direction) {
    float daylight = daylightAmount();
    float dayAmount = smoothstep(0.1, 0.64, daylight);
    float gold = goldenHour();
    vec3 nightMist = vec3(0.055, 0.065, 0.09) + uSkyColor * 0.035;
    vec3 dayMist = vec3(0.94, 0.96, 0.93);
    vec3 haze = mix(nightMist, dayMist, dayAmount);
    haze = mix(haze, vec3(0.5, 0.52, 0.53), clamp(uWeather * 0.34, 0.0, 0.42));
    float sunScatter = pow(max(dot(direction, sunDirection()), 0.0), 6.0);
    haze += sunScatter * mix(vec3(0.2, 0.23, 0.28), vec3(0.95, 0.48, 0.16), gold) * (0.12 + daylight * 0.28);
    haze += vec3(0.2, 0.065, 0.015) * gold;
    return haze;
  }

  float aerialPerspective(float distanceFromCamera) {
    float fogStart = mix(82.0, 58.0, clamp(uMist, 0.0, 1.0));
    float fogTravel = max(distanceFromCamera - fogStart, 0.0);
    float depth = clamp(fogTravel / max(uViewDistance - fogStart, 1.0), 0.0, 1.0);
    float distanceOpticalDepth = fogTravel * mix(0.004, 0.011, uMist);
    float limitOpticalDepth = depth * depth * depth * (1.8 + uMist * 0.45);
    float opticalDepth = distanceOpticalDepth + limitOpticalDepth;
    return clamp(1.0 - exp(-opticalDepth), 0.0, 0.992);
  }
`
