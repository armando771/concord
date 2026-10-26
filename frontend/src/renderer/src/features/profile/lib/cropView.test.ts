import { beforeEach, describe, expect, it, vi } from 'vitest'

const cropMedia = vi.fn()
vi.mock('./cropMedia', () => ({ cropMedia: (...args: unknown[]) => cropMedia(...args) }))

import { dragOffset, fitFrame, imagePlacement, runCrop, type CropRequest } from './cropView'

const frame = { width: 300, height: 300 }

describe('imagePlacement', () => {
  it('imagem quadrada, zoom 1: preenche o quadro', () => {
    expect(imagePlacement({ width: 600, height: 600 }, frame, 1, { x: 0, y: 0 })).toEqual({
      width: 300,
      height: 300,
      left: 0,
      top: 0
    })
  })

  it('paisagem fica centralizada e o arrasto desloca', () => {
    const natural = { width: 600, height: 300 }
    expect(imagePlacement(natural, frame, 1, { x: 0, y: 0 })).toMatchObject({
      width: 600,
      left: -150
    })
    expect(imagePlacement(natural, frame, 1, { x: 40, y: 0 }).left).toBe(-110)
  })
})

describe('dragOffset', () => {
  it('soma o deslocamento do ponteiro à posição inicial, sem passar da borda', () => {
    const natural = { width: 600, height: 300 }
    const drag = { start: { x: 100, y: 100 }, from: { x: 0, y: 0 } }
    expect(dragOffset(natural, frame, 1, drag, { x: 130, y: 500 })).toEqual({ x: 30, y: 0 })
    expect(dragOffset(natural, frame, 1, drag, { x: 900, y: 100 })).toEqual({ x: 150, y: 0 })
  })
})

describe('fitFrame', () => {
  it('tela larga: quadro inteiro', () => {
    const banner = { width: 476, height: 168 }
    expect(fitFrame(banner, 1280)).toBe(banner)
  })

  it('360 px: encolhe mantendo a proporção', () => {
    const fitted = fitFrame({ width: 476, height: 168 }, 360)
    expect(fitted.width).toBe(296)
    expect(fitted.width / fitted.height).toBeCloseTo(476 / 168, 1)
  })
})

describe('runCrop', () => {
  const request = {
    file: new File(['x'], 'a.gif', { type: 'image/gif' }),
    image: {} as HTMLImageElement,
    natural: { width: 600, height: 600 },
    frame,
    zoom: 1,
    offset: { x: 0, y: 0 },
    out: { width: 512, height: 512 }
  } satisfies CropRequest

  beforeEach(() => cropMedia.mockReset())

  it('entrega o recorte com o retângulo de origem calculado', async () => {
    const change = { kind: 'set' }
    cropMedia.mockResolvedValue(change)
    const onApply = vi.fn()
    const onError = vi.fn()
    await runCrop(request, onApply, onError)
    expect(cropMedia).toHaveBeenCalledWith(
      request.file,
      request.image,
      { sx: 0, sy: 0, sw: 600, sh: 600 },
      request.out
    )
    expect(onApply).toHaveBeenCalledWith(change)
    expect(onError).not.toHaveBeenCalled()
  })

  it('falha vira a mensagem do erro', async () => {
    cropMedia.mockImplementation(() => Promise.reject(new Error('GIF grande demais')))
    const onError = vi.fn()
    await runCrop(request, vi.fn(), onError)
    expect(onError).toHaveBeenCalledWith('GIF grande demais')
  })

  it('erro sem mensagem usa o texto padrão', async () => {
    cropMedia.mockImplementation(() => Promise.reject('boom'))
    const onError = vi.fn()
    await runCrop(request, vi.fn(), onError)
    expect(onError).toHaveBeenCalledWith('Não foi possível usar essa imagem.')
  })
})
