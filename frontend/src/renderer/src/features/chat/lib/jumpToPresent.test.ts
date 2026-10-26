import { describe, expect, it } from 'vitest'
import {
  advanceJump,
  advanceRoomJump,
  countNewSince,
  isFarFromBottom,
  JUMP_INITIAL,
  jumpOf,
  jumpLabel,
  jumpScrollBehavior,
  jumpThreshold,
  newCountText,
  nextFar,
  nextLeftAt,
  showJump,
  type JumpState,
  type RoomJump
} from './jumpToPresent'
import type { ScrollMetrics } from './stickToBottom'

const view = (scrollTop: number, clientHeight = 500, scrollHeight = 5000): ScrollMetrics => ({
  scrollTop,
  clientHeight,
  scrollHeight
})
/** Métricas a `distance` px do fim. */
const away = (distance: number, clientHeight = 500, scrollHeight = 5000): ScrollMetrics =>
  view(scrollHeight - clientHeight - distance, clientHeight, scrollHeight)

const at = (n: number): string => `2026-01-01T00:00:${String(n).padStart(2, '0')}Z`
const msg = (n: number, author = 'outro'): { created_at: string; author_id: string } => ({
  created_at: at(n),
  author_id: author
})

describe('jumpThreshold / isFarFromBottom', () => {
  it('limiar é uma tela da lista, entre 300 e 600 px', () => {
    expect(jumpThreshold(200)).toBe(300)
    expect(jumpThreshold(450)).toBe(450)
    expect(jumpThreshold(1200)).toBe(600)
  })

  it('longe: mais que o limiar da altura da lista', () => {
    expect(isFarFromBottom(away(450, 450))).toBe(false)
    expect(isFarFromBottom(away(451, 450))).toBe(true)
    expect(isFarFromBottom(away(601, 1200))).toBe(true)
    expect(isFarFromBottom(away(0))).toBe(false)
  })
})

describe('nextFar', () => {
  it('rolando para cima e passando do limiar: longe', () => {
    expect(nextFar(false, away(800), 4500)).toBe(true)
  })

  it('voltando para perto do fim: deixa de ser longe', () => {
    expect(nextFar(true, away(10), 100)).toBe(false)
  })

  it('já longe e rolando para baixo ainda longe: continua longe', () => {
    expect(nextFar(true, away(800), 100)).toBe(true)
  })

  it('conteúdo que empurra o fim durante a rolagem para baixo não acende o botão', () => {
    // Mensagem alta chegou e a lista desce sozinha: scrollTop só aumenta.
    expect(nextFar(false, away(800), 1000)).toBe(false)
  })

  it('perto do fim continua não-longe', () => {
    expect(nextFar(false, away(5), 0)).toBe(false)
  })
})

describe('nextLeftAt', () => {
  it('perto do fim: zera a marca', () => {
    expect(nextLeftAt(at(5), true, at(9))).toBeNull()
    expect(nextLeftAt(null, true, at(9))).toBeNull()
  })

  it('saiu do fim: guarda a última mensagem daquele momento', () => {
    expect(nextLeftAt(null, false, at(9))).toBe(at(9))
  })

  it('já fora do fim: a marca não anda quando chega mensagem', () => {
    expect(nextLeftAt(at(5), false, at(9))).toBe(at(5))
  })

  it('sem mensagens não há o que marcar', () => {
    expect(nextLeftAt(null, false, null)).toBeNull()
  })
})

describe('countNewSince', () => {
  const list = [msg(1), msg(2), msg(3), msg(4), msg(5)]

  it('sem marca (no fim): zero', () => {
    expect(countNewSince(list, null, 'eu')).toBe(0)
  })

  it('conta só as mensagens depois da marca', () => {
    expect(countNewSince(list, at(3), 'eu')).toBe(2)
    expect(countNewSince(list, at(5), 'eu')).toBe(0)
  })

  it('páginas antigas que entram em cima não contam como novas', () => {
    expect(countNewSince([msg(0), ...list], at(5), 'eu')).toBe(0)
  })

  it('minhas próprias mensagens não contam', () => {
    expect(countNewSince([...list, msg(6, 'eu'), msg(7)], at(5), 'eu')).toBe(1)
  })

  it('sem saber quem sou, conta todas', () => {
    expect(countNewSince([...list, msg(6, 'eu')], at(5), undefined)).toBe(1)
  })

  it('lista vazia: zero', () => {
    expect(countNewSince([], at(1), 'eu')).toBe(0)
  })
})

describe('advanceJump', () => {
  const start: JumpState = { far: false, leftAt: null }

  it('nada muda: devolve o mesmo objeto (sem novo render)', () => {
    expect(advanceJump(start, away(0), 100, at(9))).toBe(start)
  })

  it('subiu um pouco: marca o ponto de saída, ainda sem botão por distância', () => {
    expect(advanceJump(start, away(200), 5000, at(9))).toEqual({ far: false, leftAt: at(9) })
  })

  it('subiu muito: longe', () => {
    expect(advanceJump(start, away(900), 5000, at(9))).toEqual({ far: true, leftAt: at(9) })
  })

  it('voltou ao fim: zera tudo', () => {
    const prev: JumpState = { far: true, leftAt: at(9) }
    expect(advanceJump(prev, away(0), 100, at(12))).toEqual(start)
  })
})

describe('showJump', () => {
  it('aparece longe do fim ou com novas abaixo', () => {
    expect(showJump(true, 0)).toBe(true)
    expect(showJump(false, 2)).toBe(true)
    expect(showJump(false, 0)).toBe(false)
  })
})

describe('textos', () => {
  it('selo: vazio sem novas, número, 99+ no teto', () => {
    expect(newCountText(0)).toBe('')
    expect(newCountText(3)).toBe('3')
    expect(newCountText(99)).toBe('99')
    expect(newCountText(100)).toBe('99+')
  })

  it('rótulo acessível', () => {
    expect(jumpLabel(0)).toBe('Voltar às mensagens recentes')
    expect(jumpLabel(1)).toBe('Voltar às mensagens recentes, 1 nova')
    expect(jumpLabel(3)).toBe('Voltar às mensagens recentes, 3 novas')
    expect(jumpLabel(150)).toBe('Voltar às mensagens recentes, mais de 99 novas')
  })
})

describe('jumpScrollBehavior', () => {
  it('suave, ou instantâneo com movimento reduzido', () => {
    expect(jumpScrollBehavior(false)).toBe('smooth')
    expect(jumpScrollBehavior(true)).toBe('auto')
  })
})

describe('advanceRoomJump', () => {
  const same: RoomJump = { room: 'a', jump: { far: false, leftAt: null } }

  it('mesma sala e nada mudou: o mesmo objeto', () => {
    expect(advanceRoomJump(same, 'a', away(0), 100, at(9))).toBe(same)
  })

  it('mesma sala: avança o estado dela', () => {
    expect(advanceRoomJump(same, 'a', away(900), 5000, at(9))).toEqual({
      room: 'a',
      jump: { far: true, leftAt: at(9) }
    })
  })

  it('sala nova: o que sobrou da anterior é descartado', () => {
    const old: RoomJump = { room: 'a', jump: { far: true, leftAt: at(1) } }
    expect(advanceRoomJump(old, 'b', away(200), 5000, at(9))).toEqual({
      room: 'b',
      jump: { far: false, leftAt: at(9) }
    })
  })

  it('sala nova já no fim: estado limpo da sala nova', () => {
    const old: RoomJump = { room: 'a', jump: { far: true, leftAt: at(1) } }
    expect(advanceRoomJump(old, 'b', away(0), 100, at(9))).toEqual({
      room: 'b',
      jump: { far: false, leftAt: null }
    })
  })
})

describe('jumpOf', () => {
  it('estado da sala atual, ou o inicial se o guardado é de outra', () => {
    const state: RoomJump = { room: 'a', jump: { far: true, leftAt: at(1) } }
    expect(jumpOf(state, 'a')).toBe(state.jump)
    expect(jumpOf(state, 'b')).toBe(JUMP_INITIAL)
  })
})
