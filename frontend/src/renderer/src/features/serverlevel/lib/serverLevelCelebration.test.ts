import { describe, expect, it } from 'vitest'
import { decideServerCelebration, readCelebrated, writeCelebrated } from './serverLevelCelebration'

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = { ...initial }
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v
    }
  } as Storage
}

describe('decideServerCelebration', () => {
  it('quem está no servidor vê na hora, contando do nível anterior', () => {
    expect(decideServerCelebration({ level: 5, previous: 4, seen: 4, viewing: true })).toEqual({
      play: true,
      from: 4,
      remember: 5
    })
    // Nunca guardado ainda: conta do anterior que veio no evento.
    expect(
      decideServerCelebration({ level: 5, previous: 4, seen: undefined, viewing: true })
    ).toEqual({ play: true, from: 4, remember: 5 })
  })

  it('quem estava em outro lugar não vê agora; vê ao abrir o servidor', () => {
    const away = decideServerCelebration({ level: 5, previous: 4, seen: undefined, viewing: false })
    expect(away).toEqual({ play: false, from: 5, remember: 4 })
    // Ao abrir: o evento não vem de novo, só o nível carregado.
    expect(decideServerCelebration({ level: 5, seen: away.remember, viewing: true })).toEqual({
      play: true,
      from: 4,
      remember: 5
    })
    // Se já tinha um nível guardado, fora do servidor não mexe nele.
    expect(decideServerCelebration({ level: 7, previous: 6, seen: 3, viewing: false })).toEqual({
      play: false,
      from: 7
    })
    // Subiu várias vezes enquanto estava fora: toca uma vez, do guardado ao atual.
    expect(decideServerCelebration({ level: 7, seen: 3, viewing: true })).toMatchObject({
      play: true,
      from: 3
    })
  })

  it('nunca toca duas vezes para o mesmo nível', () => {
    for (const viewing of [true, false]) {
      expect(decideServerCelebration({ level: 5, previous: 4, seen: 5, viewing }).play).toBe(false)
      expect(decideServerCelebration({ level: 5, seen: 6, viewing }).play).toBe(false)
    }
  })

  it('primeira vez abrindo o servidor só marca o ponto de partida', () => {
    expect(decideServerCelebration({ level: 12, seen: undefined, viewing: true })).toEqual({
      play: false,
      from: 12,
      remember: 12
    })
  })
})

describe('nível celebrado no localStorage', () => {
  it('guarda e lê por servidor', () => {
    const storage = memoryStorage()
    expect(readCelebrated(storage, 's1')).toBeUndefined()
    writeCelebrated(storage, 's1', 4)
    writeCelebrated(storage, 's2', 9)
    expect(readCelebrated(storage, 's1')).toBe(4)
    expect(readCelebrated(storage, 's2')).toBe(9)
  })

  it('lixo, falta de storage ou storage cheio não quebram', () => {
    expect(
      readCelebrated(memoryStorage({ 'salinha:serverlevel:celebrated': '{oops' }), 's1')
    ).toBeUndefined()
    expect(
      readCelebrated(memoryStorage({ 'salinha:serverlevel:celebrated': 'null' }), 's1')
    ).toBeUndefined()
    expect(
      readCelebrated(memoryStorage({ 'salinha:serverlevel:celebrated': '{"s1":"x"}' }), 's1')
    ).toBeUndefined()
    expect(readCelebrated(undefined, 's1')).toBeUndefined()
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceeded')
      }
    }
    expect(() => writeCelebrated(full, 's1', 3)).not.toThrow()
  })
})
