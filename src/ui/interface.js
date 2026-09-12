import { SEED_TYPES } from '../world/ecology.js'

const JSON_INDENT = 2
const SPEED_DECIMALS = 2

export class Interface {
  constructor(world, quality, ecology) {
    this.world = world
    this.quality = quality
    this.ecology = ecology
    this.status = document.querySelector('#status')
    this.overlay = document.querySelector('#drop-overlay')
    this.dialog = document.querySelector('#config-dialog')
    this.inventoryDialog = document.querySelector('#inventory-dialog')
    this.seedList = document.querySelector('#seed-list')
    this.ecologyStats = document.querySelector('#ecology-stats')
    this.interaction = document.querySelector('#interaction')
    this.plantingBeacons = document.querySelector('#planting-beacons')
    this.beaconElements = new Map()
    this.noticeElement = document.querySelector('#notice')
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
    this.listeners = []
    this.bindActions()
    this.unsubscribeQuality = this.quality.subscribe((profile) => this.renderQuality(profile))
    this.unsubscribeEcology = this.ecology.subscribe((document) => this.renderEcology(document))
  }

  listen(target, type, listener, options) {
    target.addEventListener(type, listener, options)
    this.listeners.push([target, type, listener, options])
  }

  bindActions() {
    this.listen(document.querySelector('#config-button'), 'click', () => this.open())
    this.listen(document.querySelector('#inventory-button'), 'click', () => this.openInventory())
    this.listen(document.querySelector('#fullscreen-button'), 'click', () => this.toggleFullscreen())
    this.listen(document.querySelector('#choose-button'), 'click', () => this.contentInput.click())
    this.listen(document.querySelector('#apply-button'), 'click', () => this.apply())
    this.listen(document.querySelector('#export-button'), 'click', () => this.export())
    this.listen(this.qualitySelect, 'change', () => this.quality.setMode(this.qualitySelect.value))
    this.listen(this.dayCycleSpeed, 'input', () => this.renderDayCycleSpeed(this.dayCycleSpeed.value))
    this.listen(this.dayCycleSpeed, 'change', () => this.world.setDayCycleSpeed(this.dayCycleSpeed.value))
    this.listen(this.reducedMotionToggle, 'change', () => this.quality.setReducedMotion(this.reducedMotionToggle.checked))
    this.listen(this.memoryList, 'click', (event) => {
      const button = event.target.closest('[data-remove]')
      if (button) this.world.remove(button.dataset.remove)
    })
    this.listen(this.seedList, 'click', (event) => {
      const button = event.target.closest('[data-seed-type]')
      if (button) this.ecology.selectSeed(button.dataset.seedType)
    })
    this.listen(window, 'keydown', (event) => {
      if (event.code === 'KeyC' && !(event.target instanceof HTMLTextAreaElement)) this.open()
    })
  }

  bindDrop(handler) {
    this.listen(this.contentInput, 'change', async () => {
      if (!this.contentInput.files.length) return
      await handler({ files: this.contentInput.files, getData: () => '' })
      this.contentInput.value = ''
    })

    this.listen(window, 'dragenter', (event) => {
      event.preventDefault()
      this.dragDepth++
      this.overlay.classList.add('visible')
    })

    this.listen(window, 'dragover', (event) => {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    })

    this.listen(window, 'dragleave', (event) => {
      event.preventDefault()
      this.dragDepth--
      if (this.dragDepth <= 0) {
        this.dragDepth = 0
        this.overlay.classList.remove('visible')
      }
    })

    this.listen(window, 'drop', async (event) => {
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

  renderEcology(ecologyDocument) {
    this.seedList.replaceChildren()
    for (const type of SEED_TYPES) {
      const count = ecologyDocument.inventory[type.id]
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'seed-card'
      button.dataset.seedType = type.id
      button.dataset.selected = String(ecologyDocument.selectedSeed === type.id)
      button.dataset.empty = String(count === 0)
      const swatch = document.createElement('span')
      swatch.className = 'seed-swatch'
      swatch.style.background = type.color
      const heading = document.createElement('strong')
      heading.textContent = type.label
      const quantity = document.createElement('span')
      quantity.className = 'seed-quantity'
      const planted = ecologyDocument.stats.plantedByType[type.id]
      const found = ecologyDocument.stats.collectedByType[type.id]
      quantity.textContent = count ? `${count} available · ${planted} planted` : found ? `0 available · ${planted} planted` : 'Not discovered'
      const description = document.createElement('small')
      description.textContent = type.description
      button.append(swatch, heading, quantity, description)
      this.seedList.append(button)
    }
    const stats = [
      ['Bags found', ecologyDocument.stats.bagsCollected],
      ['Seeds planted', ecologyDocument.stats.seedsPlanted],
      ['Fully grown', ecologyDocument.stats.plantsMatured],
      ['Sunlight gathered', `${Math.floor(ecologyDocument.stats.sunlightSeconds / 60)} min`]
    ]
    this.ecologyStats.replaceChildren(...stats.flatMap(([label, value]) => {
      const term = document.createElement('dt')
      term.textContent = label
      const detail = document.createElement('dd')
      detail.textContent = value
      return [term, detail]
    }))
  }

  open() {
    if (!this.dialog.open) this.dialog.showModal()
  }

  openInventory() {
    if (!this.inventoryDialog.open) this.inventoryDialog.showModal()
  }

  setInteraction(message) {
    this.interaction.textContent = message
  }

  setPlantingBeacons(beacons) {
    const active = new Set(beacons.map(({ id }) => id))
    for (const [id, element] of this.beaconElements) {
      if (active.has(id)) continue
      element.remove()
      this.beaconElements.delete(id)
    }
    for (const beacon of beacons) {
      let element = this.beaconElements.get(beacon.id)
      if (!element) {
        element = document.createElement('div')
        element.className = 'planting-beacon'
        const mark = document.createElement('span')
        mark.className = 'beacon-mark'
        const distance = document.createElement('span')
        distance.className = 'beacon-distance'
        element.append(mark, distance)
        this.plantingBeacons.append(element)
        this.beaconElements.set(beacon.id, element)
      }
      element.style.left = `${beacon.x}px`
      element.style.top = `${beacon.y}px`
      element.querySelector('.beacon-distance').textContent = beacon.planted
        ? `${beacon.label} · ${Math.round(beacon.distance)} m`
        : `${Math.round(beacon.distance)} m`
      element.classList.toggle('edge', beacon.edge)
      element.classList.toggle('known', beacon.known)
      element.classList.toggle('planted', beacon.planted)
    }
    this.plantingBeacons.setAttribute('aria-hidden', String(!beacons.length))
  }

  notify(message) {
    this.noticeElement.textContent = message
    this.noticeElement.classList.add('visible')
    clearTimeout(this.noticeTimer)
    this.noticeTimer = setTimeout(() => this.noticeElement.classList.remove('visible'), 4200)
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

  dispose() {
    this.unsubscribeQuality?.()
    this.unsubscribeEcology?.()
    clearTimeout(this.noticeTimer)
    for (const [target, type, listener, options] of this.listeners) {
      target.removeEventListener(type, listener, options)
    }
    this.listeners.length = 0
  }
}
