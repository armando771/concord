import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clampMiniPlayer,
  DEFAULT_MINI_PLAYER_OFFSET,
  DRAG_THRESHOLD_PX,
  draggedOffset,
  isDrag,
  loadMiniPlayerOffset,
  MiniPlayerGesture,
  parseMiniPlayerOffset,
  saveMiniPlayerOffset
} from './miniPlayerPosition'

const size = { width: 288, height: 162 }
const viewport = { width: 1280, height: 800, top: 32 }

describe('clampMiniPlayer', () => {
  it('posição que cabe fica como está', () => {
    expect(clampMiniPlayer({ right: 16, bottom: 96 }, size, viewport)).toEqual({
      right: 16,
      bottom: 96
    })
  })

  it('não passa das bordas da janela (inteira à vista)', () => {
    expect(clampMiniPlayer({ right: -50, bottom: -10 }, size, viewport)).toEqual({
      right: 0,
      bottom: 0
    })
    expect(clampMiniPlayer({ right: 5000, bottom: 5000 }, size, viewport)).toEqual({
      right: 1280 - 288,
      bottom: 800 - 32 - 162
    })
  })

  it('não fica embaixo da barra de título', () => {
    const { bottom } = clampMiniPlayer({ right: 0, bottom: 5000 }, size, viewport)
    // topo do mini-player = altura - bottom - altura dele
    expect(800 - bottom - 162).toBe(32)
  })

  it('janela encolheu: puxa de volta para dentro', () => {
    const saved = { right: 900, bottom: 500 }
    const small = { width: 960, height: 640, top: 32 }
    expect(clampMiniPlayer(saved, size, small)).toEqual({
      right: 960 - 288,
      bottom: 640 - 32 - 162
    })
  })

  it('janela menor que o mini-player: encosta no canto', () => {
    expect(
      clampMiniPlayer({ right: 40, bottom: 40 }, size, { width: 200, height: 100, top: 0 })
    ).toEqual({
      right: 0,
      bottom: 0
    })
  })
})

describe('arrastar x clicar', () => {
  it('movimento pequeno ainda é clique', () => {
    expect(isDrag(0, 0)).toBe(false)
    expect(isDrag(2, 2)).toBe(false)
    expect(isDrag(DRAG_THRESHOLD_PX - 1, 0)).toBe(false)
  })

  it('passou de ~4 px é arrasto', () => {
    expect(DRAG_THRESHOLD_PX).toBe(4)
    expect(isDrag(4, 0)).toBe(true)
    expect(isDrag(0, -5)).toBe(true)
    expect(isDrag(3, 3)).toBe(true)
  })

  it('arrastar para a esquerda/cima aumenta a distância do canto inferior direito', () => {
    expect(draggedOffset({ right: 16, bottom: 96 }, -100, -40)).toEqual({ right: 116, bottom: 136 })
    expect(draggedOffset({ right: 16, bottom: 96 }, 10, 20)).toEqual({ right: 6, bottom: 76 })
  })
})

describe('posição salva', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lê só números válidos; o resto volta ao canto padrão', () => {
    expect(parseMiniPlayerOffset('{"right":40,"bottom":120}')).toEqual({ right: 40, bottom: 120 })
    expect(parseMiniPlayerOffset(null)).toEqual(DEFAULT_MINI_PLAYER_OFFSET)
    expect(parseMiniPlayerOffset('lixo')).toEqual(DEFAULT_MINI_PLAYER_OFFSET)
    expect(parseMiniPlayerOffset('{"right":"a","bottom":1}')).toEqual(DEFAULT_MINI_PLAYER_OFFSET)
    expect(parseMiniPlayerOffset('{"right":null,"bottom":1}')).toEqual(DEFAULT_MINI_PLAYER_OFFSET)
  })

  it('padrão é o canto de antes (bottom-24 right-4)', () => {
    expect(DEFAULT_MINI_PLAYER_OFFSET).toEqual({ right: 16, bottom: 96 })
  })

  it('salva e lê de volta', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v)
    })
    saveMiniPlayerOffset({ right: 300, bottom: 200 })
    expect(loadMiniPlayerOffset()).toEqual({ right: 300, bottom: 200 })
  })

  it('sem armazenamento não quebra', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      }
    })
    expect(() => saveMiniPlayerOffset({ right: 1, bottom: 1 })).not.toThrow()
    expect(loadMiniPlayerOffset()).toEqual(DEFAULT_MINI_PLAYER_OFFSET)
  })
})

describe('MiniPlayerGesture (arrastar sem perder o clique)', () => {
  const start = { right: 16, bottom: 96 }
  const identity = (o: { right: number; bottom: number }): typeof o => o

  it('clique sem mover: o click ativa (volta para a chamada)', () => {
    const g = new MiniPlayerGesture()
    g.down(1, 100, 100, start)
    g.move(1, 102, 101, identity)
    expect(g.end(1)).toBeNull()
    expect(g.dragging).toBe(false)
    expect(g.takeClick()).toBe(true)
  })

  it('arrasto de verdade: devolve a posição para salvar e engole o click seguinte', () => {
    const g = new MiniPlayerGesture()
    g.down(1, 100, 100, start)
    expect(g.move(1, 50, 60, identity)).toEqual({ right: 66, bottom: 136 })
    expect(g.dragging).toBe(true)
    expect(g.end(1)).toEqual({ right: 66, bottom: 136 })
    expect(g.dragging).toBe(false)
    expect(g.takeClick()).toBe(false)
    // só o click logo depois do arrasto é engolido
    expect(g.takeClick()).toBe(true)
  })

  it('click sem pointerdown (leitor de tela, teclado) sempre ativa', () => {
    expect(new MiniPlayerGesture().takeClick()).toBe(true)
  })

  it('o próximo pointerdown limpa um click engolido que não chegou', () => {
    const g = new MiniPlayerGesture()
    g.down(1, 0, 0, start)
    g.move(1, 30, 0, identity)
    g.end(1)
    g.down(2, 0, 0, start)
    g.end(2)
    expect(g.takeClick()).toBe(true)
  })

  it('aplica o reencaixe a cada movimento', () => {
    const g = new MiniPlayerGesture()
    g.down(1, 0, 0, start)
    expect(g.move(1, 500, 500, () => ({ right: 0, bottom: 0 }))).toEqual({ right: 0, bottom: 0 })
  })

  it('outro ponteiro não interfere', () => {
    const g = new MiniPlayerGesture()
    g.down(1, 0, 0, start)
    expect(g.move(2, 50, 50, identity)).toBeNull()
    expect(g.end(2)).toBeNull()
    expect(g.dragging).toBe(false)
  })

  it('captura perdida / player escondido no meio: solta o arrasto e guarda a última posição', () => {
    const g = new MiniPlayerGesture()
    g.down(1, 0, 0, start)
    g.move(1, -10, 0, identity)
    expect(g.end()).toEqual({ right: 26, bottom: 96 })
    expect(g.dragging).toBe(false)
    // nada mais pendente
    expect(g.end()).toBeNull()
    expect(g.move(1, -20, 0, identity)).toBeNull()
  })
})
