import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./messages', () => ({
  addChannelReaction: vi.fn(async () => {}),
  removeChannelReaction: vi.fn(async () => {}),
  addConversationReaction: vi.fn(async () => {}),
  removeConversationReaction: vi.fn(async () => {})
}))

import * as api from './messages'
import { sendReaction } from './reactions'

describe('sendReaction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('canal: põe e tira pela rota do canal', async () => {
    await sendReaction('channel:c1', 'm1', '👍', true)
    await sendReaction('channel:c1', 'm1', '👍', false)
    expect(api.addChannelReaction).toHaveBeenCalledWith('c1', 'm1', '👍')
    expect(api.removeChannelReaction).toHaveBeenCalledWith('c1', 'm1', '👍')
  })

  it('DM e grupo: pela rota da conversa', async () => {
    await sendReaction('conversation:d1', 'm1', '🔥', true)
    await sendReaction('conversation:d1', 'm1', '🔥', false)
    expect(api.addConversationReaction).toHaveBeenCalledWith('d1', 'm1', '🔥')
    expect(api.removeConversationReaction).toHaveBeenCalledWith('d1', 'm1', '🔥')
  })
})
