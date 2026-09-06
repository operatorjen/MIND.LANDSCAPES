export const MAX_IMAGES = 32
export const MAX_FILE_BYTES = 16 * 1024 * 1024
const MAX_PACK_BYTES = 128 * 1024 * 1024
export const isArtImage = name => /\.(png|jpe?g)$/i.test(name) && !name.split('/').some(part => part.startsWith('.')) && !name.startsWith('__MACOSX/')

export async function readArtZip(file) {
  if (file.size > MAX_PACK_BYTES) throw new Error('ZIP files must be smaller than 128 MB.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const view = new DataView(bytes.buffer)
  const u16 = p => view.getUint16(p, true)
  const u32 = p => view.getUint32(p, true)
  let end = bytes.length - 22
  for (; end >= Math.max(0, bytes.length - 65557); end--) {
    if (u32(end) === 0x06054b50 && end + 22 + u16(end + 20) === bytes.length) break
  }
  if (end < 0 || u32(end) !== 0x06054b50) throw new Error('This is not a readable ZIP archive.')
  if (u16(end + 4) || u16(end + 6) || u16(end + 10) === 65535) throw new Error('Split and ZIP64 archives are not supported.')
  let pos = u32(end + 16), total = 0
  const files = []
  for (let i = 0; i < u16(end + 10); i++) {
    if (pos + 46 > end || u32(pos) !== 0x02014b50) throw new Error('The ZIP directory is damaged.')
    const flags = u16(pos + 8), method = u16(pos + 10), compressed = u32(pos + 20), size = u32(pos + 24)
    const name = new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + u16(pos + 28)))
    const local = u32(pos + 42)
    pos += 46 + u16(pos + 28) + u16(pos + 30) + u16(pos + 32)
    if (!isArtImage(name)) continue
    if (files.length >= MAX_IMAGES) throw new Error('Use a pack with at most 32 PNG or JPEG images.')
    total += size
    if (size > MAX_FILE_BYTES || total > MAX_PACK_BYTES) throw new Error('Images must be under 16 MB each and 128 MB total.')
    if (flags & 1 || ![0, 8].includes(method)) throw new Error('Use an unencrypted ZIP with standard compression.')
    if (local + 30 > bytes.length || u32(local) !== 0x04034b50) throw new Error('The ZIP image header is damaged.')
    const start = local + 30 + u16(local + 26) + u16(local + 28)
    if (start + compressed > bytes.length) throw new Error('The ZIP image is incomplete.')
    let blob = new Blob([bytes.subarray(start, start + compressed)])
    if (method === 8) {
      const reader = blob.stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader()
      const chunks = []; let length = 0
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          length += value.length
          if (length > size || length > MAX_FILE_BYTES) throw new Error('The ZIP image exceeds its declared size.')
          chunks.push(value)
        }
      } catch (error) { await reader.cancel().catch(() => {}); throw error }
      blob = new Blob(chunks)
    }
    if (blob.size !== size) throw new Error('The ZIP image size is invalid.')
    files.push(new File([blob], name, { type: /\.png$/i.test(name) ? 'image/png' : 'image/jpeg' }))
  }
  return files
}

export async function collectArtFiles(selection) {
  let files = []
  for (const file of selection) {
    if (/\.zip$/i.test(file.name)) files.push(...await readArtZip(file))
    else if (isArtImage(file.webkitRelativePath || file.name)) files.push(file)
    if (files.length > MAX_IMAGES) throw new Error('Import at most 32 images at a time.')
    if (files.reduce((n, image) => n + image.size, 0) > MAX_PACK_BYTES) throw new Error('Images must be under 128 MB total.')
  }
  if (!files.length) throw new Error('Choose a folder, ZIP, or files containing PNG or JPEG images.')
  if (files.length > MAX_IMAGES) throw new Error('Import at most 32 images at a time.')
  if (files.some(file => file.size > MAX_FILE_BYTES) || files.reduce((n, file) => n + file.size, 0) > MAX_PACK_BYTES) throw new Error('Images must be under 16 MB each and 128 MB total.')
  return files.sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name))
}
