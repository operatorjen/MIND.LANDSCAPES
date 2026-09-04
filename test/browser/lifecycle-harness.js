import { MindLandscape } from '../../src/mind-landscape.js'

const resultNode = document.querySelector('#result')
const canvas = document.querySelector('#landscape')
const previousQuality = localStorage.getItem('mind-landscape-rendering')
localStorage.setItem('mind-landscape-rendering', JSON.stringify({ mode: 'low', reducedMotion: true }))
const app = new MindLandscape(canvas)

try {
  await app.start()
  app.renderer.setAnimationLoop(null)
  const extension = app.renderer.getContext().getExtension('WEBGL_lose_context')
  if (!extension) throw new Error('WEBGL_lose_context is unavailable')
  const lost = once(canvas, 'webglcontextlost')
  extension.loseContext()
  await lost
  if (!app.contextLost) throw new Error('Context loss did not pause the renderer')
  await new Promise((resolve) => setTimeout(resolve, 120))
  const restored = once(canvas, 'webglcontextrestored')
  extension.restoreContext()
  await restored
  app.renderer.setAnimationLoop(null)
  if (app.contextLost) throw new Error('Context restoration did not resume the renderer')
  let rendererDisposed = false
  const disposeRenderer = app.renderer.dispose.bind(app.renderer)
  app.renderer.dispose = () => {
    rendererDisposed = true
    disposeRenderer()
  }
  app.dispose()
  restorePreferences()
  finish({ passed: app.disposed && rendererDisposed, lost: true, restored: true, disposed: rendererDisposed })
} catch (error) {
  app.dispose()
  restorePreferences()
  finish({ passed: false, errors: [error.stack || error.message] })
}

function once(target, type) {
  return new Promise((resolve) => target.addEventListener(type, resolve, { once: true }))
}

function finish(result) {
  window.__renderTestResult = result
  resultNode.textContent = JSON.stringify(result)
  document.title = result.passed ? 'PASS' : 'FAIL'
}

function restorePreferences() {
  if (previousQuality === null) localStorage.removeItem('mind-landscape-rendering')
  else localStorage.setItem('mind-landscape-rendering', previousQuality)
}
