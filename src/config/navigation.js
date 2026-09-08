export const PLAYER_RADIUS = 0.3
export const MAZE_HALL_HALF_WIDTH = PLAYER_RADIUS + 0.9
export const MAZE_ROOM_MIN_HALF_WIDTH = MAZE_HALL_HALF_WIDTH + 0.08

// Leave solid wall thickness beyond the deepest enlarged courtyard tile.
export const mazeRearMargin = depth => Math.max(2.5, (depth * 0.64 - 1.2) / 4 * 0.51 + 0.7)
