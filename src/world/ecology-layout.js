import { STRUCTURE_CELL_SIZE, WORLD_SEED_SCALE } from '../config/world.js'

export function isCultivationCell(cellX, cellZ, seed) {
  const shaderSeed = Math.fround(Math.fround(seed) * Math.fround(WORLD_SEED_SCALE))
  return shaderHash21(Math.fround(cellX + 301.7), Math.fround(cellZ + 301.7), shaderSeed) < 0.18
}

export function plantingCenter(cellX, cellZ, seed) {
  const shaderSeed = Math.fround(Math.fround(seed) * Math.fround(WORLD_SEED_SCALE))
  return {
    x: cellX * STRUCTURE_CELL_SIZE + (shaderHash21(cellX + 317.2, cellZ + 317.2, shaderSeed) - 0.5) * 24,
    z: cellZ * STRUCTURE_CELL_SIZE + (shaderHash21(cellX + 349.8, cellZ + 349.8, shaderSeed) - 0.5) * 24
  }
}

function shaderHash21(x, z, seed) {
  x = fract(Math.fround(Math.fround(x) * Math.fround(123.34)))
  z = fract(Math.fround(Math.fround(z) * Math.fround(456.21)))
  const bias = Math.fround(45.32 + Math.fround(seed * Math.fround(0.001)))
  const sum = Math.fround(Math.fround(x * Math.fround(x + bias)) + Math.fround(z * Math.fround(z + bias)))
  x = Math.fround(x + sum)
  z = Math.fround(z + sum)
  return fract(Math.fround(x * z))
}

function fract(value) {
  return value - Math.floor(value)
}
