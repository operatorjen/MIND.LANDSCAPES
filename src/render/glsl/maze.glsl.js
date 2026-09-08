import { MAZE_HALL_HALF_WIDTH, MAZE_ROOM_MIN_HALF_WIDTH } from '../../config/navigation.js'

export const mazeGlsl = `
  float mazeRearMargin(float depth) {
    return max(2.5, (depth * 0.64 - 1.2) / 4.0 * 0.51 + 0.7);
  }

  float mazeBox(vec2 point, vec2 halfSize) {
    vec2 distance = abs(point) - halfSize;
    return length(max(distance, 0.0)) + min(max(distance.x, distance.y), 0.0);
  }

  float mazePlanDistance(vec2 local, vec2 cell, float width, float depth, float variant, out vec4 nodeData, out vec2 nodeLocal) {
    nodeData = vec4(0.0);
    nodeLocal = vec2(1000.0);
    if (abs(local.x) > width * 0.5 + 2.0 || local.y > -depth * 0.14 + 0.2 || local.y < -depth * 0.78 - mazeRearMargin(depth)) return 1000.0;
    float side = variant > 0.5 ? 1.0 : -1.0;
    vec2 spacing = vec2(width * 0.17, (depth * 0.64 - 1.2) / 4.0);
    float startZ = -depth * 0.14 - 1.2;
    vec2 grid = clamp(floor(vec2((local.x - side * width * 0.05) / spacing.x + 2.0, (startZ - local.y) / spacing.y) + 0.5), 0.0, 4.0);
    vec2 tile = cell - uMazeOrigin;
    nodeData = vec4(0.0);
    nodeLocal = vec2(1000.0);
    if (min(tile.x, tile.y) < 0.0 || max(tile.x, tile.y) >= 11.0) return 1000.0;
    nodeData = floor(texture2D(uMazeAtlas, (tile * 5.0 + grid + 0.5) / 55.0) * 255.0 + 0.5);
    if (nodeData.a < 1.0) return 1000.0;
    vec2 center = vec2((grid.x - 2.0) * spacing.x + side * width * 0.05, startZ - grid.y * spacing.y);
    nodeLocal = local - center;
    float room = max(${MAZE_ROOM_MIN_HALF_WIDTH.toFixed(6)}, min(spacing.x, spacing.y) * nodeData.g / 255.0);
    bool courtyardTile = nodeData.a > 0.5 && nodeData.a < 254.5;
    vec2 roomHalf = courtyardTile ? spacing * 0.51 : vec2(room);
    float distance = mazeBox(nodeLocal, roomHalf);
    if (courtyardTile) {
      float shape = floor((nodeData.a - 1.0) / 48.0);
      float columns = shape > 1.5 ? 4.0 : 3.0;
      float rows = shape > 0.5 ? 3.0 : 2.0;
      float role = floor(mod(nodeData.a - 1.0, 48.0) / 3.0);
      vec2 offset = vec2(mod(role, columns) - (columns - 1.0) * 0.5,
        -(floor(role / columns) - (rows - 1.0) * 0.5)) * spacing;
      // Measure the entire open courtyard, never its internal tile seams.
      distance = mazeBox(nodeLocal + offset, spacing * (vec2(columns, rows) * 0.5 + 0.01));
    }
    if (mod(nodeData.r, 2.0) >= 1.0) distance = min(distance, mazeBox(nodeLocal - vec2(spacing.x * 0.5, 0.0), vec2(spacing.x * 0.5, ${MAZE_HALL_HALF_WIDTH.toFixed(6)})));
    if (mod(floor(nodeData.r / 2.0), 2.0) >= 1.0) distance = min(distance, mazeBox(nodeLocal + vec2(spacing.x * 0.5, 0.0), vec2(spacing.x * 0.5, ${MAZE_HALL_HALF_WIDTH.toFixed(6)})));
    if (mod(floor(nodeData.r / 4.0), 2.0) >= 1.0) distance = min(distance, mazeBox(nodeLocal - vec2(0.0, spacing.y * 0.5), vec2(${MAZE_HALL_HALF_WIDTH.toFixed(6)}, spacing.y * 0.5)));
    if (mod(floor(nodeData.r / 8.0), 2.0) >= 1.0) distance = min(distance, mazeBox(nodeLocal + vec2(0.0, spacing.y * 0.5), vec2(${MAZE_HALL_HALF_WIDTH.toFixed(6)}, spacing.y * 0.5)));
    float stairEnd = -depth * 0.14;
    return min(distance, mazeBox(local - vec2(side * width * 0.22, (stairEnd + startZ) * 0.5), vec2(1.45, (stairEnd - startZ) * 0.5 + 0.2)));
  }
`
