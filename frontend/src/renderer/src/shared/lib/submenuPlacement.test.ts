import { describe, expect, it } from 'vitest'
import {
  isHeadingToPanel,
  placeSubmenu,
  pointInTriangle,
  submenuPanelStyle,
  SUBMENU_WIDTH,
  type Box
} from './submenuPlacement'

const viewport = { width: 1280, height: 720 }
// Menu pai de 232 px; o item que abre o submenu está na linha de y=200..232.
const parentAt = (left: number): Box => ({ left, top: 150, right: left + 232, bottom: 420 })
const trigger = (left: number): Box => ({
  left: left + 8,
  top: 200,
  right: left + 224,
  bottom: 232
})

describe('placeSubmenu', () => {
  it('abre à direita do menu, alinhado ao item', () => {
    const p = placeSubmenu({ trigger: trigger(100), parent: parentAt(100), height: 200, viewport })
    expect(p.side).toBe('right')
    expect(p.width).toBe(SUBMENU_WIDTH)
    expect(p.left).toBe(330) // borda direita do menu (332) com 2px de sobreposição
    expect(p.top).toBe(191) // 9px acima do item: borda + padding do painel
  })

  it('inverte para a esquerda quando não cabe à direita', () => {
    const p = placeSubmenu({
      trigger: trigger(1000),
      parent: parentAt(1000),
      height: 200,
      viewport
    })
    expect(p.side).toBe('left')
    expect(p.left).toBe(1000 + 2 - SUBMENU_WIDTH)
  })

  it('cobre o menu quando não cabe em nenhum dos lados (celular)', () => {
    const phone = { width: 360, height: 640 }
    const p = placeSubmenu({
      trigger: trigger(64),
      parent: parentAt(64),
      height: 200,
      viewport: phone
    })
    expect(p.side).toBe('overlay')
    expect(p.left).toBe(64)
    expect(p.width).toBe(232)
    expect(p.top).toBe(150)
  })

  it('sobe para não sair pela base da tela', () => {
    const p = placeSubmenu({
      trigger: { left: 108, top: 600, right: 324, bottom: 632 },
      parent: parentAt(100),
      height: 300,
      viewport
    })
    expect(p.top).toBe(720 - 8 - 300)
  })

  it('nunca passa da margem de cima', () => {
    const p = placeSubmenu({
      trigger: { left: 108, top: 10, right: 324, bottom: 42 },
      parent: parentAt(100),
      height: 200,
      viewport
    })
    expect(p.top).toBe(8)
  })
})

describe('pointInTriangle', () => {
  const a = { x: 0, y: 0 }
  const b = { x: 10, y: 0 }
  const c = { x: 0, y: 10 }
  it('aceita ponto dentro e na borda', () => {
    expect(pointInTriangle({ x: 2, y: 2 }, a, b, c)).toBe(true)
    expect(pointInTriangle({ x: 5, y: 0 }, a, b, c)).toBe(true)
  })
  it('recusa ponto fora, em qualquer orientação', () => {
    expect(pointInTriangle({ x: 9, y: 9 }, a, b, c)).toBe(false)
    expect(pointInTriangle({ x: 2, y: 2 }, a, c, b)).toBe(true)
    expect(pointInTriangle({ x: -1, y: 1 }, a, c, b)).toBe(false)
  })
})

describe('isHeadingToPanel', () => {
  const panel: Box = { left: 332, top: 100, right: 556, bottom: 400 }
  it('é verdade quando o mouse vai na diagonal em direção ao painel', () => {
    expect(isHeadingToPanel({ x: 250, y: 215 }, { x: 300, y: 240 }, panel, 'right')).toBe(true)
  })
  it('é falso quando o mouse desce para o item de baixo', () => {
    expect(isHeadingToPanel({ x: 250, y: 215 }, { x: 252, y: 450 }, panel, 'right')).toBe(false)
  })
  it('funciona com o painel à esquerda', () => {
    const left: Box = { left: -124, top: 100, right: 100, bottom: 400 }
    expect(isHeadingToPanel({ x: 150, y: 215 }, { x: 110, y: 230 }, left, 'left')).toBe(true)
  })
  it('é falso sem posição anterior ou no modo que cobre o menu', () => {
    expect(isHeadingToPanel(null, { x: 300, y: 240 }, panel, 'right')).toBe(false)
    expect(isHeadingToPanel({ x: 250, y: 215 }, { x: 300, y: 240 }, panel, 'overlay')).toBe(false)
  })
})

describe('submenuPanelStyle', () => {
  it('antes de medir, fica no canto com a largura padrão (nunca oculto: oculto não recebe foco)', () => {
    expect(submenuPanelStyle(null)).toEqual({ left: 0, top: 0, width: SUBMENU_WIDTH })
  })
  it('depois de medir, usa a posição calculada', () => {
    expect(submenuPanelStyle({ side: 'left', left: 10, top: 20, width: 232 })).toEqual({
      left: 10,
      top: 20,
      width: 232
    })
  })
})
