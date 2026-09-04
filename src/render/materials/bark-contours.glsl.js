export const barkContourDefaults = Object.freeze({
  cellsAroundTrunk: 8,
  verticalScale: 0.68,
  contourFrequency: 3.4,
  lineWidth: 0.052,
  edgeWobble: 0.34,
  spineLengthMin: 0.24,
  spineLengthMax: 0.62,
  spineCurvature: 0.18,
  reliefStrength: 0.072,
  antialiasMin: 0.014,
  antialiasMax: 0.12,
  lowQualityStipple: 0.38,
  morphStart: 0.06,
  morphEnd: 0.82
})

const glslFloat = (value) => Number(value).toFixed(4)

export const barkContoursGlsl = `
  const float BARK_CELLS_AROUND = ${glslFloat(barkContourDefaults.cellsAroundTrunk)};
  const float BARK_VERTICAL_SCALE = ${glslFloat(barkContourDefaults.verticalScale)};
  const float BARK_CONTOUR_FREQUENCY = ${glslFloat(barkContourDefaults.contourFrequency)};
  const float BARK_LINE_WIDTH = ${glslFloat(barkContourDefaults.lineWidth)};
  const float BARK_EDGE_WOBBLE = ${glslFloat(barkContourDefaults.edgeWobble)};
  const float BARK_SPINE_LENGTH_MIN = ${glslFloat(barkContourDefaults.spineLengthMin)};
  const float BARK_SPINE_LENGTH_MAX = ${glslFloat(barkContourDefaults.spineLengthMax)};
  const float BARK_SPINE_CURVATURE = ${glslFloat(barkContourDefaults.spineCurvature)};
  const float BARK_RELIEF_STRENGTH = ${glslFloat(barkContourDefaults.reliefStrength)};
  const float BARK_ANTIALIAS_MIN = ${glslFloat(barkContourDefaults.antialiasMin)};
  const float BARK_ANTIALIAS_MAX = ${glslFloat(barkContourDefaults.antialiasMax)};
  const float BARK_LOW_QUALITY_STIPPLE = ${glslFloat(barkContourDefaults.lowQualityStipple)};
  const float BARK_MORPH_START = ${glslFloat(barkContourDefaults.morphStart)};
  const float BARK_MORPH_END = ${glslFloat(barkContourDefaults.morphEnd)};

  struct BarkContourSample {
    float baseTone;
    float ridge;
    float channel;
    float fleck;
    float lichen;
    float height;
    float palette;
    float charcoal;
    float ridgeTone;
    float patina;
  };

  float barkPeriodicHash(vec2 cell, float seed) {
    vec2 wrappedCell = vec2(mod(cell.x, BARK_CELLS_AROUND), cell.y);
    return hash21(wrappedCell + vec2(seed * 19.31, seed * 7.73));
  }

  float barkPeriodicNoise(vec2 point, float seed) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    float bottom = mix(
      barkPeriodicHash(cell, seed),
      barkPeriodicHash(cell + vec2(1.0, 0.0), seed),
      local.x
    );
    float top = mix(
      barkPeriodicHash(cell + vec2(0.0, 1.0), seed),
      barkPeriodicHash(cell + 1.0, seed),
      local.x
    );
    return mix(bottom, top, local.y);
  }

  float barkOrganicDistance(vec2 point, float seed) {
    vec2 cell = floor(point);
    float nearest = 1000.0;

    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 candidateCell = cell + vec2(float(x), float(y));
        float cellSeed = barkPeriodicHash(candidateCell, seed);
        vec2 jitter = vec2(
          barkPeriodicHash(candidateCell + 13.7, seed),
          barkPeriodicHash(candidateCell + 31.9, seed)
        );
        vec2 center = candidateCell + mix(vec2(0.2), vec2(0.8), jitter);
        vec2 delta = point - center;
        float lean = (cellSeed - 0.5) * 0.94;
        vec2 axis = normalize(vec2(sin(lean), cos(lean)));
        vec2 perpendicular = vec2(-axis.y, axis.x);
        float halfLength = mix(
          BARK_SPINE_LENGTH_MIN,
          BARK_SPINE_LENGTH_MAX,
          barkPeriodicHash(candidateCell + 47.2, seed)
        );
        float longitudinal = dot(delta, axis);
        float along = clamp(longitudinal, -halfLength, halfLength);
        float normalizedAlong = along / max(halfLength, 0.001);
        float curvePhase = cellSeed * 6.2831853 + normalizedAlong * mix(1.3, 2.8, jitter.x);
        float curveEnvelope = 1.0 - normalizedAlong * normalizedAlong;
        float curve = sin(curvePhase) * BARK_SPINE_CURVATURE * curveEnvelope;
        curve += sin(curvePhase * 1.9 + jitter.y * 4.7) * BARK_SPINE_CURVATURE * 0.34 * curveEnvelope;
        vec2 fromSpine = delta - axis * along - perpendicular * curve;
        float widthScale = mix(0.92, 1.48, barkPeriodicHash(candidateCell + 58.6, seed));
        float endVariation = mix(0.82, 1.14, barkPeriodicHash(candidateCell + 72.3, seed));
        float organic = length(vec2(dot(fromSpine, perpendicular) * widthScale, dot(fromSpine, axis) * endVariation));
        nearest = min(nearest, organic);
      }
    }

    return nearest;
  }

  vec2 barkContourCoordinates(vec3 position, out vec2 treeCell, out float treeSeed) {
    treeCell = floor((position.xz + TREE_CELL * 0.5) / TREE_CELL);
    vec2 center = treeCenterForCell(treeCell);
    vec2 radial = position.xz - center;
    float angle = atan(radial.y, radial.x) / 6.2831853 + 0.5;
    treeSeed = hash21(treeCell + uSeed * 0.07);
    float ground = terrainHeight(center);
    float verticalOffset = treeSeed * 37.0 + hash21(treeCell + 22.4) * 11.0;
    return vec2(fract(angle) * BARK_CELLS_AROUND, (position.y - ground) * BARK_VERTICAL_SCALE + verticalOffset);
  }

  BarkContourSample sampleBarkContours(vec3 position, float detail) {
    float detailMorph = smoothstep(BARK_MORPH_START, BARK_MORPH_END, detail);
    BarkContourSample barkResult;
    if (detailMorph < 0.002) {
      vec2 distantTreeCell = floor((position.xz + TREE_CELL * 0.5) / TREE_CELL);
      barkResult.baseTone = 0.5;
      barkResult.ridge = 0.0;
      barkResult.channel = 0.0;
      barkResult.fleck = 0.0;
      barkResult.lichen = 0.0;
      barkResult.height = 0.0;
      barkResult.palette = hash21(distantTreeCell + 91.7);
      barkResult.charcoal = smoothstep(0.58, 0.96, hash21(distantTreeCell + 117.3));
      barkResult.ridgeTone = 0.0;
      barkResult.patina = 0.0;
      return barkResult;
    }

    vec2 treeCell;
    float treeSeed;
    vec2 coordinate = barkContourCoordinates(position, treeCell, treeSeed);
    float broadWarp = barkPeriodicNoise(coordinate * vec2(1.0, 0.74), treeSeed + 2.1) - 0.5;
    float fineWarp = barkPeriodicNoise(coordinate * vec2(2.0, 1.48), treeSeed + 5.7) - 0.5;
    vec2 warped = coordinate;
    warped.x += (broadWarp * mix(0.18, 0.52, detailMorph) + fineWarp * 0.13) * BARK_EDGE_WOBBLE;
    warped.y += (broadWarp * mix(0.06, 0.2, detailMorph) - fineWarp * 0.08) * BARK_EDGE_WOBBLE;

    float organicDistance = barkOrganicDistance(warped, treeSeed);
    float ringVariation = mix(0.86, 1.18, barkPeriodicNoise(coordinate + 8.3, treeSeed + 9.4));
    float phase = organicDistance * BARK_CONTOUR_FREQUENCY * mix(0.78, ringVariation, detailMorph);
    phase += fineWarp * BARK_EDGE_WOBBLE;
    float contourBand = floor(phase);
    float contourDistance = abs(fract(phase) - 0.5);
    float widthVariation = mix(0.78, 1.28, barkPeriodicNoise(coordinate * 3.0 + 17.0, treeSeed + 13.8));
    float emergingWidth = BARK_LINE_WIDTH * widthVariation * detailMorph;
    float qualityAmount = smoothstep(0.68, 1.05, uDetailScale);
    float worldPixelSize = length(position - cameraPosition) * 1.55 / max(uResolution.y, 1.0);
    float projectedFootprint = worldPixelSize * BARK_VERTICAL_SCALE * BARK_CONTOUR_FREQUENCY;
    float antialiasWidth = clamp(
      projectedFootprint * mix(1.3, 0.84, qualityAmount),
      BARK_ANTIALIAS_MIN,
      BARK_ANTIALIAS_MAX
    );
    float ridge = 1.0 - smoothstep(
      emergingWidth - antialiasWidth,
      emergingWidth + antialiasWidth,
      contourDistance
    );
    ridge *= min(1.0, emergingWidth / max(antialiasWidth * 0.72, 0.001));
    float stipple = barkPeriodicNoise(coordinate * vec2(13.0, 9.0) + 53.0, treeSeed + 27.2);
    float stippleAmount = (1.0 - qualityAmount) * BARK_LOW_QUALITY_STIPPLE * detailMorph;
    ridge *= mix(1.0, mix(0.58, 1.16, stipple), stippleAmount);
    ridge *= smoothstep(0.02, 0.34, detailMorph);

    float channel = smoothstep(0.43, 0.5, contourDistance) * detailMorph;
    float baseTone = barkPeriodicNoise(coordinate * vec2(1.8, 1.12) + 23.0, treeSeed + 18.2);
    float fleck = smoothstep(
      0.78,
      0.95,
      barkPeriodicNoise(coordinate * vec2(5.0, 3.6) + 41.0, treeSeed + 24.9)
    ) * detailMorph;
    float lichen = smoothstep(
      0.67,
      0.9,
      barkPeriodicNoise(coordinate * vec2(0.72, 0.58) + 67.0, treeSeed + 31.4)
    ) * detailMorph;

    barkResult.baseTone = mix(0.5, baseTone, detailMorph);
    barkResult.ridge = ridge;
    barkResult.channel = channel;
    barkResult.fleck = fleck;
    barkResult.lichen = lichen;
    barkResult.height = ridge * 0.72 - channel * 0.2 + fineWarp * 0.08 * detailMorph;
    barkResult.palette = hash21(treeCell + 91.7);
    barkResult.charcoal = smoothstep(0.58, 0.96, hash21(treeCell + 117.3));
    barkResult.ridgeTone = hash21(treeCell + vec2(contourBand * 11.7, floor(coordinate.y * 0.42)) + 143.9);
    barkResult.patina = barkPeriodicNoise(coordinate * vec2(0.54, 0.31) + 79.0, treeSeed + 38.6) * detailMorph;
    return barkResult;
  }

  vec3 barkContourNormal(
    vec3 position,
    vec3 surfaceNormal,
    float surfaceDetail,
    float bumpDetail,
    out BarkContourSample outSample
  ) {
    outSample = sampleBarkContours(position, surfaceDetail);
    if (bumpDetail < 0.002) return surfaceNormal;

    vec3 referenceAxis = abs(surfaceNormal.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent = normalize(cross(referenceAxis, surfaceNormal));
    vec3 bitangent = normalize(cross(surfaceNormal, tangent));
    float epsilon = 0.028;
    float tangentHeight = sampleBarkContours(position + tangent * epsilon, surfaceDetail).height;
    float bitangentHeight = sampleBarkContours(position + bitangent * epsilon, surfaceDetail).height;
    vec2 gradient = vec2(tangentHeight - outSample.height, bitangentHeight - outSample.height) / epsilon;
    float bumpQuality = mix(0.32, 1.0, smoothstep(0.68, 0.96, uDetailScale));
    return normalize(
      surfaceNormal - (tangent * gradient.x + bitangent * gradient.y) * BARK_RELIEF_STRENGTH * bumpDetail * bumpQuality
    );
  }
`
