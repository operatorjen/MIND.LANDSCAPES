import { artStorage, buildArtPack } from '../art/library.js'

export class PersonalArt {
  constructor(atlas, ui) {
    this.atlas = atlas
    this.ui = ui
    this.section = document.querySelector('#personal-art')
    this.message = document.querySelector('#art-message')
    this.pack = null
    this.disposed = false
    this.busy = false
    if (!this.section) return
    for (const kind of ['folder', 'files']) {
      const input = document.querySelector(`#art-${kind}`)
      ui.listen(document.querySelector(`#art-${kind}-button`), 'click', () => input.click())
      ui.listen(input, 'change', () => { const files = [...input.files]; input.value = ''; if (files.length) this.import(files) })
    }
    ui.listen(document.querySelector('#art-clear'), 'click', () => this.change(null))
    ui.listen(document.querySelector('#art-enabled'), 'change', event => this.change(this.pack && { ...this.pack, enabled: event.target.checked }))
    ui.listen(document.querySelector('#art-density'), 'change', event => this.change(this.pack && { ...this.pack, density: Number(event.target.value) }))
  }

  async load() {
    this.setBusy(true)
    try {
      const pack = await artStorage('get')
      if (this.disposed) return
      if (pack) { await this.atlas.setPack(pack); this.pack = pack }
      this.render()
    } catch { this.say('Local art storage is unavailable. You can still import art for this visit.') }
    finally { this.setBusy(false) }
  }

  async import(files) {
    if (this.busy || this.disposed) return
    this.setBusy(true)
    this.say('Preparing wall art…')
    try {
      const pack = await buildArtPack(files)
      if (this.disposed) return
      await this.commit(pack)
    } catch (error) { this.say(`Could not import art: ${error.message}`) }
    finally { this.setBusy(false) }
  }

  async change(pack) {
    if (this.busy || this.disposed) return
    this.setBusy(true)
    try { await this.commit(pack) }
    catch (error) { this.say(error.message) }
    finally { this.setBusy(false) }
  }

  async commit(pack) {
    if (pack?.blob !== this.pack?.blob || !pack) await this.atlas.setPack(pack)
    else this.atlas.configure(pack)
    if (this.disposed) return
    this.pack = pack
    this.render()
    try { await artStorage('put', pack) }
    catch { this.say('Art updated for this visit, but browser storage could not save it. The previous saved pack may return on reload.') }
  }

  say(text) { if (this.message && !this.disposed) this.message.textContent = text }
  setBusy(value) {
    this.busy = value
    this.section?.querySelectorAll('button, input').forEach(control => { control.disabled = value })
  }
  render() {
    if (!this.section || this.disposed) return
    document.querySelector('#art-enabled').checked = this.pack?.enabled ?? true
    document.querySelector('#art-density').value = this.pack?.density ?? 0.7
    this.say(this.pack ? `${this.pack.names.length} images · ${this.pack.enabled ? 'on the walls' : 'hidden'}. Importing a pack replaces these images.` : 'No personal art added yet.')
    if (this.previewBlob === this.pack?.blob) return
    this.previewBlob = this.pack?.blob
    const preview = document.querySelector('#art-preview')
    preview.replaceChildren()
    if (this.previewURL) URL.revokeObjectURL(this.previewURL)
    this.previewURL = null
    if (this.pack) {
      this.previewURL = URL.createObjectURL(this.pack.blob)
      const image = document.createElement('img')
      image.src = this.previewURL
      image.alt = `Personal art: ${this.pack.names.join(', ')}`
      preview.append(image)
    }
  }
  dispose() { this.disposed = true; if (this.previewURL) URL.revokeObjectURL(this.previewURL) }
}
