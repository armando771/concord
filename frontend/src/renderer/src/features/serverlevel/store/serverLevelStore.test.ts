import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchServerLevel = vi.fn()
vi.mock('../api/serverLevel', () => ({ fetchServerLevel: (id: string) => fetchServerLevel(id) }))

import { useServerLevelStore } from './serverLevelStore'

const progress = { server_id: 's1', level: 2, xp: 300, xp_into_level: 50, xp_for_next: 1000 }

describe('serverLevelStore', () => {
  beforeEach(() => {
    useServerLevelStore.getState().reset()
    fetchServerLevel.mockReset()
  })

  it('load guarda o progresso e a semana', async () => {
    fetchServerLevel.mockResolvedValue({ ...progress, week: [{ source: 'voz', xp: 30 }] })
    await useServerLevelStore.getState().load('s1')
    expect(useServerLevelStore.getState().byServer.s1).toEqual(progress)
    expect(useServerLevelStore.getState().week.s1).toEqual([{ source: 'voz', xp: 30 }])
  })

  it('load que falha mantém o que já tinha', async () => {
    useServerLevelStore.getState().apply(progress)
    fetchServerLevel.mockRejectedValue(new Error('rede'))
    await useServerLevelStore.getState().load('s1')
    expect(useServerLevelStore.getState().byServer.s1).toEqual(progress)
  })

  it('apply troca o progresso do servidor', () => {
    useServerLevelStore.getState().apply(progress)
    useServerLevelStore.getState().apply({ ...progress, xp: 310, xp_into_level: 60 })
    expect(useServerLevelStore.getState().byServer.s1.xp).toBe(310)
  })
})
