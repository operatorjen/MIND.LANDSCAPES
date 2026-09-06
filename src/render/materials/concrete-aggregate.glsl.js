export const concreteAggregateDefaults = Object.freeze({
  textureScale: 0.42,
  aggregateScale: 24,
  aggregateCoverage: 0.3,
  aggregateWidthMin: 0.03,
  aggregateWidthMax: 0.065,
  aggregateLengthMin: 0.07,
  aggregateLengthMax: 0.15,
  curvature: 0.1,
  poreScale: 4.8,
  reliefStrength: 0.12,
  morphStart: 0.05,
  morphEnd: 0.78
})

const glslFloat = (value) => Number(value).toFixed(4)

export const concreteAggregateGlsl = `
  const float CONCRETE_TEXTURE_SCALE = ${glslFloat(concreteAggregateDefaults.textureScale)};
  const float CONCRETE_AGGREGATE_SCALE = ${glslFloat(concreteAggregateDefaults.aggregateScale)};
  const float CONCRETE_AGGREGATE_COVERAGE = ${glslFloat(concreteAggregateDefaults.aggregateCoverage)};
  const float CONCRETE_WIDTH_MIN = ${glslFloat(concreteAggregateDefaults.aggregateWidthMin)};
  const float CONCRETE_WIDTH_MAX = ${glslFloat(concreteAggregateDefaults.aggregateWidthMax)};
  const float CONCRETE_LENGTH_MIN = ${glslFloat(concreteAggregateDefaults.aggregateLengthMin)};
  const float CONCRETE_LENGTH_MAX = ${glslFloat(concreteAggregateDefaults.aggregateLengthMax)};
  const float CONCRETE_CURVATURE = ${glslFloat(concreteAggregateDefaults.curvature)};
  const float CONCRETE_PORE_SCALE = ${glslFloat(concreteAggregateDefaults.poreScale)};
  const float CONCRETE_RELIEF_STRENGTH = ${glslFloat(concreteAggregateDefaults.reliefStrength)};
  const float CONCRETE_MORPH_START = ${glslFloat(concreteAggregateDefaults.morphStart)};
  const float CONCRETE_MORPH_END = ${glslFloat(concreteAggregateDefaults.morphEnd)};

  struct ConcreteAggregateSample {
    float aggregate;
    float pores;
    float matrix;
    float weathering;
    float height;
  };

  float concreteSegmentDistance(vec2 point, vec2 start, vec2 end) {
    vec2 segment = end - start;
    float amount = clamp(dot(point - start, segment) / max(dot(segment, segment), 0.0001), 0.0, 1.0);
    return length(point - start - segment * amount);
  }

  vec2 concreteCoordinates(vec3 position, vec3 surfaceNormal) {
    vec3 facing = abs(surfaceNormal);
    if (facing.x > facing.y && facing.x > facing.z) return position.yz;
    if (facing.y > facing.z) return position.xz;
    return position.xy;
  }

  ConcreteAggregateSample sampleConcreteAggregate(vec3 position, vec3 surfaceNormal, float detail) {
    ConcreteAggregateSample result;
    float detailMorph = smoothstep(CONCRETE_MORPH_START, CONCRETE_MORPH_END, detail);
    result.aggregate = 0.0;
    result.pores = 0.0;
    result.matrix = 0.5;
    result.weathering = 0.5;
    result.height = 0.0;
    if (detailMorph < 0.002) return result;

    vec2 coordinate = concreteCoordinates(position, surfaceNormal) * CONCRETE_AGGREGATE_SCALE;
    vec2 textureCoordinate = concreteCoordinates(position, surfaceNormal) * CONCRETE_TEXTURE_SCALE;
    float textureHeight = texture2D(uConcreteHeightMap, textureCoordinate).r;
    float fineHeight = texture2D(uConcreteHeightMap, textureCoordinate * 2.17 + vec2(0.37, 0.61)).r;
    textureHeight = mix(textureHeight, fineHeight, 0.24);
    vec2 cell = floor(coordinate);
    vec2 local = fract(coordinate) - 0.5;
    float identity = hash21(cell + uSeed * 0.19);
    vec2 jitter = vec2(hash21(cell + 17.3), hash21(cell + 43.9)) - 0.5;
    local -= jitter * 0.22;
    local = rotate2(identity * 6.2831853) * local;
    float halfLength = mix(CONCRETE_LENGTH_MIN, CONCRETE_LENGTH_MAX, hash21(cell + 71.2));
    float width = mix(CONCRETE_WIDTH_MIN, CONCRETE_WIDTH_MAX, hash21(cell + 92.6));
    float bend = (hash21(cell + 113.8) - 0.5) * CONCRETE_CURVATURE;
    vec2 joint = vec2(0.0, bend);
    float shapeDistance = min(
      concreteSegmentDistance(local, vec2(-halfLength, 0.0), joint),
      concreteSegmentDistance(local, joint, vec2(halfLength * mix(0.62, 1.0, identity), bend * -0.48))
    );
    float enabled = step(1.0 - CONCRETE_AGGREGATE_COVERAGE, hash21(cell + 137.1));
    float aggregate = smoothstep(width + 0.025, width, shapeDistance) * enabled;
    float poreIdentity = hash21(cell + 159.7);
    vec2 poreCenter = (vec2(hash21(cell + 181.4), hash21(cell + 203.9)) - 0.5) * 0.7;
    float poreRadius = mix(0.025, 0.07, poreIdentity);
    float pores = smoothstep(poreRadius + 0.018, poreRadius, length(local - poreCenter)) * step(0.72, poreIdentity);
    float matrix = noise21(coordinate * CONCRETE_PORE_SCALE + uSeed * 0.37);
    float weathering = noise21(concreteCoordinates(position, surfaceNormal) * 0.44 + uSeed * 0.11);
    result.aggregate = aggregate * detailMorph;
    result.pores = pores * detailMorph;
    result.matrix = mix(0.5, mix(matrix, textureHeight, 0.68), detailMorph);
    result.weathering = mix(0.5, weathering, detailMorph);
    result.height = (
      (textureHeight - 0.5) * 1.05
      + aggregate * 0.18
      - pores * 0.42
      + (matrix - 0.5) * 0.06
    ) * detailMorph;
    return result;
  }

  vec3 concreteAggregateNormal(
    vec3 position,
    vec3 surfaceNormal,
    float surfaceDetail,
    float bumpDetail,
    out ConcreteAggregateSample outSample
  ) {
    outSample = sampleConcreteAggregate(position, surfaceNormal, surfaceDetail);
    if (bumpDetail < 0.002) return surfaceNormal;
    vec3 referenceAxis = abs(surfaceNormal.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent = normalize(cross(referenceAxis, surfaceNormal));
    vec3 bitangent = normalize(cross(surfaceNormal, tangent));
    float epsilon = 0.018;
    float tangentHeight = sampleConcreteAggregate(position + tangent * epsilon, surfaceNormal, surfaceDetail).height;
    float bitangentHeight = sampleConcreteAggregate(position + bitangent * epsilon, surfaceNormal, surfaceDetail).height;
    vec2 gradient = vec2(tangentHeight - outSample.height, bitangentHeight - outSample.height) / epsilon;
    float bumpQuality = mix(0.36, 1.0, smoothstep(0.68, 0.96, uDetailScale));
    return normalize(
      surfaceNormal - (tangent * gradient.x + bitangent * gradient.y) * CONCRETE_RELIEF_STRENGTH * bumpDetail * bumpQuality
    );
  }
`
