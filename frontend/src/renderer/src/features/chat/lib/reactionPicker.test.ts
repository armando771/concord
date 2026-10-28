import { describe, expect, it } from 'vitest'
import { anchoredPickerStyle, toggleReactionPicker } from './reactionPicker'

describe('toggleReactionPicker', () => {
  it('aberto pelo "+" ao lado dos chips: guarda esse botão como âncora', () => {
    expect(toggleReactionPicker(null, 'botao-chip')).toEqual({ anchor: 'botao-chip' })
  })

  // Regressão: os dois botões dividiam um único "aberto" sem âncora, então o
  // seletor do "+" dos chips abria no canto direito, junto da barra de ações.
  it('aberto pela barra de ações: sem âncora (fica no canto da linha)', () => {
    expect(toggleReactionPicker(null, null)).toEqual({ anchor: null })
  })

  it('cada gatilho tem a sua âncora: quem abre depois não herda a do outro', () => {
    const doChip = toggleReactionPicker(null, 'botao-chip')
    expect(doChip).not.toBeNull()
    const fechado = toggleReactionPicker(doChip, null)
    expect(fechado).toBeNull()
    expect(toggleReactionPicker(fechado, null)).toEqual({ anchor: null })
  })

  it('clicar de novo no gatilho com o seletor aberto fecha', () => {
    expect(toggleReactionPicker({ anchor: 'botao-chip' }, 'botao-chip')).toBeNull()
  })
})

describe('anchoredPickerStyle', () => {
  const view = { width: 1000, height: 800 }
  const size = { width: 256, height: 300 }
  const rect = (left: number, top: number): { left: number; top: number; bottom: number } => ({
    left,
    top,
    bottom: top + 28
  })

  it('abre logo abaixo do botão, alinhado à esquerda dele', () => {
    expect(anchoredPickerStyle(rect(120, 200), size, view)).toEqual({ left: 120, top: 234 })
  })

  it('sem espaço embaixo, abre acima do botão', () => {
    expect(anchoredPickerStyle(rect(120, 700), size, view)).toEqual({ left: 120, bottom: 106 })
  })

  it('não estoura a borda direita: recua para caber na janela', () => {
    expect(anchoredPickerStyle(rect(900, 100), size, view).left).toBe(1000 - 256 - 8)
  })

  it('em tela estreita (360 px) fica dentro da janela', () => {
    const narrow = { width: 360, height: 640 }
    expect(anchoredPickerStyle(rect(300, 100), { width: 256, height: 300 }, narrow).left).toBe(96)
    expect(anchoredPickerStyle(rect(0, 100), size, narrow).left).toBe(8)
  })

  it('sem caber em nenhum lado, usa o lado maior e limita a altura', () => {
    const style = anchoredPickerStyle(
      rect(10, 250),
      { width: 256, height: 500 },
      { width: 800, height: 600 }
    )
    expect(style).toEqual({ left: 10, top: 284, maxHeight: 308 })
  })
})
