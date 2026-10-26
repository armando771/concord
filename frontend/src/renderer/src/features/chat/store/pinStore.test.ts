import { describe, expect, it, beforeEach } from 'vitest'
import { selectPins, usePinStore } from './pinStore'
import type { PinnedMessage, Message } from '../api/messages'

const mockMessage = (id: string, channelId: string, content = 'teste'): PinnedMessage => ({
  id,
  author_id: 'user-1',
  channel_id: channelId,
  content,
  created_at: new Date().toISOString(),
  pinned_at: new Date().toISOString(),
  pinned_by: {
    id: 'user-2',
    username: 'mod',
    display_name: 'Moderador'
  }
})

describe('pinStore', () => {
  beforeEach(() => {
    usePinStore.setState({ pinsByChannel: {}, loadingByChannel: {} })
  })

  it('adiciona mensagem fixada com onPinAdd', () => {
    const pin = mockMessage('m1', 'ch1', 'Primeiro pin')
    usePinStore.getState().onPinAdd('ch1', pin)

    const pins = usePinStore.getState().pinsByChannel['ch1']
    expect(pins).toHaveLength(1)
    expect(pins[0].id).toBe('m1')
    expect(pins[0].content).toBe('Primeiro pin')
  })

  it('remove mensagem fixada com onPinRemove', () => {
    const pin1 = mockMessage('m1', 'ch1')
    const pin2 = mockMessage('m2', 'ch1')
    usePinStore.getState().onPinAdd('ch1', pin1)
    usePinStore.getState().onPinAdd('ch1', pin2)

    usePinStore.getState().onPinRemove('ch1', 'm1')

    const pins = usePinStore.getState().pinsByChannel['ch1']
    expect(pins).toHaveLength(1)
    expect(pins[0].id).toBe('m2')
  })

  it('remove mensagem excluída em tempo real com onMessageDelete', () => {
    const pin1 = mockMessage('m1', 'ch1')
    usePinStore.getState().onPinAdd('ch1', pin1)

    usePinStore.getState().onMessageDelete('m1')

    const pins = usePinStore.getState().pinsByChannel['ch1']
    expect(pins).toHaveLength(0)
  })

  it('atualiza conteúdo quando mensagem fixada é editada com onMessageUpdate', () => {
    const pin1 = mockMessage('m1', 'ch1', 'Conteúdo original')
    usePinStore.getState().onPinAdd('ch1', pin1)

    const updated: Message = {
      ...pin1,
      content: 'Conteúdo editado',
      edited_at: new Date().toISOString()
    }

    usePinStore.getState().onMessageUpdate(updated)

    const pins = usePinStore.getState().pinsByChannel['ch1']
    expect(pins[0].content).toBe('Conteúdo editado')
    expect(pins[0].edited_at).toBeTruthy()
  })
})

describe('selectPins', () => {
  it('sem fixadas devolve sempre a mesma referência (senão o zustand entra em loop)', () => {
    const state = usePinStore.getState()
    const select = selectPins('canal-sem-pins')
    expect(select(state)).toEqual([])
    expect(select(state)).toBe(select(state))
  })
})
