import { describe, expect, it } from 'vitest'
import {
  isConnectedTo,
  knockView,
  shownVoiceState,
  inviteCallId,
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

describe('inviteCallId', () => {
  const here = { status: 'active', type: 'channel', channelId: 'v1', callId: 'call-1' }

  it('é a call do canal em que estou conectado', () => {
    expect(inviteCallId(here, 'v1')).toBe('call-1')
  })

  it('nada em outro canal, sem estar ativa, em DM ou sem id', () => {
    expect(inviteCallId(here, 'v2')).toBeNull()
    expect(inviteCallId({ ...here, status: 'connecting' }, 'v1')).toBeNull()
    expect(inviteCallId({ ...here, type: 'dm' }, 'v1')).toBeNull()
    expect(inviteCallId({ ...here, callId: null }, 'v1')).toBeNull()
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

  const pads = (look: VoiceRowLook): string[] =>
    voiceRowClass(look)
      .split(' ')
      .filter((c) => /^(sm:)?pr-/.test(c))

  it('canal comum', () => {
    const cls = voiceRowClass(base)
    expect(cls).toContain('text-gray-400')
    expect(cls).not.toContain('opacity-60')
  })

  it('sem permissão de entrar fica apagado', () => {
    expect(voiceRowClass({ ...base, canConnect: false })).toContain('opacity-60')
  })

  // O balão "Abrir chat" fica sempre visível na tela estreita (toque) e só no
  // hover do sm em diante: o nome não pode passar por baixo dele.
  it('guarda o espaço do balão do chat (e do "•••")', () => {
    expect(pads(base)).toEqual(['pr-7', 'sm:pr-7'])
    expect(pads({ ...base, hasMenu: true })).toEqual(['pr-12', 'sm:pr-12'])
  })

  it('com gente, no sm os botões ficam no lugar da contagem (que some no hover)', () => {
    expect(pads({ ...base, hasPeople: true })).toEqual(['pr-7', 'sm:pr-2.5'])
    expect(pads({ ...base, hasMenu: true, hasPeople: true })).toEqual(['pr-12', 'sm:pr-2.5'])
  })

  it('com "Convidar amigos" o espaço da direita cresce um botão', () => {
    expect(pads({ ...base, hasInvite: true })).toEqual(['pr-14', 'sm:pr-14'])
    expect(pads({ ...base, hasMenu: true, hasInvite: true })).toEqual(['pr-20', 'sm:pr-20'])
    expect(pads({ ...base, hasInvite: true, hasPeople: true })).toEqual(['pr-14', 'sm:pr-2.5'])
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
