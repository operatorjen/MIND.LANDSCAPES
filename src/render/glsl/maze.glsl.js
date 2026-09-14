import { MAZE_HALL_HALF_WIDTH, MAZE_ROOM_MIN_HALF_WIDTH } from '../../config/navigation.js'
import { STAIR_WIDTH } from '../../config/world.js'
import { MAZE_COURTYARD_MARGIN, MAZE_DEPTH_END, MAZE_FLOORS, MAZE_SIZE, MAZE_WIDTH_HALF, MAZE_WIDTH_STEP } from '../../world/maze.js'

const MAZE_ATLAS_CELLS = 11
const MAZE_ATLAS_PIXELS = MAZE_ATLAS_CELLS * MAZE_SIZE
const MAZE_ATLAS_HEIGHT = MAZE_ATLAS_PIXELS * MAZE_FLOORS

export const mazeGlsl = `
  float mazeRearMargin(float depth) {
    return max(2.5, (depth * ${(MAZE_DEPTH_END - 0.14).toFixed(2)} - 1.2) / ${(MAZE_SIZE - 1).toFixed(1)} * 0.51 + 0.94);
  }

  float mazeBox(vec2 point, vec2 halfSize) {
    vec2 distance = abs(point) - halfSize;
    return length(max(distance, 0.0)) + min(max(distance.x, distance.y), 0.0);
  }

  float mazePlanDistance(vec2 local, vec2 cell, float width, float depth, float variant, float floorIndex, out vec4 nodeData, out vec2 nodeLocal) {
    nodeData = vec4(0.0);
    nodeLocal = vec2(1000.0);
    if (abs(local.x) > width * ${MAZE_WIDTH_HALF.toFixed(2)} || local.y > -depth * 0.14 + 0.2 || local.y < -depth * ${MAZE_DEPTH_END.toFixed(2)} - mazeRearMargin(depth)) return 1000.0;
    float side = variant > 0.5 ? 1.0 : -1.0;
    vec2 spacing = vec2(width * ${MAZE_WIDTH_STEP.toFixed(2)}, (depth * ${(MAZE_DEPTH_END - 0.14).toFixed(2)} - 1.2) / ${(MAZE_SIZE - 1).toFixed(1)});
    float startZ = -depth * 0.14 - 1.2;
    vec2 grid = clamp(floor(vec2((local.x - side * width * 0.05) / spacing.x + ${((MAZE_SIZE - 1) / 2).toFixed(1)}, (startZ - local.y) / spacing.y) + 0.5), 0.0, ${(MAZE_SIZE - 1).toFixed(1)});
    vec2 tile = cell - uMazeOrigin;
    nodeData = vec4(0.0);
    nodeLocal = vec2(1000.0);
    if (min(tile.x, tile.y) < 0.0 || max(tile.x, tile.y) >= 11.0) return 1000.0;
    vec2 atlasPixel = tile * ${MAZE_SIZE.toFixed(1)} + grid + 0.5;
    atlasPixel.y += floorIndex * ${MAZE_ATLAS_PIXELS.toFixed(1)};
    nodeData = floor(texture2D(uMazeAtlas, atlasPixel / vec2(${MAZE_ATLAS_PIXELS.toFixed(1)}, ${MAZE_ATLAS_HEIGHT.toFixed(1)})) * 255.0 + 0.5);
    if (nodeData.a < 1.0) return 1000.0;
    vec2 center = vec2((grid.x - ${((MAZE_SIZE - 1) / 2).toFixed(1)}) * spacing.x + side * width * 0.05, startZ - grid.y * spacing.y);
    nodeLocal = local - center;
    float room = max(${MAZE_ROOM_MIN_HALF_WIDTH.toFixed(6)}, min(spacing.x, spacing.y) * nodeData.g / 255.0);
    bool courtyardTile = nodeData.a > 0.5 && nodeData.a < 200.5;
    vec2 roomHalf = courtyardTile ? spacing * 0.51 + ${MAZE_COURTYARD_MARGIN.toFixed(2)} : vec2(room);
    float distance = mazeBox(nodeLocal, roomHalf);
    if (courtyardTile) {
      float shape = floor((nodeData.a - 1.0) / 48.0);
      float columns = shape > 1.5 ? 4.0 : 3.0;
      float rows = shape > 0.5 ? 3.0 : 2.0;
      float role = floor(mod(nodeData.a - 1.0, 48.0) / 3.0);
      vec2 offset = vec2(mod(role, columns) - (columns - 1.0) * 0.5,
        -(floor(role / columns) - (rows - 1.0) * 0.5)) * spacing;
      distance = mazeBox(nodeLocal + offset, spacing * vec2(columns, rows) * 0.5 + ${MAZE_COURTYARD_MARGIN.toFixed(2)});
    }
    if (mod(nodeData.r, 2.0) >= 1.0) distance = min(distance, mazeBox(nodeLocal - vec2(spacing.x * 0.5, 0.0), vec2(spacing.x * 0.5, ${MAZE_HALL_HALF_WIDTH.toFixed(6)})));
    if (mod(floor(nodeData.r / 2.0), 2.0) >= 1.0) distance = min(distance, mazeBox(nodeLocal + vec2(spacing.x * 0.5, 0.0), vec2(spacing.x * 0.5, ${MAZE_HALL_HALF_WIDTH.toFixed(6)})));
    if (mod(floor(nodeData.r / 4.0), 2.0) >= 1.0) distance = min(distance, mazeBox(nodeLocal - vec2(0.0, spacing.y * 0.5), vec2(${MAZE_HALL_HALF_WIDTH.toFixed(6)}, spacing.y * 0.5)));
    if (mod(floor(nodeData.r / 8.0), 2.0) >= 1.0) distance = min(distance, mazeBox(nodeLocal + vec2(0.0, spacing.y * 0.5), vec2(${MAZE_HALL_HALF_WIDTH.toFixed(6)}, spacing.y * 0.5)));
    if (floorIndex < 0.5) {
      float stairEnd = -depth * 0.14;
      distance = min(distance, mazeBox(local - vec2(side * width * 0.22, (stairEnd + startZ) * 0.5), vec2(${STAIR_WIDTH.toFixed(2)}, (stairEnd - startZ) * 0.5 + 0.2)));
    }
    return distance;
  }

  float lowerStairProgress(vec4 node, vec2 nodeLocal, vec2 spacing, out float across) {
    across = 1000.0;
    if (node.b < 239.5 || node.b > 247.5) return -1.0;
    float code = node.b - 240.0;
    bool bottom = code > 3.5;
    float directionIndex = mod(code, 4.0);
    vec2 direction = directionIndex < 0.5 ? vec2(1.0, 0.0)
      : directionIndex < 1.5 ? vec2(-1.0, 0.0)
      : directionIndex < 2.5 ? vec2(0.0, 1.0) : vec2(0.0, -1.0);
    float stepLength = abs(direction.x) > 0.5 ? spacing.x : spacing.y;
    float travel = dot(nodeLocal, direction) / stepLength;
    across = abs(dot(nodeLocal, vec2(-direction.y, direction.x)));
    return bottom ? clamp(1.0 + travel, 0.5, 1.0) : clamp(travel, 0.0, 0.5);
  }
`
