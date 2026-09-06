import * as THREE from 'three'

export class ArtAtlas {
  constructor(uniforms) {
    this.uniforms = uniforms
    this.revision = 0
    this.texture = new THREE.DataTexture(new Uint8Array(4), 1, 1)
    this.texture.needsUpdate = true
    uniforms.uArtAtlas.value = this.texture
  }

  async setPack(pack) {
    const revision = ++this.revision
    let texture
    if (pack) {
      const bitmap = await createImageBitmap(pack.blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none' })
      if (revision !== this.revision) { bitmap.close(); return }
      texture = new THREE.Texture(bitmap)
      texture.flipY = false
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.generateMipmaps = false
      texture.needsUpdate = true
    } else {
      texture = new THREE.DataTexture(new Uint8Array(4), 1, 1)
      texture.needsUpdate = true
    }
    this.texture.dispose()
    this.texture.image?.close?.()
    this.texture = texture
    this.uniforms.uArtAtlas.value = texture
    this.configure(pack)
  }

  configure(pack) {
    this.uniforms.uArtCount.value = pack?.enabled ? pack.names.length : 0
    this.uniforms.uArtDensity.value = pack?.density ?? 0.7
  }

  dispose() {
    this.revision++
    this.texture.dispose()
    this.texture.image?.close?.()
  }
}
