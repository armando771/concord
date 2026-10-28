import { createHash } from 'crypto'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PiperAsset } from './piperAssets'
import { downloadVerified } from './verifiedDownload'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tts-dl-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const data = Buffer.from('conteúdo da voz')
const asset = (over: Partial<PiperAsset> = {}): PiperAsset => ({
  name: 'voz.onnx',
  url: 'https://x/voz.onnx',
  sha256: createHash('sha256').update(data).digest('hex'),
  size: data.length,
  extract: false,
  ...over
})
const serve =
  (body: Buffer, status = 200) =>
  async () =>
    new Response(new Uint8Array(body), { status })

describe('downloadVerified', () => {
  it('grava o arquivo e conta os bytes recebidos', async () => {
    const onBytes = vi.fn()
    const file = join(dir, 'voz.onnx')
    await downloadVerified(serve(data), asset(), file, onBytes)
    expect(readFileSync(file)).toEqual(data)
    expect(onBytes.mock.calls.reduce((n, [b]) => n + b, 0)).toBe(data.length)
  })

  it('sha256 diferente: erro', async () => {
    await expect(
      downloadVerified(serve(data), asset({ sha256: '0'.repeat(64) }), join(dir, 'a'), () => {})
    ).rejects.toThrow('sha256')
  })

  it('maior que o tamanho fixo: para no meio', async () => {
    await expect(
      downloadVerified(serve(data), asset({ size: 3 }), join(dir, 'a'), () => {})
    ).rejects.toThrow('tamanho')
  })

  it('menor que o tamanho fixo: erro', async () => {
    await expect(
      downloadVerified(serve(data), asset({ size: data.length + 1 }), join(dir, 'a'), () => {})
    ).rejects.toThrow('tamanho')
  })

  it('HTTP de erro: erro', async () => {
    await expect(
      downloadVerified(serve(data, 404), asset(), join(dir, 'a'), () => {})
    ).rejects.toThrow('HTTP 404')
  })
})
