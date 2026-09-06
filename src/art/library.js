import { collectArtFiles } from './import.js'

export const ART_TILE = 256
export const ART_COLUMNS = 8
export const ART_ROWS = 4

export async function buildArtPack(selection) {
  const files = await collectArtFiles(selection)
  const canvas = document.createElement('canvas')
  canvas.width = ART_TILE * ART_COLUMNS
  canvas.height = ART_TILE * ART_ROWS
  const ctx = canvas.getContext('2d')
  const names = []
  for (let i = 0; i < files.length; i++) {
    const bitmap = await createImageBitmap(files[i])
    try {
      if (bitmap.width * bitmap.height > 64000000) throw new Error('Images must be smaller than 64 megapixels.')
      const scale = Math.min((ART_TILE - 12) / bitmap.width, (ART_TILE - 12) / bitmap.height)
      const width = bitmap.width * scale, height = bitmap.height * scale
      ctx.drawImage(bitmap, (i % ART_COLUMNS) * ART_TILE + (ART_TILE - width) / 2, Math.floor(i / ART_COLUMNS) * ART_TILE + (ART_TILE - height) / 2, width, height)
      names.push(files[i].name.split('/').pop())
    } finally { bitmap.close() }
  }
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not prepare the art images.')
  return { blob, names, enabled: true, density: 0.7 }
}

export async function artStorage(mode, value) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('mind-landscape-personal-art', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('art')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('art', mode === 'get' ? 'readonly' : 'readwrite')
      const store = transaction.objectStore('art')
      const request = mode === 'get' ? store.get('pack') : value ? store.put(value, 'pack') : store.delete('pack')
      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error || new Error('Art storage was interrupted.'))
    })
  } finally { db.close() }
}
