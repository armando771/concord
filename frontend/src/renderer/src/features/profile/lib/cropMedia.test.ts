import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cropMedia } from './cropMedia'

const rect = { sx: 0, sy: 0, sw: 100, sh: 100 }
const out = { width: 4, height: 4 }

let blobOk = true
let hasContext = true
const closed = { frames: 0, decoder: 0, bitmaps: 0 }

function fakeCanvas(): unknown {
  const canvas = {
    width: 0,
    height: 0,
    getContext: () =>
      hasContext
        ? {
            drawImage: vi.fn(),
            getImageData: () => ({
              data: new Uint8ClampedArray(canvas.width * canvas.height * 4).fill(200)
            })
          }
        : null,
    toBlob: (cb: (b: Blob | null) => void) => cb(blobOk ? new Blob(['webp']) : null)
  }
  return canvas
}

class FakeDecoder {
  tracks = { ready: Promise.resolve(), selectedTrack: { frameCount: 2 } }
  decode = async (): Promise<{ image: unknown }> => ({
    image: { duration: 50_000, close: () => closed.frames++ }
  })
  close = (): void => {
    closed.decoder++
  }
}

beforeEach(() => {
  blobOk = true
  hasContext = true
  closed.frames = closed.decoder = closed.bitmaps = 0
  vi.stubGlobal('document', { createElement: fakeCanvas })
  vi.stubGlobal('createImageBitmap', async () => ({
    width: 1000,
    height: 500,
    close: () => closed.bitmaps++
  }))
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prévia')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const png = new File(['x'], 'a.png', { type: 'image/png' })
const gif = new File(['x'], 'a.gif', { type: 'image/gif' })
const img = {} as HTMLImageElement

describe('cropMedia', () => {
  it('imagem comum vira um WebP parado', async () => {
    const change = await cropMedia(png, img, rect, out)
    expect(change).toMatchObject({ kind: 'set', animated: false, previewUrl: 'blob:prévia' })
    expect(change.staticFrame).toBeUndefined()
  })

  it('GIF com WebCodecs sai como GIF animado recortado, com quadro parado', async () => {
    vi.stubGlobal('ImageDecoder', FakeDecoder)
    const change = await cropMedia(gif, img, rect, out)
    expect(change.animated).toBe(true)
    expect(change.file.type).toBe('image/gif')
    expect(change.file).not.toBe(gif)
    const bytes = new Uint8Array(await change.file.arrayBuffer())
    expect(String.fromCharCode(...bytes.slice(0, 6))).toBe('GIF89a')
    expect([bytes[6], bytes[8]]).toEqual([4, 4])
    expect(change.staticFrame).toBeInstanceOf(Blob)
    // cada quadro e o decodificador são liberados
    expect(closed.frames).toBe(2)
    expect(closed.decoder).toBe(1)
  })

  it('GIF recortado não é ampliado além do pedaço do original (regressão: GIF inflava)', async () => {
    vi.stubGlobal('ImageDecoder', FakeDecoder)
    const piece = { sx: 10, sy: 0, sw: 40, sh: 40 }
    const change = await cropMedia(gif, img, piece, { width: 512, height: 512 })
    const bytes = new Uint8Array(await change.file.arrayBuffer())
    expect([bytes[6], bytes[8]]).toEqual([40, 40])
  })

  it('recorte que pega o GIF inteiro envia o original, sem reescrever', async () => {
    vi.stubGlobal('ImageDecoder', FakeDecoder)
    const whole = { naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement
    const change = await cropMedia(gif, whole, rect, { width: 512, height: 512 })
    expect(change).toMatchObject({ file: gif, animated: true })
    expect(change.staticFrame).toBeInstanceOf(Blob)
    expect(closed.decoder).toBe(0)
  })

  it('sem WebCodecs o GIF entra inteiro, como antes', async () => {
    vi.stubGlobal('ImageDecoder', undefined)
    const change = await cropMedia(gif, img, rect, out)
    expect(change).toMatchObject({ file: gif, animated: true })
    expect(change.staticFrame).toBeInstanceOf(Blob)
  })

  it('canvas sem contexto 2D falha com mensagem', async () => {
    hasContext = false
    await expect(cropMedia(png, img, rect, out)).rejects.toThrow('Não foi possível gerar a imagem.')
  })

  it('canvas que não gera o arquivo falha com mensagem', async () => {
    blobOk = false
    await expect(cropMedia(png, img, rect, out)).rejects.toThrow('Não foi possível gerar a imagem.')
  })
})
