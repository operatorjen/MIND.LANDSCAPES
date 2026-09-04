import assert from 'node:assert/strict'
import test from 'node:test'
import { QUALITY_LEVELS, QUALITY_PROFILES, SHADER_VARIANTS } from '../src/config/rendering.js'

test('vegetation budgets increase with rendering quality', () => {
  for (let index = 1; index < QUALITY_LEVELS.length; index++) {
    const previous = QUALITY_PROFILES[QUALITY_LEVELS[index - 1]]
    const current = QUALITY_PROFILES[QUALITY_LEVELS[index]]
    assert.ok(current.treeDensity >= previous.treeDensity)
    assert.ok(current.plantDensity >= previous.plantDensity)
    assert.ok(current.detailScale >= previous.detailScale)
  }
})

test('vegetation budgets stay normalized', () => {
  for (const profile of Object.values(QUALITY_PROFILES)) {
    assert.ok(profile.treeDensity > 0 && profile.treeDensity <= 1)
    assert.ok(profile.plantDensity > 0 && profile.plantDensity <= 1)
  }
})

test('shader variants increase compile-time work with quality', () => {
  for (let index = 0; index < QUALITY_LEVELS.length; index++) {
    const level = QUALITY_LEVELS[index]
    const variant = SHADER_VARIANTS[level]
    assert.equal(variant.sceneSteps, QUALITY_PROFILES[level].raySteps)
    assert.equal(variant.qualityLevel, index)
    if (index === 0) assert.equal(variant.sceneReflections, false)
    if (index > 0) {
      const previous = SHADER_VARIANTS[QUALITY_LEVELS[index - 1]]
      assert.ok(variant.sceneSteps > previous.sceneSteps)
      assert.ok(variant.reflectionSteps >= previous.reflectionSteps)
    }
  }
})
