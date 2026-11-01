import { describe, expect, it } from 'vitest'
import {
  clampBoxToArea,
  clampOverlayScale,
  fractionToPixels,
  moveOverlayBox,
  normalizeOverlayLayout,
  OVERLAY_DEFAULT_LAYOUT,
  OVERLAY_EDGE_MARGIN,
  pixelsToFraction,
  placeOverlayBox,
  resizeOverlayScale,
  sameOverlayLayout,
  settleOverlayDraft,
  shownOverlayLayout
} from './overlayLayout'

const fullHd = { width: 1920, height: 1040 }
const box = { width: 200, height: 120 }

describe('clampOverlayScale', () => {
  it('fica entre 0,7× e 1,6×, em passos de 0,05', () => {
    expect(clampOverlayScale(1)).toBe(1)
    expect(clampOverlayScale(0.2)).toBe(0.7)
    expect(clampOverlayScale(3)).toBe(1.6)
    expect(clampOverlayScale(1.12)).toBe(1.1)
    expect(clampOverlayScale(1.13)).toBe(1.15)
  })

  it('valor estragado volta a 1×', () => {
    expect(clampOverlayScale(Number.NaN)).toBe(1)
    expect(clampOverlayScale(undefined as unknown as number)).toBe(1)
    expect(clampOverlayScale(Infinity)).toBe(1)
  })
})

describe('fração ↔ pixels', () => {
  it('fração da área de trabalho vira pixels inteiros', () => {
    expect(fractionToPixels({ x: 0.5, y: 0.25 }, fullHd)).toEqual({ left: 960, top: 260 })
    expect(fractionToPixels({ x: 0.1234, y: 0 }, fullHd)).toEqual({ left: 237, top: 0 })
  })

  it('pixels viram fração (4 casas)', () => {
    expect(pixelsToFraction({ left: 960, top: 260 }, fullHd)).toEqual({ x: 0.5, y: 0.25 })
    expect(pixelsToFraction({ left: 100, top: 100 }, { width: 3, height: 7 })).toEqual({
      x: 1,
      y: 1
    })
    expect(pixelsToFraction({ left: 1, top: 1 }, { width: 3, height: 3 })).toEqual({
      x: 0.3333,
      y: 0.3333
    })
  })

  it('ida e volta sobrevive a outra resolução', () => {
    const frac = pixelsToFraction({ left: 960, top: 520 }, fullHd)
    expect(fractionToPixels(frac, { width: 2560, height: 1400 })).toEqual({ left: 1280, top: 700 })
  })

  it('área vazia (janela ainda sem tamanho) não divide por zero', () => {
    expect(pixelsToFraction({ left: 10, top: 10 }, { width: 0, height: 0 })).toEqual({ x: 0, y: 0 })
  })
})

describe('clampBoxToArea', () => {
  it('dentro da área fica onde está', () => {
    expect(clampBoxToArea({ left: 300, top: 400 }, fullHd, box)).toEqual({ left: 300, top: 400 })
  })

  it('a caixa inteira fica sempre na tela', () => {
    expect(clampBoxToArea({ left: -50, top: -10 }, fullHd, box)).toEqual({ left: 0, top: 0 })
    expect(clampBoxToArea({ left: 1900, top: 1000 }, fullHd, box)).toEqual({
      left: 1720,
      top: 920
    })
  })

  it('caixa maior que a área encosta no canto de cima à esquerda', () => {
    expect(
      clampBoxToArea(
        { left: 50, top: 50 },
        { width: 100, height: 100 },
        { width: 300, height: 300 }
      )
    ).toEqual({ left: 0, top: 0 })
  })
})

describe('placeOverlayBox', () => {
  it('padrão: borda esquerda, no meio da altura', () => {
    expect(placeOverlayBox(null, fullHd, box)).toEqual({ left: OVERLAY_EDGE_MARGIN, top: 460 })
  })

  it('posição salva vira pixels e é encaixada na tela', () => {
    expect(placeOverlayBox({ x: 0.5, y: 0.25 }, fullHd, box)).toEqual({ left: 960, top: 260 })
    // Salva num monitor grande com a caixa no canto: num menor, continua inteira na tela.
    expect(placeOverlayBox({ x: 0.99, y: 0.99 }, { width: 1280, height: 680 }, box)).toEqual({
      left: 1080,
      top: 560
    })
  })
})

describe('moveOverlayBox', () => {
  it('arrastar soma o deslocamento e salva em fração', () => {
    expect(moveOverlayBox({ left: 100, top: 100 }, 860, 160, fullHd, box)).toEqual({
      x: 0.5,
      y: 0.25
    })
  })

  it('não deixa arrastar para fora da tela', () => {
    expect(moveOverlayBox({ left: 100, top: 100 }, -500, 5000, fullHd, box)).toEqual(
      pixelsToFraction({ left: 0, top: 920 }, fullHd)
    )
  })
})

describe('resizeOverlayScale', () => {
  it('puxar o canto para fora aumenta, para dentro diminui', () => {
    expect(resizeOverlayScale(1, box, 160, 96)).toBe(1.6)
    expect(resizeOverlayScale(1, box, 32, 32)).toBe(1.2)
    expect(resizeOverlayScale(1, box, -32, -32)).toBe(0.8)
  })

  it('parte da escala atual e respeita os limites', () => {
    expect(resizeOverlayScale(1.5, box, 0, 0)).toBe(1.5)
    expect(resizeOverlayScale(1, box, -1000, -1000)).toBe(0.7)
    expect(resizeOverlayScale(1, box, 1000, 1000)).toBe(1.6)
  })

  it('caixa sem tamanho não muda a escala', () => {
    expect(resizeOverlayScale(1.2, { width: 0, height: 0 }, 50, 50)).toBe(1.2)
  })
})

describe('normalizeOverlayLayout', () => {
  it('padrão: posição padrão e 1×', () => {
    expect(OVERLAY_DEFAULT_LAYOUT).toEqual({ position: null, scale: 1 })
    expect(normalizeOverlayLayout(undefined)).toEqual(OVERLAY_DEFAULT_LAYOUT)
    expect(normalizeOverlayLayout('lixo')).toEqual(OVERLAY_DEFAULT_LAYOUT)
  })

  it('mantém o que é válido e encaixa o resto', () => {
    expect(normalizeOverlayLayout({ position: { x: 0.25, y: 0.5 }, scale: 1.2 })).toEqual({
      position: { x: 0.25, y: 0.5 },
      scale: 1.2
    })
    expect(normalizeOverlayLayout({ position: { x: -1, y: 2 }, scale: 9 })).toEqual({
      position: { x: 0, y: 1 },
      scale: 1.6
    })
  })

  it('posição estragada volta ao padrão sem perder a escala', () => {
    expect(normalizeOverlayLayout({ position: { x: 'a', y: 0.5 }, scale: 0.8 })).toEqual({
      position: null,
      scale: 0.8
    })
    expect(normalizeOverlayLayout({ position: { x: Number.NaN, y: 0 } }).position).toBeNull()
  })
})

describe('sameOverlayLayout', () => {
  it('compara posição e escala', () => {
    const a = { position: { x: 0.1, y: 0.2 }, scale: 1 }
    expect(sameOverlayLayout(a, { position: { x: 0.1, y: 0.2 }, scale: 1 })).toBe(true)
    expect(sameOverlayLayout(a, { ...a, scale: 1.1 })).toBe(false)
    expect(sameOverlayLayout(a, OVERLAY_DEFAULT_LAYOUT)).toBe(false)
    expect(sameOverlayLayout(OVERLAY_DEFAULT_LAYOUT, { position: null, scale: 1 })).toBe(true)
  })
})

describe('shownOverlayLayout', () => {
  const old = { position: { x: 0.1, y: 0.1 }, scale: 1 }
  const dragged = { position: { x: 0.5, y: 0.5 }, scale: 1.2 }

  it('sem arraste, vale o salvo', () => {
    expect(shownOverlayLayout(old, null)).toBe(old)
  })

  it('arrastando (ou esperando salvar), vale o arraste', () => {
    expect(shownOverlayLayout(old, { layout: dragged, base: old })).toBe(dragged)
  })

  it('o salvo mudou (chegou o novo, ou "Restaurar posição"): vale o salvo', () => {
    expect(shownOverlayLayout(dragged, { layout: dragged, base: old })).toEqual(dragged)
    expect(shownOverlayLayout(OVERLAY_DEFAULT_LAYOUT, { layout: dragged, base: old })).toBe(
      OVERLAY_DEFAULT_LAYOUT
    )
  })
})

describe('settleOverlayDraft', () => {
  const old = { position: { x: 0.1, y: 0.1 }, scale: 1 }
  const dragged = { position: { x: 0.5, y: 0.5 }, scale: 1.2 }

  it('salvo ainda o de antes do arraste: continua valendo o arraste', () => {
    const draft = { layout: dragged, base: old }
    expect(settleOverlayDraft(old, draft)).toBe(draft)
  })

  it('o salvo mudou: o arraste acabou (e não volta se o salvo voltar ao de antes)', () => {
    const draft = { layout: dragged, base: old }
    const settled = settleOverlayDraft(dragged, draft)
    expect(settled).toBeNull()
    // "Restaurar posição" para exatamente o de antes do arraste: vale o salvo.
    expect(shownOverlayLayout(old, settled)).toBe(old)
  })

  it('sem arraste, nada', () => {
    expect(settleOverlayDraft(old, null)).toBeNull()
  })
})
