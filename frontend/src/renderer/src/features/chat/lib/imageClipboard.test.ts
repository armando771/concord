import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../store/mediaToken', () => ({
  ensureMediaToken: vi.fn(),
  invalidateMediaToken: vi.fn()
}))

import { ensureMediaToken, invalidateMediaToken } from '../store/mediaToken'
import { copyImage } from './imageClipboard'

class FakeClipboardItem {
  constructor(readonly items: Record<string, Promise<Blob>>) {}
}

// Espera as promessas dos itens, como o navegador faz: erro delas vira erro do write.
const write = vi.fn(async (items: FakeClipboardItem[]) => {
  await Promise.all(Object.values(items[0].items))
})

const png = new Blob(['png'], { type: 'image/png' })

function response(
  ok: boolean,
  status: number,
  body: Blob = png
): { ok: boolean; status: number; blob: () => Promise<Blob> } {
  return { ok, status, blob: async () => body }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(ensureMediaToken).mockResolvedValue('tok')
  vi.stubGlobal('ClipboardItem', FakeClipboardItem)
  vi.stubGlobal('navigator', { clipboard: { write } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('copyImage', () => {
  it('PNG vai direto para o clipboard, sem conversão', async () => {
    const fetchMock = vi.fn(async () => response(true, 200))
    vi.stubGlobal('fetch', fetchMock)

    await copyImage('att-1', 'image/png')

    // Sem no-store, o cache do <img> (resposta sem CORS) pode ser reaproveitado.
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), { cache: 'no-store' })
    expect(write).toHaveBeenCalledTimes(1)
    const item = write.mock.calls[0][0][0]
    await expect(item.items['image/png']).resolves.toBe(png)
  })

  it('token recusado: pede outro e tenta de novo', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(false, 401))
      .mockResolvedValueOnce(response(true, 200))
    vi.stubGlobal('fetch', fetchMock)

    await copyImage('att-1', 'image/png')

    expect(invalidateMediaToken).toHaveBeenCalledWith('tok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('falha nas duas tentativas: o erro sobe e nada é copiado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(false, 403))
    )

    await expect(copyImage('att-1', 'image/png')).rejects.toThrow('403')
  })

  it('JPEG é convertido para PNG pelo canvas', async () => {
    const jpeg = new Blob(['jpg'], { type: 'image/jpeg' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(true, 200, jpeg))
    )
    const bitmap = { width: 10, height: 20, close: vi.fn() }
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap)
    )
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toBlob: (cb: (b: Blob) => void) => cb(png)
    }
    vi.stubGlobal('document', { createElement: vi.fn(() => canvas) })

    await copyImage('att-1', 'image/jpeg')

    expect(canvas.width).toBe(10)
    expect(canvas.height).toBe(20)
    expect(bitmap.close).toHaveBeenCalled()
    const item = write.mock.calls[0][0][0]
    await expect(item.items['image/png']).resolves.toBe(png)
  })
})
