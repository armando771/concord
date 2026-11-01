import { beforeEach, describe, expect, it } from 'vitest'
import { isVoiceChatOpen, useVoiceChatPanelStore } from './voiceChatPanelStore'

describe('voiceChatPanelStore', () => {
  beforeEach(() => useVoiceChatPanelStore.setState({ channelId: null }))

  it('começa fechado', () => {
    expect(isVoiceChatOpen('v1')(useVoiceChatPanelStore.getState())).toBe(false)
  })

  it('abre o chat de um canal de voz por vez', () => {
    useVoiceChatPanelStore.getState().open('v1')
    useVoiceChatPanelStore.getState().open('v2')
    const s = useVoiceChatPanelStore.getState()
    expect(isVoiceChatOpen('v2')(s)).toBe(true)
    expect(isVoiceChatOpen('v1')(s)).toBe(false)
  })

  it('fecha', () => {
    useVoiceChatPanelStore.getState().open('v1')
    useVoiceChatPanelStore.getState().close()
    expect(useVoiceChatPanelStore.getState().channelId).toBeNull()
  })

  it('o botão da tela da chamada alterna o chat daquele canal', () => {
    const { toggle } = useVoiceChatPanelStore.getState()
    toggle('v1')
    expect(useVoiceChatPanelStore.getState().channelId).toBe('v1')
    toggle('v1')
    expect(useVoiceChatPanelStore.getState().channelId).toBeNull()
    useVoiceChatPanelStore.getState().open('v2')
    toggle('v1')
    expect(useVoiceChatPanelStore.getState().channelId).toBe('v1')
  })
})
