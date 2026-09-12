export const ecologyMapGlsl = `
  const float ECOLOGY_ATLAS_CELLS = 11.0;

  bool cultivationCell(vec2 cell) {
    return hash21(cell + 301.7) < 0.18;
  }

  vec2 plantingCenterForCell(vec2 cell) {
    vec2 jitter = vec2(hash21(cell + 317.2), hash21(cell + 349.8)) - 0.5;
    return cell * STRUCTURE_CELL + jitter * 24.0;
  }

  vec4 ecologyDataForCell(vec2 cell) {
    vec2 atlasCell = cell - uEcologyOrigin;
    if (min(atlasCell.x, atlasCell.y) < 0.0 || max(atlasCell.x, atlasCell.y) >= ECOLOGY_ATLAS_CELLS) return vec4(0.0);
    return texture2D(uEcologyAtlas, (atlasCell + 0.5) / ECOLOGY_ATLAS_CELLS);
  }
`
