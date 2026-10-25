import { describe, expect, it } from 'vitest'
import {
  addWatched,
  buildScreenEntries,
  miniPlayerOnly,
  miniPlayerTarget,
  pruneWatched,
  resolveFocus
} from './screenWatch'

const s1 = { id: 's1' } as unknown as MediaStream
const s2 = { id: 's2' } as unknown as MediaStream
const local = { id: 'local' } as unknown as MediaStream

describe('pruneWatched', () => {
  it('tira quem parou de transmitir', () => {
    expect(pruneWatched(['ana', 'bia'], ['bia'])).toEqual(['bia'])
  })

  it('devolve o mesmo array se nada saiu', () => {
    const w = ['ana']
    expect(pruneWatched(w, ['ana', 'bia'])).toBe(w)
  })
})

describe('addWatched', () => {
  it('adiciona no fim', () => {
    expect(addWatched(['ana'], 'bia')).toEqual(['ana', 'bia'])
  })

  it('quem já estava vai para o fim', () => {
    expect(addWatched(['ana', 'bia'], 'ana')).toEqual(['bia', 'ana'])
  })
})

describe('resolveFocus', () => {
  it('sem foco continua sem foco', () => {
    expect(resolveFocus(null, ['ana'], 'eu')).toBeNull()
  })

  it('mantém o foco válido', () => {
    expect(resolveFocus('ana', ['ana'], null)).toBe('ana')
    expect(resolveFocus('eu', [], 'eu')).toBe('eu')
  })

  it('foco inválido cai no último assistido, senão na minha tela', () => {
    expect(resolveFocus('ana', ['bia', 'caio'], null)).toBe('caio')
    expect(resolveFocus('ana', [], 'eu')).toBe('eu')
    expect(resolveFocus('ana', [], null)).toBeNull()
  })
})

describe('buildScreenEntries', () => {
  it('minha tela primeiro; as dos outros só têm stream se assisto', () => {
    expect(
      buildScreenEntries({
        meId: 'eu',
        localScreenStream: local,
        availableScreens: ['ana', 'bia'],
        watchedScreenIds: ['ana'],
        screenStreams: { ana: s1, bia: s2 }
      })
    ).toEqual([
      { userId: 'eu', stream: local, local: true, watching: true },
      { userId: 'ana', stream: s1, local: false, watching: true },
      { userId: 'bia', stream: null, local: false, watching: false }
    ])
  })

  it('assistida sem stream ainda fica sem stream', () => {
    expect(
      buildScreenEntries({
        meId: 'eu',
        localScreenStream: null,
        availableScreens: ['eu', 'ana'],
        watchedScreenIds: ['ana'],
        screenStreams: {}
      })
    ).toEqual([{ userId: 'ana', stream: null, local: false, watching: true }])
  })
})

describe('miniPlayerTarget', () => {
  it('prefere a tela em destaque', () => {
    expect(miniPlayerTarget(['ana', 'bia'], 'ana', { ana: s1, bia: s2 })).toBe('ana')
  })

  it('senão a última assistida com stream', () => {
    expect(miniPlayerTarget(['ana', 'bia'], null, { ana: s1, bia: s2 })).toBe('bia')
    expect(miniPlayerTarget(['ana', 'bia'], 'caio', { ana: s1 })).toBe('ana')
  })

  it('sem assistir nada não mostra', () => {
    expect(miniPlayerTarget([], 'ana', { ana: s1 })).toBeNull()
  })
})

describe('miniPlayerOnly', () => {
  it('fica só a transmissão da miniatura', () => {
    expect(miniPlayerOnly(['ana', 'bia'], 'ana', { ana: s1, bia: s2 })).toEqual(['ana'])
    expect(miniPlayerOnly(['ana', 'bia'], null, { ana: s1, bia: s2 })).toEqual(['bia'])
  })

  it('assistida em destaque cujo vídeo ainda não chegou continua', () => {
    expect(miniPlayerOnly(['ana', 'bia'], 'ana', {})).toEqual(['ana'])
    expect(miniPlayerOnly(['ana', 'bia'], null, {})).toEqual(['bia'])
  })

  it('uma só (ou nenhuma) devolve o mesmo array', () => {
    const one = ['ana']
    const none: string[] = []
    expect(miniPlayerOnly(one, null, {})).toBe(one)
    expect(miniPlayerOnly(none, 'ana', {})).toBe(none)
  })
})
