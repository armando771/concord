import { describe, expect, it } from 'vitest'
import {
  clampWidth,
  dragBoundsFor,
  dragWidth,
  keyStepWidth,
  layoutSidebarWidths,
  parseStoredWidth,
  SIDEBARS,
  type SidebarLayoutInput
} from './sidebarWidth'

const bounds = { min: 200, max: 420 }

describe('clampWidth', () => {
  it('fica entre o mínimo e o máximo e arredonda', () => {
    expect(clampWidth(100, bounds)).toBe(200)
    expect(clampWidth(999, bounds)).toBe(420)
    expect(clampWidth(300.6, bounds)).toBe(301)
  })

  it('valor inválido vira o mínimo', () => {
    expect(clampWidth(Number.NaN, bounds)).toBe(200)
  })
})

describe('dragWidth', () => {
  it('barra da esquerda cresce ao arrastar para a direita', () => {
    expect(dragWidth(240, 30, 'left', bounds)).toBe(270)
    expect(dragWidth(240, -100, 'left', bounds)).toBe(200)
  })

  it('barra da direita cresce ao arrastar para a esquerda', () => {
    expect(dragWidth(256, -40, 'right', bounds)).toBe(296)
    expect(dragWidth(256, 400, 'right', bounds)).toBe(200)
  })
})

describe('keyStepWidth', () => {
  it('setas mudam 16 px, na direção da borda', () => {
    expect(keyStepWidth(240, 'ArrowRight', 'left', bounds)).toBe(256)
    expect(keyStepWidth(240, 'ArrowLeft', 'left', bounds)).toBe(224)
    expect(keyStepWidth(256, 'ArrowLeft', 'right', bounds)).toBe(272)
    expect(keyStepWidth(256, 'ArrowRight', 'right', bounds)).toBe(240)
  })

  it('respeita os limites e aceita Home/End', () => {
    expect(keyStepWidth(410, 'ArrowRight', 'left', bounds)).toBe(420)
    expect(keyStepWidth(205, 'ArrowLeft', 'left', bounds)).toBe(200)
    expect(keyStepWidth(300, 'Home', 'left', bounds)).toBe(200)
    expect(keyStepWidth(300, 'End', 'left', bounds)).toBe(420)
  })

  it('outras teclas não fazem nada', () => {
    expect(keyStepWidth(240, 'Enter', 'left', bounds)).toBeNull()
    expect(keyStepWidth(240, 'ArrowUp', 'left', bounds)).toBeNull()
  })
})

describe('parseStoredWidth', () => {
  const spec = SIDEBARS.channels
  it('lê o número salvo, dentro dos limites', () => {
    expect(parseStoredWidth('300', spec)).toBe(300)
    expect(parseStoredWidth('9999', spec)).toBe(spec.max)
  })

  it('nada salvo ou lixo volta ao padrão', () => {
    expect(parseStoredWidth(null, spec)).toBe(spec.defaultWidth)
    expect(parseStoredWidth('abc', spec)).toBe(spec.defaultWidth)
    expect(parseStoredWidth('', spec)).toBe(spec.defaultWidth)
  })
})

const input = (over: Partial<SidebarLayoutInput> = {}): SidebarLayoutInput => ({
  viewport: 1600,
  preferred: { channels: 300, members: 300 },
  mounted: { channels: true, members: true },
  ...over
})

describe('layoutSidebarWidths', () => {
  it('com espaço, usa a preferência', () => {
    expect(layoutSidebarWidths(input())).toEqual({ channels: 300, members: 300 })
  })

  it('janela estreita encolhe primeiro a lista de membros, depois os canais', () => {
    // 72 (trilho) + 360 (conteúdo) + 300 + 300 = 1032: cabe em 1100
    expect(layoutSidebarWidths(input({ viewport: 1100 }))).toEqual({
      channels: 300,
      members: 300
    })
    // 1024: sobra 1024-72-360 = 592 para as duas → membros 292
    expect(layoutSidebarWidths(input({ viewport: 1024 }))).toEqual({
      channels: 300,
      members: 292
    })
  })

  it('lista de membros escondida (abaixo de lg) não ocupa espaço', () => {
    // 900-72-360 = 468 → canais cabem inteiros
    expect(layoutSidebarWidths(input({ viewport: 900 }))).toEqual({
      channels: 300,
      members: 300
    })
    // 600-72-360 = 168 → canais no mínimo
    expect(layoutSidebarWidths(input({ viewport: 600 })).channels).toBe(200)
  })

  it('sem lista de membros montada, só os canais contam', () => {
    const r = layoutSidebarWidths(
      input({ viewport: 700, mounted: { channels: true, members: false } })
    )
    // 700-72-360 = 268
    expect(r.channels).toBe(268)
  })

  it('nunca abaixo do mínimo, mesmo sem espaço', () => {
    expect(
      layoutSidebarWidths(input({ viewport: 1024, preferred: { channels: 420, members: 400 } }))
    ).toEqual({ channels: 392, members: 200 })
  })
})

describe('dragBoundsFor', () => {
  it('máximo é o do painel quando há espaço', () => {
    expect(dragBoundsFor('channels', input())).toEqual({ min: 200, max: 420 })
  })

  it('máximo encolhe para manter o conteúdo com 360 px', () => {
    // 1100-72-360-300 (membros) = 368
    expect(dragBoundsFor('channels', input({ viewport: 1100 }))).toEqual({ min: 200, max: 368 })
    // 1100-72-360-300 (canais) = 368 → membros até 368
    expect(dragBoundsFor('members', input({ viewport: 1100 }))).toEqual({ min: 200, max: 368 })
  })

  it('máximo nunca fica abaixo do mínimo', () => {
    expect(dragBoundsFor('channels', input({ viewport: 500 }))).toEqual({ min: 200, max: 200 })
  })
})
