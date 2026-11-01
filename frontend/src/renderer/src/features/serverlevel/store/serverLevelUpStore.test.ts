import { beforeEach, describe, expect, it } from 'vitest'
import { useServerLevelUpStore } from './serverLevelUpStore'

describe('serverLevelUpStore', () => {
  beforeEach(() => useServerLevelUpStore.getState().close())

  it('mostra uma subida por vez, com chave nova a cada uma', () => {
    const { show } = useServerLevelUpStore.getState()
    show({ serverId: 's1', level: 5, previous: 4 })
    const first = useServerLevelUpStore.getState().current!
    show({ serverId: 's1', level: 6, previous: 5 })
    const second = useServerLevelUpStore.getState().current!
    expect(second.level).toBe(6)
    expect(second.key).not.toBe(first.key)
  })

  it('o fim de uma animação antiga não fecha a nova', () => {
    const { show, close } = useServerLevelUpStore.getState()
    show({ serverId: 's1', level: 5, previous: 4 })
    const old = useServerLevelUpStore.getState().current!.key
    show({ serverId: 's1', level: 6, previous: 5 })
    close(old)
    expect(useServerLevelUpStore.getState().current?.level).toBe(6)
    close()
    expect(useServerLevelUpStore.getState().current).toBeNull()
  })
})
