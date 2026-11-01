import { describe, expect, it } from 'vitest'
import {
  BG_MAX_FILE_BYTES,
  GIF_MAX_FILE_BYTES,
  fitWithin,
  imageFileToBackground,
  readBackgroundFile
} from './backgroundImage'

describe('fitWithin', () => {
  it('não amplia imagens pequenas', () => {
    expect(fitWithin(640, 360)).toEqual({ width: 640, height: 360 })
  })
  it('reduz mantendo a proporção', () => {
    expect(fitWithin(3840, 2160)).toEqual({ width: 960, height: 540 })
    expect(fitWithin(1000, 4000)).toEqual({ width: 135, height: 540 })
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

describe('readBackgroundFile', () => {
  it('GIF segue inteiro (a animação não sobrevive a reduzir)', async () => {
    const file = { type: 'image/gif', size: 1000 } as File
    const read = await readBackgroundFile(file)
    expect(read).toEqual({ kind: 'gif', blob: file })
  })
  it('GIF grande demais é recusado com a mensagem certa', async () => {
    const file = { type: 'image/gif', size: GIF_MAX_FILE_BYTES + 1 } as File
    await expect(readBackgroundFile(file)).rejects.toThrow(/GIF.*10 MB/)
  })
  it('o limite do GIF é maior que o das outras imagens? não: 10 MB é o teto', () => {
    expect(GIF_MAX_FILE_BYTES).toBe(10 * 1024 * 1024)
  })
  it('o que não é imagem continua recusado', async () => {
    await expect(readBackgroundFile({ type: 'text/plain', size: 1 } as File)).rejects.toThrow(
      /imagem/
    )
  })
})
