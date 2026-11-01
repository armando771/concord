import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../store/chatStore', () => ({ useChatStore: vi.fn() }))
vi.mock('../../../shared/store/toastStore', () => ({ showToast: { error: vi.fn() } }))

import { ApiError } from '../../../shared/api/client'
import { showToast } from '../../../shared/store/toastStore'
import type { Message, ReactionSummary } from '../api/messages'
import { useReactionLimitStore } from '../store/reactionLimitStore'
import { reactWithLimit } from './useReactToMessage'

const full: ReactionSummary[] = Array.from({ length: 20 }, (_, i) => ({
  emoji: `e${i}`,
  count: 1,
  user_ids: ['bia']
}))

const msg = (reactions: ReactionSummary[] = []): Message => ({
  id: 'm1',
  author_id: 'bia',
  content: 'oi',
  created_at: '2026-01-01T10:00:00Z',
  reactions
})

describe('reactWithLimit', () => {
  beforeEach(() => {
    useReactionLimitStore.setState({ open: false })
    vi.clearAllMocks()
  })

  it('reação que cabe vai para o servidor', async () => {
    const toggle = vi.fn(async () => {})
    await reactWithLimit(msg(), '👍', toggle)
    expect(toggle).toHaveBeenCalledWith('👍')
    expect(useReactionLimitStore.getState().open).toBe(false)
  })

  it('21ª reação diferente: não envia e abre o aviso', async () => {
    const toggle = vi.fn(async () => {})
    await reactWithLimit(msg(full), '👍', toggle)
    expect(toggle).not.toHaveBeenCalled()
    expect(useReactionLimitStore.getState().open).toBe(true)
  })

  it('emoji que já está na mensagem cheia continua valendo', async () => {
    const toggle = vi.fn(async () => {})
    await reactWithLimit(msg(full), 'e5', toggle)
    expect(toggle).toHaveBeenCalledWith('e5')
  })

  it('servidor recusa pelo limite (409): mesmo aviso, sem toast', async () => {
    const toggle = vi.fn(async () => {
      throw new ApiError(409, 'demais', 'too_many_reactions')
    })
    await reactWithLimit(msg(), '👍', toggle)
    expect(useReactionLimitStore.getState().open).toBe(true)
    expect(showToast.error).not.toHaveBeenCalled()
  })

  it('outra falha vira toast', async () => {
    const toggle = vi.fn(async () => {
      throw new Error('rede')
    })
    await reactWithLimit(msg(), '👍', toggle)
    expect(useReactionLimitStore.getState().open).toBe(false)
    expect(showToast.error).toHaveBeenCalled()
  })
})
