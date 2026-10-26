import { describe, expect, it } from 'vitest'
import { BG_MAX_FILE_BYTES, fitWithin, imageFileToBackground } from './chromaKeyImage'

describe('fitWithin', () => {
  it('não amplia imagens pequenas', () => {
    expect(fitWithin(640, 360)).toEqual({ width: 640, height: 360 })
  })
  it('reduz mantendo a proporção', () => {
    expect(fitWithin(3840, 2160)).toEqual({ width: 1280, height: 720 })
    expect(fitWithin(1000, 4000)).toEqual({ width: 180, height: 720 })
  })
  it('dimensão inválida dá 0x0', () => {
    expect(fitWithin(0, 100)).toEqual({ width: 0, height: 0 })
    expect(fitWithin(NaN, 100)).toEqual({ width: 0, height: 0 })
  })
})

describe('imageFileToBackground', () => {
  it('rejeita o que não é imagem', async () => {
    const file = { type: 'text/plain', size: 10 } as File
    await expect(imageFileToBackground(file)).rejects.toThrow(/imagem/)
  })
  it('rejeita arquivo grande demais', async () => {
    const file = { type: 'image/png', size: BG_MAX_FILE_BYTES + 1 } as File
    await expect(imageFileToBackground(file)).rejects.toThrow(/grande/)
  })
})
