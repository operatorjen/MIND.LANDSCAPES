export const MATERIAL = Object.freeze({
  terrain: 0,
  bark: 1,
  foliageBase: 2,
  shrub: 2.72,
  succulent: 3.7,
  grass: 3.82,
  concrete: 4,
  marble: 5,
  brass: 6,
  sand: 7,
  ornate: 8,
  abandoned: 9,
  cave: 10,
  flooded: 11,
  liminal: 12,
  portal: 13
})

export const MATERIAL_BOUNDARY = Object.freeze({
  terrain: 0.5,
  bark: 1.5,
  foliageDetail: 2.7,
  foliage: 3.5,
  succulent: 3.8,
  grass: 4,
  concrete: 4.5,
  marble: 5.5,
  brass: 6.5,
  sand: 7.5,
  ornate: 8.5,
  abandoned: 9.5,
  cave: 10.5,
  flooded: 11.5,
  liminal: 12.5
})

const glslNames = {
  terrain: 'MATERIAL_TERRAIN',
  bark: 'MATERIAL_BARK',
  foliageBase: 'MATERIAL_FOLIAGE_BASE',
  shrub: 'MATERIAL_SHRUB',
  succulent: 'MATERIAL_SUCCULENT',
  grass: 'MATERIAL_GRASS',
  concrete: 'MATERIAL_CONCRETE',
  marble: 'MATERIAL_MARBLE',
  brass: 'MATERIAL_BRASS',
  sand: 'MATERIAL_SAND',
  ornate: 'MATERIAL_ORNATE',
  abandoned: 'MATERIAL_ABANDONED',
  cave: 'MATERIAL_CAVE',
  flooded: 'MATERIAL_FLOODED',
  liminal: 'MATERIAL_LIMINAL',
  portal: 'MATERIAL_PORTAL'
}

const boundaryGlslNames = {
  terrain: 'MATERIAL_TERRAIN_MAX',
  bark: 'MATERIAL_BARK_MAX',
  foliageDetail: 'MATERIAL_FOLIAGE_DETAIL_MAX',
  foliage: 'MATERIAL_FOLIAGE_MAX',
  succulent: 'MATERIAL_SUCCULENT_MAX',
  grass: 'MATERIAL_GRASS_MAX',
  concrete: 'MATERIAL_CONCRETE_MAX',
  marble: 'MATERIAL_MARBLE_MAX',
  brass: 'MATERIAL_BRASS_MAX',
  sand: 'MATERIAL_SAND_MAX',
  ornate: 'MATERIAL_ORNATE_MAX',
  abandoned: 'MATERIAL_ABANDONED_MAX',
  cave: 'MATERIAL_CAVE_MAX',
  flooded: 'MATERIAL_FLOODED_MAX',
  liminal: 'MATERIAL_LIMINAL_MAX'
}

const glslFloat = (value) => Number.isInteger(value) ? `${value}.0` : `${value}`

export const materialConstantsGlsl = [
  ...Object.entries(MATERIAL).map(([key, value]) => `const float ${glslNames[key]} = ${glslFloat(value)};`),
  ...Object.entries(MATERIAL_BOUNDARY).map(([key, value]) => `const float ${boundaryGlslNames[key]} = ${glslFloat(value)};`)
].join('\n')
