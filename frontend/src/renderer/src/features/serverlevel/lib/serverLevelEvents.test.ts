import { describe, expect, it, vi } from 'vitest'
import { handleServerLevelEvent } from './serverLevelEvents'

function deps(): { apply: ReturnType<typeof vi.fn>; levelUp: ReturnType<typeof vi.fn> } {
  return { apply: vi.fn(), levelUp: vi.fn() }
}

describe('handleServerLevelEvent', () => {
  it('update atualiza o progresso', () => {
    const d = deps()
    const payload = { server_id: 's', level: 2, xp: 300, xp_into_level: 50, xp_for_next: 1000 }
    handleServerLevelEvent({ type: 'server:level:update', payload }, d)
    expect(d.apply).toHaveBeenCalledWith(payload)
    expect(d.levelUp).not.toHaveBeenCalled()
  })

  it('up avisa a subida', () => {
    const d = deps()
    handleServerLevelEvent(
      { type: 'server:level:up', payload: { server_id: 's', level: 3, previous_level: 2 } },
      d
    )
    expect(d.levelUp).toHaveBeenCalledWith('s', 3, 2)
  })

  it('ignora outros eventos e payload torto', () => {
    const d = deps()
    handleServerLevelEvent({ type: 'level:up', payload: { server_id: 's', level: 3 } }, d)
    handleServerLevelEvent({ type: 'server:level:up', payload: null }, d)
    handleServerLevelEvent({ type: 'server:level:update', payload: { server_id: 's' } }, d)
    expect(d.apply).not.toHaveBeenCalled()
    expect(d.levelUp).not.toHaveBeenCalled()
  })
})
