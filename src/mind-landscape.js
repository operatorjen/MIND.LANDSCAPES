import * as THREE from 'three'
import { VRButton } from 'three/addons/webxr/VRButton.js'
import { enhanceEntriesWithAI } from './content/ai-analysis.js'
import { analyzeTransfer } from './content/analyze.js'
import { ExplorerControls } from './input/explorer-controls.js'
import { Landscape } from './render/landscape.js'
import { QualityController } from './render/quality.js'
import { WorldState } from './world/world-state.js'
import { Interface } from './ui/interface.js'

const CAMERA_FOV = 75
const CAMERA_NEAR = 0.05
const CAMERA_FAR = 900
const MAX_FRAME_DELTA = 0.05

export class MindLandscape {
  constructor(canvas) {
    this.canvas = canvas
    this.timer = new THREE.Timer()
    this.timer.connect(document)
    this.unsubscribers = []
    this.contextLost = false
    this.disposed = false
    this.renderFrame = (time) => this.render(time)
    this.handleResize = () => this.resize()
    this.handleContextLost = (event) => {
      event.preventDefault()
      this.contextLost = true
      this.renderer.setAnimationLoop(null)
      this.interface?.setStatus('The graphics context paused. Restoring the landscape…')
    }
    this.handleContextRestored = () => {
      if (this.disposed) return
      this.contextLost = false
      this.landscape.restoreContext()
      this.resize()
      this.renderer.setAnimationLoop(this.renderFrame)
      this.interface?.setStatus('The landscape has been restored.')
    }
  }

  async start() {
    this.world = await WorldState.create()
    if (this.disposed) return
    this.quality = new QualityController()
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR)
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance'
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.xr.enabled = true

    this.landscape = new Landscape(
      this.scene,
      this.camera,
      this.world.effectiveSettings,
      this.world.document.seed,
      this.quality.profile
    )
    this.controls = new ExplorerControls(
      this.canvas,
      this.camera,
      () => this.world.effectiveSettings,
      () => this.world.document.seed
    )
    this.interface = new Interface(this.world, this.quality)

    this.unsubscribers.push(this.world.subscribe((document) => {
      this.landscape.applySettings(this.world.effectiveSettings, document.seed)
      this.interface.render(document)
    }))

    this.unsubscribers.push(this.quality.subscribe((profile) => {
      this.landscape.applyQuality(profile)
      this.resize()
    }))

    this.interface.bindDrop(async (transfer) => {
      this.interface.setStatus('Reading the influence…')
      const entries = await analyzeTransfer(transfer)

      if (!entries.length) {
        this.interface.setStatus('Try an image, a text file, or dragged writing.')
        return
      }

      this.interface.setStatus('Interpreting its mood and material language…')
      const interpretation = await enhanceEntriesWithAI(entries)
      for (const entry of interpretation.entries) await this.world.addOrReplace(entry)
      const verb = entries.length === 1 ? 'has' : 'have'
      const subject = entries.length === 1 ? entries[0].source.name : `${entries.length} memories`
      const reading = interpretation.usedAI ? 'GPT interpreted the mood; ' : 'Local analysis shaped it; '
      this.interface.setStatus(`${reading}${subject} ${verb} changed this place.`)
    })

    this.bindWindowEvents()
    this.resize()
    await this.addVRButton()
    if (this.disposed) return
    this.renderer.setAnimationLoop(this.renderFrame)
  }

  bindWindowEvents() {
    window.addEventListener('resize', this.handleResize)
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost)
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored)
  }

  resize() {
    const width = window.innerWidth
    const height = window.innerHeight
    const pixelRatio = Math.min(window.devicePixelRatio || 1, this.quality.profile.pixelRatio)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(width, height, false)
    this.landscape.setResolution(width * pixelRatio, height * pixelRatio)
  }

  async addVRButton() {
    if (!navigator.xr || !window.isSecureContext) return

    try {
      if (await navigator.xr.isSessionSupported('immersive-vr')) {
        this.vrButton = VRButton.createButton(this.renderer, {
          optionalFeatures: ['local-floor', 'bounded-floor']
        })
        document.body.append(this.vrButton)
      }
    } catch {
      return
    }
  }

  render(time) {
    if (this.contextLost || this.disposed) return
    this.timer.update(time)
    const delta = Math.min(this.timer.getDelta(), MAX_FRAME_DELTA)

    this.quality.sample(delta, this.renderer.xr.isPresenting)
    if (!this.renderer.xr.isPresenting) this.controls.update(delta)
    this.landscape.update(this.timer.getElapsed(), delta)
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.renderer?.setAnimationLoop(null)
    window.removeEventListener('resize', this.handleResize)
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored)
    for (const unsubscribe of this.unsubscribers) unsubscribe()
    this.unsubscribers.length = 0
    this.interface?.dispose()
    this.controls?.dispose()
    this.landscape?.dispose()
    this.world?.dispose()
    this.vrButton?.remove()
    this.renderer?.dispose()
    this.timer.disconnect?.()
  }
}
