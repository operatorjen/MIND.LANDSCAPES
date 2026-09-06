import test from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import { collectArtFiles, readArtZip } from '../src/art/import.js'

function zip(name, content, method = 0, flags = 0) {
  const nameBytes = Buffer.from(name), raw = Buffer.from(content)
  const data = method === 8 ? deflateRawSync(raw) : raw
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50); local.writeUInt16LE(nameBytes.length, 26)
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50); central.writeUInt16LE(flags, 8); central.writeUInt16LE(method, 10)
  central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(nameBytes.length, 28)
  const directory = Buffer.concat([central, nameBytes])
  const body = Buffer.concat([local, nameBytes, data])
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10)
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(body.length, 16)
  return new File([body, directory, end], 'art.zip')
}

test('ZIP reader handles nested stored and deflated images', async () => {
  for (const method of [0, 8]) {
    const [file] = await readArtZip(zip('hallways/ART.PNG', 'pixels', method))
    assert.equal(file.name, 'hallways/ART.PNG')
    assert.equal(await file.text(), 'pixels')
  }
})
test('ZIP reader rejects broken and encrypted archives and ignores metadata', async () => {
  await assert.rejects(readArtZip(new File(['bad'], 'art.zip')))
  await assert.rejects(readArtZip(zip('art.png', 'pixels', 0, 1)), /unencrypted/)
  assert.deepEqual(await readArtZip(zip('__MACOSX/._art.png', 'metadata')), [])
  assert.deepEqual(await readArtZip(zip('notes.txt', 'text')), [])
})
test('art collection filters non-images, sorts, and enforces pack limits', async () => {
  const files = await collectArtFiles([new File([''], 'z.jpg'), new File([''], 'a.PNG'), new File([''], 'notes.txt')])
  assert.deepEqual(files.map(file => file.name), ['a.PNG', 'z.jpg'])
  await assert.rejects(collectArtFiles(Array.from({ length: 33 }, (_, i) => new File([''], `${i}.png`))), /32/)
  await assert.rejects(collectArtFiles([new File([''], 'notes.txt')]), /PNG/)
})

test('ZIP reader bounds declared image size and catches truncated payloads', async () => {
  const bytes = new Uint8Array(await zip('art.png', 'pixels', 8).arrayBuffer())
  const view = new DataView(bytes.buffer)
  const directory = view.getUint32(bytes.length - 6, true)
  view.setUint32(directory + 24, 17 * 1024 * 1024, true)
  await assert.rejects(readArtZip(new File([bytes], 'large.zip')), /16 MB/)
  view.setUint32(directory + 24, 2, true)
  await assert.rejects(readArtZip(new File([bytes], 'lying.zip')), /declared size/)
  view.setUint32(directory + 24, 6, true)
  view.setUint32(directory + 20, bytes.length * 2, true)
  await assert.rejects(readArtZip(new File([bytes], 'truncated.zip')), /incomplete/)
})
