export const PLAYER_RADIUS = 0.3
export const MAZE_HALL_HALF_WIDTH = PLAYER_RADIUS + 0.9
export const MAZE_ROOM_MIN_HALF_WIDTH = MAZE_HALL_HALF_WIDTH + 0.08
export const mazeRearMargin = depth => Math.max(2.5, (depth * 0.76 - 1.2) / 6 * 0.51 + 0.94)
