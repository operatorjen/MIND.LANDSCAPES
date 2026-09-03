const JSON_INDENT = 2
const SPEED_DECIMALS = 2

export class Interface {
  constructor(world, quality) {
    this.world = world
    this.quality = quality
    this.status = document.querySelector('#status')
    this.overlay = document.querySelector('#drop-overlay')
    this.dialog = document.querySelector('#config-dialog')
    this.editor = document.querySelector('#config-editor')
    this.message = document.querySelector('#config-message')
    this.memoryList = document.querySelector('#memory-list')
    this.memoryCount = document.querySelector('#memory-count')
    this.worldName = document.querySelector('#world-name')
    this.contentInput = document.querySelector('#content-input')
    this.qualitySelect = document.querySelector('#quality-select')
    this.dayCycleSpeed = document.querySelector('#day-cycle-speed')
    this.dayCycleSpeedValue = document.querySelector('#day-cycle-speed-value')
    this.reducedMotionToggle = document.querySelector('#reduced-motion-toggle')
    this.qualityDescription = document.querySelector('#quality-description')
    this.dragDepth = 0
    this.bindActions()
    this.quality.subscribe((profile) => this.renderQuality(profile))
  }

  bindActions() {
    document.querySelector('#config-button').addEventListener('click', () => this.open())
    document.querySelector('#fullscreen-button').addEventListener('click', () => this.toggleFullscreen())
    document.querySelector('#choose-button').addEventListener('click', () => this.contentInput.click())
    document.querySelector('#apply-button').addEventListener('click', () => this.apply())
    document.querySelector('#export-button').addEventListener('click', () => this.export())
    this.qualitySelect.addEventListener('change', () => this.quality.setMode(this.qualitySelect.value))
    this.dayCycleSpeed.addEventListener('input', () => this.renderDayCycleSpeed(this.dayCycleSpeed.value))
    this.dayCycleSpeed.addEventListener('change', () => this.world.setDayCycleSpeed(this.dayCycleSpeed.value))
    this.reducedMotionToggle.addEventListener('change', () => this.quality.setReducedMotion(this.reducedMotionToggle.checked))
    this.memoryList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove]')
      if (button) this.world.remove(button.dataset.remove)
    })
    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyC' && !(event.target instanceof HTMLTextAreaElement)) this.open()
    })
  }

  bindDrop(handler) {
    this.contentInput.addEventListener('change', async () => {
      if (!this.contentInput.files.length) return
      await handler({ files: this.contentInput.files, getData: () => '' })
      this.contentInput.value = ''
    })

    window.addEventListener('dragenter', (event) => {
      event.preventDefault()
      this.dragDepth++
      this.overlay.classList.add('visible')
    })

    window.addEventListener('dragover', (event) => {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    })

    window.addEventListener('dragleave', (event) => {
      event.preventDefault()
      this.dragDepth--
      if (this.dragDepth <= 0) {
        this.dragDepth = 0
        this.overlay.classList.remove('visible')
      }
    })

    window.addEventListener('drop', async (event) => {
      event.preventDefault()
      this.dragDepth = 0
      this.overlay.classList.remove('visible')
      try {
        await handler(event.dataTransfer)
      } catch (error) {
        console.error(error)
        this.setStatus('That influence could not be read.')
      }
    })
  }

  render(document) {
    this.document = document
    if (this.worldName) this.worldName.textContent = document.name
    this.memoryCount.textContent = `${document.entries.length} remembered`
    this.editor.value = JSON.stringify(document, null, JSON_INDENT)
    this.renderDayCycleSpeed(this.world.effectiveSettings.atmosphere.dayCycleSpeed)
    this.renderMemories(document.entries)
  }

  renderDayCycleSpeed(value) {
    const speed = Number(value)
    this.dayCycleSpeed.value = speed
    this.dayCycleSpeedValue.value = speed === 0 ? 'Paused' : `${Number(speed.toFixed(SPEED_DECIMALS))}×`
  }

  renderMemories(entries) {
    this.memoryList.replaceChildren()

    if (!entries.length) {
      const empty = document.createElement('div')
      empty.className = 'empty-memory'
      empty.textContent = 'Nothing has been placed here yet. The landscape is waiting.'
      this.memoryList.append(empty)
      return
    }

    for (const entry of entries) {
      const card = document.createElement('article')
      card.className = 'memory-card'
      const swatch = document.createElement('span')
      swatch.className = 'swatch'
      swatch.style.background = entry.contribution.palette.accent
      const name = document.createElement('strong')
      name.textContent = entry.source.name
      const qualities = document.createElement('small')
      qualities.append(swatch, entry.qualities.join(' · '))
      const interpretation = document.createElement('span')
      interpretation.className = 'interpretation'
      interpretation.textContent = entry.analysis?.interpretation?.summary || 'Local visual analysis'
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'remove-button'
      remove.dataset.remove = entry.id
      remove.setAttribute('aria-label', `Remove ${entry.source.name}`)
      remove.textContent = '×'
      card.append(name, qualities, interpretation, remove)
      this.memoryList.append(card)
    }
  }

  renderQuality(profile) {
    this.qualitySelect.value = profile.mode
    this.reducedMotionToggle.checked = profile.reducedMotion
    const mode = profile.mode === 'auto' ? 'Automatic' : profile.name
    const motion = profile.reducedMotion ? ' · motion reduced' : ''
    this.qualityDescription.textContent = `${mode} · ${profile.name} active${motion}`
  }

  open() {
    if (!this.dialog.open) this.dialog.showModal()
  }

  setStatus(message) {
    if (this.status) this.status.textContent = message
  }

  async apply() {
    this.message.classList.remove('error')
    try {
      const document = JSON.parse(this.editor.value)
      await this.world.replace(document)
      this.message.textContent = 'The world document has been applied.'
    } catch (error) {
      this.message.textContent = error instanceof SyntaxError ? 'The JSON is not valid yet.' : error.message
      this.message.classList.add('error')
    }
  }

  export() {
    const blob = new Blob([JSON.stringify(this.document, null, JSON_INDENT)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'mind-landscape.json'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  async toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  }
}
