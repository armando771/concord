import { describe, expect, it } from 'vitest'
import {
  boxClassName,
  dragLayout,
  hintPlacement,
  hintPositionClass,
  startBoxDrag,
  type BoxDragStart
} from './overlayDrag'
import { OVERLAY_DEFAULT_LAYOUT } from './overlayLayout'

const area = { width: 1920, height: 1000 }
const box = { width: 200, height: 100 }

const start = (over: Partial<BoxDragStart> = {}): BoxDragStart => ({
  mode: 'move',
  pointerId: 1,
  x: 50,
  y: 60,
  pos: { left: 100, top: 200 },
  box,
  layout: { position: { x: 0.1, y: 0.2 }, scale: 1 },
  area,
  saved: OVERLAY_DEFAULT_LAYOUT,
  ...over
})

describe('startBoxDrag', () => {
  it('guarda de onde o ponteiro saiu e o layout salvo', () => {
    const d = startBoxDrag(start())
    expect(d).toMatchObject({
      mode: 'move',
      pointerId: 1,
      x0: 50,
      y0: 60,
      base: OVERLAY_DEFAULT_LAYOUT
    })
    expect(d.startLayout.position).toEqual({ x: 0.1, y: 0.2 })
  })

  it('sem posição salva, segura o canto onde a caixa está', () => {
    const d = startBoxDrag(start({ layout: { position: null, scale: 1.2 } }))
    expect(d.startLayout.position).toEqual({ x: 0.0521, y: 0.2 })
    expect(d.startLayout.scale).toBe(1.2)
  })
})

describe('dragLayout', () => {
  it('mover muda a posição e mantém a escala', () => {
    const d = startBoxDrag(start())
    const next = dragLayout(d, 96, 0, area)
    expect(next.scale).toBe(1)
    expect(next.position!.x).toBeGreaterThan(0.1)
    expect(next.position!.y).toBeCloseTo(0.2, 3)
  })

  it('redimensionar muda a escala e mantém a posição', () => {
    const d = startBoxDrag(start({ mode: 'resize' }))
    const next = dragLayout(d, 100, 50, area)
    expect(next.position).toEqual({ x: 0.1, y: 0.2 })
    expect(next.scale).toBeGreaterThan(1)
  })
})

describe('hintPlacement', () => {
  it('embaixo se couber, à esquerda na metade esquerda', () => {
    expect(hintPlacement({ left: 10, top: 100 }, box, area)).toEqual({ below: true, right: false })
  })

  it('em cima perto do fim da tela, à direita na metade direita', () => {
    expect(hintPlacement({ left: 1700, top: 900 }, box, area)).toEqual({
      below: false,
      right: true
    })
  })
})

describe('hintPositionClass', () => {
  it('traduz a posição da dica em classes', () => {
    expect(hintPositionClass({ left: 10, top: 100 }, box, area)).toBe('top-full mt-3 left-0')
    expect(hintPositionClass({ left: 1700, top: 900 }, box, area)).toBe('bottom-full mb-3 right-0')
  })
})

describe('boxClassName', () => {
  it('editando ganha moldura tracejada; fora dela a borda é transparente', () => {
    expect(boxClassName(true)).toContain('border-dashed')
    expect(boxClassName(false)).toContain('border-transparent')
    expect(boxClassName(false)).toContain('w-max')
  })
})
