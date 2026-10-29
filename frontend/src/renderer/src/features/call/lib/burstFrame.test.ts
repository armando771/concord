import { describe, expect, it } from 'vitest'
import { anchorFrame, clipRect, frameEquals, type Box } from './burstFrame'

const box = (left: number, top: number, width: number, height: number): Box => ({
  left,
  top,
  width,
  height
})
const VIEW = box(0, 0, 1000, 800)

describe('clipRect', () => {
  it('é a interseção da janela com os containers que cortam', () => {
    expect(clipRect(VIEW, [box(100, 50, 300, 400), box(0, 100, 250, 900)])).toEqual(
      box(100, 100, 150, 350)
    )
  })

  it('sem containers, é a própria janela', () => {
    expect(clipRect(VIEW, [])).toEqual(VIEW)
  })

  it('sem interseção, fica vazio', () => {
    const r = clipRect(VIEW, [box(0, 0, 100, 100), box(200, 200, 50, 50)])
    expect(r.width).toBe(0)
    expect(r.height).toBe(0)
  })
})

describe('anchorFrame', () => {
  it('visível quando o centro do avatar está dentro da área visível', () => {
    expect(anchorFrame(box(10, 10, 32, 32), VIEW)).toEqual({
      ...box(10, 10, 32, 32),
      visible: true
    })
  })

  it('escondido quando o avatar rolou para fora do container', () => {
    const list = box(0, 100, 240, 500)
    expect(anchorFrame(box(20, 60, 32, 32), list).visible).toBe(false)
    expect(anchorFrame(box(20, 620, 32, 32), list).visible).toBe(false)
  })

  it('escondido quando o avatar não tem tamanho (fora da tela / display none)', () => {
    expect(anchorFrame(box(0, 0, 0, 0), VIEW).visible).toBe(false)
  })
})

describe('frameEquals', () => {
  it('ignora diferenças de subpixel e compara a visibilidade', () => {
    const a = { ...box(10, 10, 32, 32), visible: true }
    expect(frameEquals(a, { ...a, left: 10.2 })).toBe(true)
    expect(frameEquals(a, { ...a, top: 12 })).toBe(false)
    expect(frameEquals(a, { ...a, visible: false })).toBe(false)
    expect(frameEquals(null, a)).toBe(false)
  })
})
