export const vegetationCommonGlsl = `  float timelessPhase() {
    return uDayPhase;
  }

  float daylightAmount() {
    return mix(0.5 + 0.5 * sin(timelessPhase()), uDaylight, 0.16);
  }

  float seasonalCycle() {
    return fract(uTime * 0.0036 * uMotionScale + uSeed * 0.017);
  }

  float taperedSegmentDistance(vec3 point, vec3 start, vec3 end, float startRadius, float endRadius) {
    vec3 segment = end - start;
    float position = clamp(dot(point - start, segment) / max(dot(segment, segment), 0.0001), 0.0, 1.0);
    return length(point - start - segment * position) - mix(startRadius, endRadius, position);
  }

  vec3 windingPoint(vec3 start, vec3 end, vec3 arch, vec3 curl, float position) {
    return mix(start, end, position)
      + arch * sin(position * 3.1415927)
      + curl * sin(position * 6.2831853);
  }

  float windingTaperedDistance(
    vec3 point,
    vec3 start,
    vec3 end,
    vec3 arch,
    vec3 curl,
    float startRadius,
    float endRadius
  ) {
    #if SHADER_QUALITY_LEVEL == 0
    vec3 middle = windingPoint(start, end, arch, curl, 0.5);
    float middleRadius = mix(startRadius, endRadius, 0.5);
    return min(taperedSegmentDistance(point, start, middle, startRadius, middleRadius),
      taperedSegmentDistance(point, middle, end, middleRadius, endRadius));
    #else
    vec3 first = windingPoint(start, end, arch, curl, 0.34);
    vec3 second = windingPoint(start, end, arch, curl, 0.68);
    float firstRadius = mix(startRadius, endRadius, 0.34);
    float secondRadius = mix(startRadius, endRadius, 0.68);
    float distance = taperedSegmentDistance(point, start, first, startRadius, firstRadius);
    distance = min(distance, taperedSegmentDistance(point, first, second, firstRadius, secondRadius));
    return min(distance, taperedSegmentDistance(point, second, end, secondRadius, endRadius));
    #endif
  }

  vec3 branchGrowthBend(
    vec2 cell,
    float salt,
    vec2 sunward,
    float horizontalScale,
    float verticalScale
  ) {
    vec2 crossSun = vec2(-sunward.y, sunward.x);
    float lateral = (hash21(cell + salt) - 0.5) * 2.0;
    float phototropism = mix(0.22, 0.52, hash21(cell + salt + 4.7));
    vec2 horizontal = (sunward * phototropism + crossSun * lateral) * horizontalScale * 1.45;
    return vec3(horizontal.x, verticalScale * 1.25, horizontal.y);
  }

  float twigGrowthDistance(
    vec3 point,
    vec3 start,
    vec3 end,
    vec2 cell,
    float salt,
    vec2 sunward,
    float radius
  ) {
    float reach = length(end - start);
    vec3 arch = branchGrowthBend(cell, salt, sunward, reach * 0.18, reach * 0.05);
    vec3 curl = branchGrowthBend(cell, salt + 5.3, sunward, reach * 0.08, -reach * 0.018);
    return windingTaperedDistance(point, start, end, arch, curl, radius, max(radius * 0.08, 0.0025));
  }

  vec2 containedGrowth(vec2 position, float maximumReach) {
    return position * min(1.0, maximumReach / max(length(position), 0.001));
  }

  vec2 trunkGrowthOffset(
    float position,
    vec2 lean,
    float leanAmount,
    vec2 sunward,
    float solarLean,
    vec2 crossSun,
    float trunkCurve
  ) {
    float wave = sin(position * 6.2831853);
    return lean * pow(position, 1.32) * leanAmount
      + sunward * pow(position, 1.58) * solarLean
      + crossSun * wave * trunkCurve;
  }

  vec3 trunkGrowthPoint(
    float position,
    float height,
    vec2 lean,
    float leanAmount,
    vec2 sunward,
    float solarLean,
    vec2 crossSun,
    float trunkCurve
  ) {
    vec2 offset = trunkGrowthOffset(position, lean, leanAmount, sunward, solarLean, crossSun, trunkCurve);
    return vec3(offset.x, height * position, offset.y);
  }

  float curvedTrunkDistance(
    vec3 point,
    float height,
    float topPosition,
    float baseRadius,
    float topRadius,
    vec2 lean,
    float leanAmount,
    vec2 sunward,
    float solarLean,
    vec2 crossSun,
    float trunkCurve
  ) {
    vec3 base = trunkGrowthPoint(0.0, height, lean, leanAmount, sunward, solarLean, crossSun, trunkCurve);
    vec3 lower = trunkGrowthPoint(topPosition * 0.28, height, lean, leanAmount, sunward, solarLean, crossSun, trunkCurve);
    vec3 middle = trunkGrowthPoint(topPosition * 0.54, height, lean, leanAmount, sunward, solarLean, crossSun, trunkCurve);
    vec3 upper = trunkGrowthPoint(topPosition * 0.78, height, lean, leanAmount, sunward, solarLean, crossSun, trunkCurve);
    vec3 tip = trunkGrowthPoint(topPosition, height, lean, leanAmount, sunward, solarLean, crossSun, trunkCurve);
    float lowerRadius = mix(baseRadius, topRadius, topPosition * 0.28);
    float middleRadius = mix(baseRadius, topRadius, topPosition * 0.54);
    float upperRadius = mix(baseRadius, topRadius, topPosition * 0.78);
    float tipRadius = mix(baseRadius, topRadius, topPosition);
    float distance = taperedSegmentDistance(point, base, lower, baseRadius, lowerRadius);
    distance = min(distance, taperedSegmentDistance(point, lower, middle, lowerRadius, middleRadius));
    distance = min(distance, taperedSegmentDistance(point, middle, upper, middleRadius, upperRadius));
    return min(distance, taperedSegmentDistance(point, upper, tip, upperRadius, tipRadius));
  }

  float rootPathDistance(
    vec3 point,
    float angle,
    float bend,
    float reach,
    float startHeight,
    float middleLift,
    float startRadius,
    float endRadius
  ) {
    vec3 start = vec3(0.0, startHeight, 0.0);
    float endAngle = angle + bend;
    vec3 end = vec3(cos(endAngle) * reach, 0.025, sin(endAngle) * reach);
    end.xz = containedGrowth(end.xz, 4.15);
    float curveAngle = angle + bend * 0.52;
    vec2 curveCross = vec2(-sin(curveAngle), cos(curveAngle));
    vec2 curveForward = vec2(cos(curveAngle), sin(curveAngle));
    float archLift = max(middleLift - mix(startHeight, end.y, 0.5), 0.0);
    vec3 arch = vec3(curveCross.x * bend * reach * 0.17, archLift, curveCross.y * bend * reach * 0.17);
    vec3 curl = vec3(curveForward.x * sin(bend * 2.0) * reach * 0.055, startHeight * 0.05, curveForward.y * sin(bend * 2.0) * reach * 0.055);
    return windingTaperedDistance(point, start, end, arch, curl, startRadius, endRadius);
  }

  float rootExtensionDistance(
    vec3 point,
    float angle,
    float bend,
    float reach,
    float lift,
    float startRadius,
    float endRadius
  ) {
    float startAngle = angle + bend * 0.58;
    float endAngle = angle + bend * 1.22;
    vec3 start = vec3(cos(startAngle) * reach * 0.54, lift, sin(startAngle) * reach * 0.54);
    vec3 end = vec3(cos(endAngle) * reach * 1.24, 0.022, sin(endAngle) * reach * 1.24);
    start.xz = containedGrowth(start.xz, 3.2);
    end.xz = containedGrowth(end.xz, 4.18);
    float curveAngle = angle + bend * 0.96;
    vec2 curveCross = vec2(-sin(curveAngle), cos(curveAngle));
    vec2 curveForward = vec2(cos(curveAngle), sin(curveAngle));
    vec3 arch = vec3(curveCross.x * bend * reach * 0.12, lift * 0.16, curveCross.y * bend * reach * 0.12);
    vec3 curl = vec3(curveForward.x * sin(bend * 2.4) * reach * 0.045, lift * 0.08, curveForward.y * sin(bend * 2.4) * reach * 0.045);
    return windingTaperedDistance(point, start, end, arch, curl, startRadius, endRadius);
  }

  float boxDistance(vec3 point, vec3 bounds) {
    vec3 offset = abs(point) - bounds;
    return length(max(offset, 0.0)) + min(max(offset.x, max(offset.y, offset.z)), 0.0);
  }

  float ellipsoidDistance(vec3 point, vec3 radius) {
    return (length(point / radius) - 1.0) * min(radius.x, min(radius.y, radius.z));
  }

  float smoothMinimum(float a, float b, float radius) {
    float blend = clamp(0.5 + 0.5 * (b - a) / radius, 0.0, 1.0);
    return mix(b, a, blend) - radius * blend * (1.0 - blend);
  }

  float morphPlantDistance(float coarseDistance, float detailedDistance, float detail) {
    float amount = smoothstep(0.0, 1.0, detail);
    float supported = smoothMinimum(coarseDistance, detailedDistance, 0.14);
    if (amount < 0.5) return mix(coarseDistance, supported, smoothstep(0.0, 0.5, amount));
    return mix(supported, detailedDistance, smoothstep(0.5, 1.0, amount));
  }

  float raggedCrown(vec3 point, vec3 scale, float phase) {
    vec3 shaped = point / scale;
    float ragged = sin(point.x * 3.7 + phase) * sin(point.y * 4.3 - phase * 0.7) * sin(point.z * 3.1 + phase * 1.3);
    ragged += sin((point.x + point.z) * 6.2 - point.y * 2.4 + phase) * 0.45;
    return (length(shaped) - 1.0) * min(scale.x, scale.z) + ragged * 0.13;
  }

  float grownShrubCrown(vec3 point, vec3 scale, float phase, float growth) {
    if (growth < 0.002) return 1000.0;
    return raggedCrown(point / growth, scale, phase) * growth;
  }`
