import { vegetationCommonGlsl } from './vegetation/common.glsl.js'
import { foliageGeometryGlsl } from './vegetation/foliage.glsl.js'
import { vegetationPlacementGlsl } from './vegetation/placement.glsl.js'
import { grassGeometryGlsl } from './vegetation/grass-geometry.glsl.js'
import { forestGeometryGlsl } from './vegetation/forest-geometry.glsl.js'
import { plantedGeometryGlsl } from './vegetation/planted-geometry.glsl.js'

export const vegetationGlsl = `
${[
  vegetationCommonGlsl,
  foliageGeometryGlsl,
  vegetationPlacementGlsl,
  grassGeometryGlsl,
  forestGeometryGlsl,
  plantedGeometryGlsl
].join('\n\n')}
`
