import { describe, expect, it } from 'vitest'
import {
  addTyper,
  IDLE_TYPING,
  nextTypingExpiry,
  pruneTypers,
  removeTyper,
  TYPING_SEND_INTERVAL_MS,
  TYPING_TTL_MS,
  typersIn,
  typingOnDone,
  typingOnInput,
  typingSegments,
  type TypingByRoom
} from './typing'

const ROOM = 'channel:c1'

describe('addTyper', () => {
  it('entra com validade de 5 s a partir do evento', () => {
    const next = addTyper({}, ROOM, 'ana', 'Ana', 1000)
    expect(next[ROOM]).toEqual([{ userId: 'ana', name: 'Ana', expiresAt: 1000 + TYPING_TTL_MS }])
  })

  it('evento repetido renova a validade sem duplicar nem mudar a ordem', () => {
    let state = addTyper({}, ROOM, 'ana', 'Ana', 0)
    state = addTyper(state, ROOM, 'bia', 'Bia', 100)
    state = addTyper(state, ROOM, 'ana', 'Ana Paula', 3000)
    expect(state[ROOM]).toEqual([
      { userId: 'ana', name: 'Ana Paula', expiresAt: 3000 + TYPING_TTL_MS },
      { userId: 'bia', name: 'Bia', expiresAt: 100 + TYPING_TTL_MS }
    ])
  })

  it('salas são independentes e o estado anterior não muda', () => {
    const before = addTyper({}, ROOM, 'ana', 'Ana', 0)
    const after = addTyper(before, 'conversation:d1', 'ana', 'Ana', 0)
    expect(before['conversation:d1']).toBeUndefined()
    expect(after[ROOM]).toHaveLength(1)
    expect(after['conversation:d1']).toHaveLength(1)
  })
})

describe('removeTyper', () => {
  it('tira a pessoa (mensagem dela chegou ou ela parou)', () => {
    let state = addTyper({}, ROOM, 'ana', 'Ana', 0)
    state = addTyper(state, ROOM, 'bia', 'Bia', 0)
    expect(removeTyper(state, ROOM, 'ana')[ROOM].map((t) => t.userId)).toEqual(['bia'])
  })

  it('sala que esvazia some do mapa', () => {
    const state = addTyper({}, ROOM, 'ana', 'Ana', 0)
    expect(removeTyper(state, ROOM, 'ana')).toEqual({})
  })

  it('quem não estava digitando não muda o estado (mesma referência)', () => {
    const state = addTyper({}, ROOM, 'ana', 'Ana', 0)
    expect(removeTyper(state, ROOM, 'bia')).toBe(state)
    expect(removeTyper(state, 'channel:outra', 'ana')).toBe(state)
  })
})

describe('pruneTypers e nextTypingExpiry', () => {
  const state: TypingByRoom = {
    [ROOM]: [
      { userId: 'ana', name: 'Ana', expiresAt: 5000 },
      { userId: 'bia', name: 'Bia', expiresAt: 8000 }
    ],
    'conversation:d1': [{ userId: 'caio', name: 'Caio', expiresAt: 4000 }]
  }

  it('remove quem passou de 5 s sem novo evento', () => {
    expect(pruneTypers(state, 5000)).toEqual({
      [ROOM]: [{ userId: 'bia', name: 'Bia', expiresAt: 8000 }]
    })
  })

  it('nada vencido devolve a mesma referência', () => {
    expect(pruneTypers(state, 3999)).toBe(state)
  })

  it('próximo vencimento é o menor de todos', () => {
    expect(nextTypingExpiry(state)).toBe(4000)
    expect(nextTypingExpiry({})).toBeNull()
  })
})

describe('typersIn', () => {
  const state: TypingByRoom = {
    [ROOM]: [
      { userId: 'eu', name: 'Eu', expiresAt: 9000 },
      { userId: 'ana', name: 'Ana', expiresAt: 9000 },
      { userId: 'bia', name: 'Bia', expiresAt: 1000 }
    ]
  }

  it('nunca mostra a mim mesmo nem quem já venceu', () => {
    expect(typersIn(state, ROOM, 2000, 'eu').map((t) => t.userId)).toEqual(['ana'])
  })

  it('sala sem ninguém dá lista vazia', () => {
    expect(typersIn(state, 'channel:vazia', 0, 'eu')).toEqual([])
  })
})

describe('typingSegments', () => {
  const text = (names: string[]): string =>
    typingSegments(names)
      .map((s) => (s.bold ? `**${s.text}**` : s.text))
      .join('')

  it('ninguém', () => {
    expect(typingSegments([])).toEqual([])
  })

  it('uma pessoa', () => {
    expect(text(['Fulano'])).toBe('**Fulano** está digitando…')
  })

  it('duas pessoas', () => {
    expect(text(['Fulano', 'Ciclano'])).toBe('**Fulano** e **Ciclano** estão digitando…')
  })

  it('três pessoas', () => {
    expect(text(['A', 'B', 'C'])).toBe('**A**, **B** e **C** estão digitando…')
  })

  it('quatro ou mais', () => {
    expect(text(['A', 'B', 'C', 'D'])).toBe('Várias pessoas estão digitando…')
    expect(text(['A', 'B', 'C', 'D', 'E'])).toBe('Várias pessoas estão digitando…')
  })
})

describe('typingOnInput / typingOnDone (envio com intervalo)', () => {
  it('primeira tecla manda na hora', () => {
    const { state, signal } = typingOnInput(IDLE_TYPING, 'o', 1000)
    expect(signal).toBe('typing')
    expect(state.lastSentAt).toBe(1000)
  })

  it('continuar digitando manda no máximo a cada 3 s', () => {
    let s = typingOnInput(IDLE_TYPING, 'o', 0).state
    const signals: (string | null)[] = []
    for (const t of [500, 1500, 2999, 3000, 4000, 6000]) {
      const r = typingOnInput(s, 'oi', t)
      s = r.state
      signals.push(r.signal)
    }
    expect(signals).toEqual([null, null, null, 'typing', null, 'typing'])
    expect(TYPING_SEND_INTERVAL_MS).toBe(3000)
  })

  it('campo vazio sem ter digitado não manda nada', () => {
    expect(typingOnInput(IDLE_TYPING, '', 0).signal).toBeNull()
    expect(typingOnInput(IDLE_TYPING, '   ', 0).signal).toBeNull()
  })

  it('apagar tudo depois de digitar manda stop e zera', () => {
    const typing = typingOnInput(IDLE_TYPING, 'oi', 0).state
    const cleared = typingOnInput(typing, '', 100)
    expect(cleared.signal).toBe('stop')
    expect(cleared.state).toEqual(IDLE_TYPING)
    // Voltar a digitar logo depois manda de novo na hora.
    expect(typingOnInput(cleared.state, 'o', 200).signal).toBe('typing')
  })

  it('enviar a mensagem manda stop só se tinha avisado', () => {
    const typing = typingOnInput(IDLE_TYPING, 'oi', 0).state
    expect(typingOnDone(typing)).toEqual({ state: IDLE_TYPING, signal: 'stop' })
    expect(typingOnDone(IDLE_TYPING)).toEqual({ state: IDLE_TYPING, signal: null })
  })
})
