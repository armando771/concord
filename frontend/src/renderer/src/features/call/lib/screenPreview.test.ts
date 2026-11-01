import { describe, expect, it } from 'vitest'
import type { CallStateResponse } from '../api/calls'
import {
  isUserLive,
  liveTarget,
  needsLeaveConfirm,
  PREVIEW_FAST_RETRIES,
  PREVIEW_POLL_MS,
  PREVIEW_RETRY_MS,
  previewDataUrl,
  previewPollDelay,
  previewSize,
  stripDataUrl,
  type MyCall
} from './screenPreview'

const idle: MyCall = {
  status: 'idle',
  callId: null,
  type: null,
  channelId: null,
  screenSharers: [],
  availableScreens: []
}

function channelCall(
  id: string,
  participants: string[],
  sharing: string[],
  extra: { locked?: boolean } = {}
): CallStateResponse {
  return {
    call: {
      id,
      type: 'channel',
      channel_id: 'ch',
      server_id: 'srv',
      initiator_id: participants[0],
      status: 'active',
      started_at: '',
      locked: extra.locked
    },
    participants: participants.map((user_id) => ({
      call_id: id,
      user_id,
      role: 'member',
      joined_at: ''
    })),
    screen_sharing: sharing
  }
}

const yes = (): boolean => true

describe('previewSize', () => {
  it('reduz 1080p para 384×216', () => {
    expect(previewSize(1920, 1080)).toEqual({ width: 384, height: 216 })
  })
  it('mantém a proporção de telas ultrawide e em pé', () => {
    expect(previewSize(3440, 1440)).toEqual({ width: 384, height: 161 })
    expect(previewSize(1080, 1920)).toEqual({ width: 122, height: 216 })
  })
  it('não aumenta tela pequena', () => {
    expect(previewSize(320, 180)).toEqual({ width: 320, height: 180 })
  })
  it('sem vídeo ainda (0×0) não tira foto', () => {
    expect(previewSize(0, 0)).toBeNull()
    expect(previewSize(Number.NaN, 10)).toBeNull()
  })
})

describe('previewPollDelay', () => {
  it('tenta rápido enquanto a foto não chega, depois volta ao normal', () => {
    expect(previewPollDelay(false, 0)).toBe(PREVIEW_RETRY_MS)
    expect(previewPollDelay(false, PREVIEW_FAST_RETRIES)).toBe(PREVIEW_POLL_MS)
    expect(previewPollDelay(true, 0)).toBe(PREVIEW_POLL_MS)
  })
})

describe('data URL', () => {
  it('ida e volta', () => {
    expect(stripDataUrl(previewDataUrl('QUJD'))).toBe('QUJD')
  })
  it('recusa outro formato ou vazio', () => {
    expect(stripDataUrl('data:image/png;base64,QUJD')).toBeNull()
    expect(stripDataUrl('data:image/jpeg;base64,')).toBeNull()
    expect(stripDataUrl('data:,')).toBeNull()
  })
})

describe('liveTarget', () => {
  it('na mesma chamada: assistir', () => {
    const call: MyCall = {
      ...idle,
      status: 'active',
      callId: 'c1',
      type: 'channel',
      channelId: 'ch',
      screenSharers: ['ana'],
      availableScreens: []
    }
    expect(
      liveTarget({ userId: 'ana', meId: 'eu', call, serverCalls: {}, canConnect: yes })
    ).toEqual({
      kind: 'watch',
      callId: 'c1'
    })
  })

  it('na mesma chamada, mesmo antes do call:screen chegar (tela já no LiveKit)', () => {
    const call: MyCall = {
      ...idle,
      status: 'active',
      callId: 'c1',
      type: 'dm',
      availableScreens: ['ana']
    }
    expect(
      liveTarget({ userId: 'ana', meId: 'eu', call, serverCalls: {}, canConnect: yes })?.kind
    ).toBe('watch')
  })

  it('fora da chamada, num canal em que posso entrar: entrar', () => {
    const serverCalls = { ch: channelCall('c1', ['ana', 'bia'], ['ana']) }
    expect(
      liveTarget({ userId: 'ana', meId: 'eu', call: idle, serverCalls, canConnect: yes })
    ).toEqual({ kind: 'join', callId: 'c1', channelId: 'ch', serverId: 'srv' })
  })

  it('em outra chamada: também é entrar', () => {
    const call: MyCall = {
      ...idle,
      status: 'active',
      callId: 'c9',
      type: 'channel',
      channelId: 'outro'
    }
    const serverCalls = { ch: channelCall('c1', ['ana'], ['ana']) }
    expect(
      liveTarget({ userId: 'ana', meId: 'eu', call, serverCalls, canConnect: yes })?.kind
    ).toBe('join')
  })

  it('já na chamada do canal, com a lista do servidor na frente: assistir', () => {
    const call: MyCall = {
      ...idle,
      status: 'active',
      callId: 'c1',
      type: 'channel',
      channelId: 'ch'
    }
    const serverCalls = { ch: channelCall('c1', ['ana', 'eu'], ['ana']) }
    expect(liveTarget({ userId: 'ana', meId: 'eu', call, serverCalls, canConnect: yes })).toEqual({
      kind: 'watch',
      callId: 'c1'
    })
  })

  it('sem permissão de entrar ou sala trancada: nada', () => {
    const serverCalls = { ch: channelCall('c1', ['ana'], ['ana']) }
    expect(
      liveTarget({ userId: 'ana', meId: 'eu', call: idle, serverCalls, canConnect: () => false })
    ).toBeNull()
    const locked = { ch: channelCall('c1', ['ana'], ['ana'], { locked: true }) }
    expect(
      liveTarget({ userId: 'ana', meId: 'eu', call: idle, serverCalls: locked, canConnect: yes })
    ).toBeNull()
  })

  it('quem não está transmitindo, ou o próprio cartão: nada', () => {
    const serverCalls = { ch: channelCall('c1', ['ana', 'eu'], ['eu']) }
    expect(
      liveTarget({ userId: 'ana', meId: 'eu', call: idle, serverCalls, canConnect: yes })
    ).toBeNull()
    expect(
      liveTarget({ userId: 'eu', meId: 'eu', call: idle, serverCalls, canConnect: yes })
    ).toBeNull()
  })

  it('selo LIVE velho de quem já saiu do canal não conta', () => {
    const serverCalls = { ch: channelCall('c1', ['bia'], ['ana']) }
    expect(
      liveTarget({ userId: 'ana', meId: 'eu', call: idle, serverCalls, canConnect: yes })
    ).toBeNull()
  })
})

describe('isUserLive', () => {
  it('na minha chamada ou num canal visível', () => {
    const call: MyCall = { ...idle, status: 'active', callId: 'c1', screenSharers: ['ana'] }
    expect(isUserLive('ana', call, {})).toBe(true)
    expect(
      isUserLive('ana', idle, { ch: channelCall('c1', ['ana'], ['ana'], { locked: true }) })
    ).toBe(true)
    expect(isUserLive('ana', idle, { ch: channelCall('c1', ['ana'], []) })).toBe(false)
  })
})

describe('needsLeaveConfirm', () => {
  it('só pergunta quando entrar tira de outra chamada', () => {
    expect(needsLeaveConfirm(idle, 'ch')).toBe(false)
    expect(
      needsLeaveConfirm({ ...idle, status: 'active', type: 'channel', channelId: 'ch' }, 'ch')
    ).toBe(false)
    expect(
      needsLeaveConfirm({ ...idle, status: 'active', type: 'channel', channelId: 'outro' }, 'ch')
    ).toBe(true)
    expect(needsLeaveConfirm({ ...idle, status: 'active', type: 'dm' }, 'ch')).toBe(true)
  })
})
