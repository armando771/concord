import { describe, expect, it } from 'vitest'
import { ttsMessageToSpeak, type TTSListenContext } from './ttsListen'

const channelCall: TTSListenContext = {
  enabled: true,
  call: { status: 'active', type: 'channel', serverId: 's1', channelId: 'vozA', conversationId: null },
  deafened: false,
  serverDeafened: false
}

const channelEvent = (over: Record<string, unknown> = {}): { type: string; payload: unknown } => ({
  type: 'message:create',
  payload: {
    channel_id: 'ch1',
    server_id: 's1',
    message: { id: 'm1', author_id: 'ana', channel_id: 'ch1', content: 'oi', tts: true, tts_voice_channel_id: 'vozA', created_at: '' },
    ...over
  }
})

const dmEvent = {
  type: 'message:create',
  payload: {
    conversation_id: 'dm1',
    message: { id: 'm2', author_id: 'ana', conversation_id: 'dm1', content: 'oi', tts: true, created_at: '' }
  }
}

describe('ttsMessageToSpeak', () => {
  it('fala a TTS de um canal do servidor da minha call', () => {
    expect(ttsMessageToSpeak(channelEvent(), channelCall)?.id).toBe('m1')
  })
  it('mensagem comum não fala', () => {
    const ev = channelEvent({ message: { id: 'm1', author_id: 'ana', content: 'oi', created_at: '' } })
    expect(ttsMessageToSpeak(ev, channelCall)).toBeNull()
  })
  it('outro servidor não fala', () => {
    const otherServer = { ...channelCall, call: { ...channelCall.call, serverId: 's2', channelId: 'vozZ' } }
    expect(ttsMessageToSpeak(channelEvent(), otherServer)).toBeNull()
  })
  // Issue #384: a TTS só toca na call de origem, não em qualquer call do servidor.
  it('outra call do mesmo servidor não fala', () => {
    const callB = { ...channelCall, call: { ...channelCall.call, channelId: 'vozB' } }
    expect(ttsMessageToSpeak(channelEvent(), callB)).toBeNull()
  })
  it('TTS sem call de origem (autor fora de call ou mensagem antiga) ninguém ouve', () => {
    for (const target of [null, undefined]) {
      const message = { id: 'm1', author_id: 'ana', channel_id: 'ch1', content: 'oi', tts: true, tts_voice_channel_id: target, created_at: '' }
      expect(ttsMessageToSpeak(channelEvent({ message }), channelCall)).toBeNull()
    }
  })
  it('fora de call, chamando ou conectando não fala', () => {
    for (const status of ['idle', 'calling', 'ringing', 'ended']) {
      const ctx = { ...channelCall, call: { ...channelCall.call, status } }
      expect(ttsMessageToSpeak(channelEvent(), ctx)).toBeNull()
    }
  })
  it('ensurdecido (por mim ou pelo servidor) não ouve', () => {
    expect(ttsMessageToSpeak(channelEvent(), { ...channelCall, deafened: true })).toBeNull()
    expect(ttsMessageToSpeak(channelEvent(), { ...channelCall, serverDeafened: true })).toBeNull()
  })
  it('interruptor desligado não ouve', () => {
    expect(ttsMessageToSpeak(channelEvent(), { ...channelCall, enabled: false })).toBeNull()
  })
  it('DM: só na call daquela DM', () => {
    const dmCall: TTSListenContext = {
      ...channelCall,
      call: { status: 'active', type: 'dm', serverId: null, channelId: null, conversationId: 'dm1' }
    }
    expect(ttsMessageToSpeak(dmEvent, dmCall)?.id).toBe('m2')
    const otherDm = { ...dmCall, call: { ...dmCall.call, conversationId: 'dm9' } }
    expect(ttsMessageToSpeak(dmEvent, otherDm)).toBeNull()
    // Em call de canal, TTS de DM não fala.
    expect(ttsMessageToSpeak(dmEvent, channelCall)).toBeNull()
  })
  it('TTS de canal não fala na call de DM', () => {
    const dmCall: TTSListenContext = {
      ...channelCall,
      call: { status: 'active', type: 'dm', serverId: null, channelId: null, conversationId: 'dm1' }
    }
    expect(ttsMessageToSpeak(channelEvent(), dmCall)).toBeNull()
  })
  it('outros eventos e payload quebrado não falam', () => {
    expect(ttsMessageToSpeak({ type: 'message:update', payload: channelEvent().payload }, channelCall)).toBeNull()
    expect(ttsMessageToSpeak({ type: 'message:create', payload: null }, channelCall)).toBeNull()
  })
})
