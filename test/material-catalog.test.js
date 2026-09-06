import assert from 'node:assert/strict'
import test from 'node:test'
import { materialCatalog, materialGlsl } from '../src/render/materials/catalog.js'
import { MATERIAL, MATERIAL_BOUNDARY, materialConstantsGlsl } from '../src/config/materials.js'

test('surface material catalog has unique, complete entries', () => {
  const keys = materialCatalog.map(({ key }) => key)
  assert.equal(new Set(keys).size, keys.length)

  for (const material of materialCatalog) {
    assert.ok(material.key)
    assert.ok(material.label)
    assert.equal(material.materialRange.length, 2)
    assert.ok(material.materialRange[0] < material.materialRange[1])
    assert.ok(material.outputs.length)
    assert.ok(material.shader.trim())
  }
})

test('bark contour material is composed into the shader catalog', () => {
  const bark = materialCatalog.find(({ key }) => key === 'bark-contours')
  assert.ok(bark)
  assert.equal(bark.mapping, 'tree-local cylindrical')
  assert.deepEqual(bark.textureInputs, [])
  assert.match(materialGlsl, /sampleBarkContours/)
  assert.match(materialGlsl, /barkContourNormal/)
})

test('wispy meadow grass material is composed into the shader catalog', () => {
  const grass = materialCatalog.find(({ key }) => key === 'grass-meadow')
  assert.ok(grass)
  assert.equal(grass.mapping, 'stable world-space planar and growth-cell local')
  assert.deepEqual(grass.secondaryMaterialRange, [3.8, 4])
  assert.deepEqual(grass.textureInputs, [])
  assert.match(materialGlsl, /sampleMeadowGrass/)
  assert.match(materialGlsl, /meadowGrassBladeColor/)
})

test('fine concrete aggregate material is composed into the shader catalog', () => {
  const concrete = materialCatalog.find(({ key }) => key === 'concrete-aggregate')
  assert.ok(concrete)
  assert.equal(concrete.mapping, 'dominant-axis world-space planar')
  assert.deepEqual(concrete.textureInputs, ['assets/textures/concrete-height.png (linear grayscale height)'])
  assert.match(materialGlsl, /texture2D\(uConcreteHeightMap/)
  assert.match(materialGlsl, /sampleConcreteAggregate/)
  assert.match(materialGlsl, /concreteAggregateNormal/)
})

test('sunlit exterior overgrowth is texture-backed, solar-oriented and quality-morphed', () => {
  const overgrowth = materialCatalog.find(({ key }) => key === 'sunlit-overgrowth')
  assert.ok(overgrowth)
  assert.equal(overgrowth.mapping, 'vertical world-space planar with stable solar exposure')
  assert.deepEqual(overgrowth.textureInputs, ['assets/textures/sunlit-overgrowth-mask.png (linear grayscale coverage)'])
  assert.match(materialGlsl, /sampleSunlitOvergrowth/)
  assert.match(materialGlsl, /stableSolarPathExposure/)
  assert.match(materialGlsl, /dryStructureInterior\(position\)/)
  assert.match(materialGlsl, /smoothstep\(0\.62, 1\.04, uDetailScale\)/)
})

test('material ids and shading boundaries share one ordered source of truth', () => {
  const ids = Object.values(MATERIAL)
  const boundaries = Object.values(MATERIAL_BOUNDARY)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual(boundaries, [...boundaries].sort((a, b) => a - b))
  assert.equal(MATERIAL.terrain, 0)
  assert.ok(MATERIAL.portal > MATERIAL_BOUNDARY.liminal)
  for (const id of ids) assert.match(materialConstantsGlsl, new RegExp(`= ${id}(?:\\.0)?;`))
})
