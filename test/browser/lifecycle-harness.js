import { MindLandscape } from '../../src/mind-landscape.js'
import { WorldState, deriveSettings } from '../../src/world/world-state.js'

const resultNode = document.querySelector('#result')
const canvas = document.querySelector('#landscape')
const previousQuality = localStorage.getItem('mind-landscape-rendering')
localStorage.setItem('mind-landscape-rendering', JSON.stringify({ mode: 'low', reducedMotion: true }))
const app = new MindLandscape(canvas)

try {
  await app.start()
  app.renderer.setAnimationLoop(null)
  const artCanvas = document.createElement('canvas')
  artCanvas.width = artCanvas.height = 16
  artCanvas.getContext('2d').fillRect(4, 4, 8, 8)
  const artBlob = await new Promise(resolve => artCanvas.toBlob(resolve))
  const worldBeforeArt = JSON.stringify(app.world.document)
  await app.personalArt.import([new File([artBlob], 'lifecycle.png', { type: 'image/png' })])
  if (app.landscape.uniforms.uArtCount.value !== 1) throw new Error('Art import did not reach the renderer')
  if (JSON.stringify(app.world.document) !== worldBeforeArt) throw new Error('Art import changed landscape influences')
  await app.personalArt.import([new File(['bad'], 'broken.png')])
  if (app.personalArt.pack.names[0] !== 'lifecycle.png') throw new Error('Failed import replaced the valid pack')
  const previewImage = document.querySelector('#art-preview img')
  await app.personalArt.change({ ...app.personalArt.pack, density: 0.5 })
  if (document.querySelector('#art-preview img') !== previewImage) throw new Error('Coverage changes rebuilt the art preview')
  const setSize = app.renderer.setSize.bind(app.renderer)
  let resizes = 0
  app.renderer.setSize = (...args) => { resizes++; return setSize(...args) }
  app.resize()
  app.resize()
  if (resizes) throw new Error('Unchanged viewport resized the drawing buffer')
  const resource = await fetch('/src/main.js')
  const etag = resource.headers.get('etag')
  if (!etag) throw new Error('Static resources have no cache validator')
  const cached = await fetch('/src/main.js', { cache: 'no-store', headers: { 'If-None-Match': etag } })
  if (cached.status !== 304) throw new Error(`Unchanged resource returned ${cached.status} instead of 304`)
  const artTexture = app.landscape.artAtlas.texture
  const artVersion = artTexture.version
  let artDisposed = false
  artTexture.addEventListener('dispose', () => { artDisposed = true }, { once: true })
  const extension = app.renderer.getContext().getExtension('WEBGL_lose_context')
  if (!extension) throw new Error('WEBGL_lose_context is unavailable')
  const overgrowthTexture = app.landscape.sunlitOvergrowthMap
  const lost = once(canvas, 'webglcontextlost')
  extension.loseContext()
  await lost
  if (!app.contextLost) throw new Error('Context loss did not pause the renderer')
  await new Promise((resolve) => setTimeout(resolve, 120))
  const overgrowthVersion = overgrowthTexture.version
  const restored = once(canvas, 'webglcontextrestored')
  extension.restoreContext()
  await restored
  app.renderer.setAnimationLoop(null)
  if (app.contextLost) throw new Error('Context restoration did not resume the renderer')
  if (artTexture.version <= artVersion) throw new Error('Personal art texture was not restored')
  if (overgrowthTexture.version <= overgrowthVersion) throw new Error('Overgrowth texture was not restored')
  await app.world.addOrReplace({
    id: 'maze-persistence-test',
    source: { key: 'maze-test', name: 'Maze test', type: 'text', hash: 'maze-content-fingerprint' },
    qualities: ['irregular'],
    contribution: deriveSettings([])
  })
  const savedMaze = JSON.stringify(app.world.document.maze)
  let rendererDisposed = false
  let overgrowthDisposed = false
  overgrowthTexture.addEventListener('dispose', () => { overgrowthDisposed = true }, { once: true })
  const disposeRenderer = app.renderer.dispose.bind(app.renderer)
  app.renderer.dispose = () => {
    rendererDisposed = true
    disposeRenderer()
  }
  app.dispose()
  if (!artDisposed) throw new Error('Personal art texture was not disposed')
  if (!overgrowthDisposed) throw new Error('Overgrowth texture was not disposed')
  const reloaded = await WorldState.create()
  const mazeRestored = JSON.stringify(reloaded.document.maze) === savedMaze
    && reloaded.document.entries.some(entry => entry.id === 'maze-persistence-test')
  reloaded.dispose()
  if (!mazeRestored) throw new Error('IndexedDB did not restore the saved media and maze recipe')
  restorePreferences()
  finish({
    passed: app.disposed && rendererDisposed && overgrowthDisposed,
    lost: true,
    restored: true,
    disposed: rendererDisposed,
    overgrowthDisposed,
    artDisposed,
    artRestored: true,
    mazeRestored,
    previewReused: true,
    redundantResizesSkipped: true,
    conditionalCaching: true
  })
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
