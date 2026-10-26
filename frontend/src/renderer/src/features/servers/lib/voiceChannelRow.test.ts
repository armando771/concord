import { describe, expect, it } from 'vitest'
import {
  isConnectedTo,
  knockView,
  shownVoiceState,
  voiceRowClass,
  voiceRowTitle,
  type VoiceRowLook
} from './voiceChannelRow'

describe('isConnectedTo', () => {
  it('só no canal de voz em que estou numa chamada', () => {
    expect(isConnectedTo({ status: 'active', type: 'channel', channelId: 'v1' }, 'v1')).toBe(true)
    expect(isConnectedTo({ status: 'active', type: 'channel', channelId: 'v2' }, 'v1')).toBe(false)
    expect(isConnectedTo({ status: 'idle', type: 'channel', channelId: 'v1' }, 'v1')).toBe(false)
    expect(isConnectedTo({ status: 'active', type: 'dm', channelId: 'v1' }, 'v1')).toBe(false)
  })
})

describe('knockView', () => {
  it('mostra o pedido só no canal dele', () => {
    expect(knockView({ channelId: 'v1', status: 'pending' }, 'v1')).toBe('pending')
    expect(knockView({ channelId: 'v1', status: 'declined' }, 'v1')).toBe('declined')
    expect(knockView({ channelId: 'v1', status: 'pending' }, 'v2')).toBeNull()
    expect(knockView(null, 'v1')).toBeNull()
  })
})

describe('voiceRowTitle', () => {
  it('desconectar, conectar ou sem permissão', () => {
    expect(voiceRowTitle(true, true)).toBe('Desconectar')
    expect(voiceRowTitle(false, true)).toBe('Conectar ao canal de voz')
    expect(voiceRowTitle(false, false)).toMatch(/não tem permissão/)
  })
})

describe('voiceRowClass', () => {
  const base: VoiceRowLook = {
    canConnect: true,
    hasMenu: false,
    hasPeople: false,
    dropActive: false,
    connectedHere: false
  }

  it('canal comum', () => {
    const cls = voiceRowClass(base)
    expect(cls).toContain('pr-2.5')
    expect(cls).toContain('text-gray-400')
    expect(cls).not.toContain('opacity-60')
  })

  it('sem permissão de entrar fica apagado', () => {
    expect(voiceRowClass({ ...base, canConnect: false })).toContain('opacity-60')
  })

  it('com "•••" e sem gente guarda o espaço do menu', () => {
    expect(voiceRowClass({ ...base, hasMenu: true })).toContain('pr-7')
    expect(voiceRowClass({ ...base, hasMenu: true, hasPeople: true })).toContain('pr-2.5')
  })

  it('arrastando alguém por cima ganha do conectado', () => {
    expect(voiceRowClass({ ...base, dropActive: true, connectedHere: true })).toContain(
      'ring-brand'
    )
    expect(voiceRowClass({ ...base, connectedHere: true })).toContain('text-strong hover:bg-fg/6')
  })
})

describe('shownVoiceState', () => {
  const p = { muted: true, deafened: false }
  it('eu no canal: vale o meu estado local', () => {
    expect(shownVoiceState(p, true, { muted: false, deafened: true })).toEqual({
      muted: false,
      deafened: true
    })
  })
  it('os outros: vale o que o servidor mandou', () => {
    expect(shownVoiceState(p, false, { muted: false, deafened: true })).toEqual(p)
  })
})
