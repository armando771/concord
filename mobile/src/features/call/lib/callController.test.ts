import { ApiError } from '../../../shared/api/client'
import { useCallNoticeStore } from '../store/callNoticeStore'
import { useCallSessionStore } from '../store/callSessionStore'
import { useIncomingCallStore } from '../store/incomingCallStore'
import { useParticipantsStore } from '../store/participantsStore'
import { useSpeakingStore } from '../store/speakingStore'
import type { CallMedia, MediaConnection } from './callMedia'
import { createCallController, type ControllerDeps } from './callController'

const ana = { id: 'u1', username: 'ana', display_name: 'Ana' }
const session = () => useCallSessionStore.getState()

function rig(over: Partial<ControllerDeps> = {}) {
  let connection: (s: MediaConnection) => void = () => {}
  let speakers: (ids: string[]) => void = () => {}
  const media: jest.Mocked<CallMedia> = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    setMicEnabled: jest.fn().mockResolvedValue(undefined),
    setListening: jest.fn(),
    onSpeakers: jest.fn((l) => {
      speakers = l
      return () => {}
    }),
    onConnection: jest.fn((l) => {
      connection = l
      return () => {}
    })
  }
  const deps: ControllerDeps = {
    api: {
      startCall: jest.fn().mockResolvedValue({ id: 'c1', type: 'channel', status: 'active' }),
      getCallToken: jest.fn().mockResolvedValue({ token: 'tok' }),
      endCallRequest: jest.fn().mockResolvedValue({ message: 'ok' })
    },
    media,
    ws: { send: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn() },
    liveKitUrl: 'wss://sala.exemplo',
    controls: () => ({ muted: false, deafened: false }),
    ensureMicPermission: jest.fn().mockResolvedValue(true),
    ...over
  }
  return { deps, media, controller: createCallController(deps), emitConnection: (s: MediaConnection) => connection(s), emitSpeakers: (ids: string[]) => speakers(ids) }
}

beforeEach(() => {
  session().reset()
  useParticipantsStore.getState().reset()
  useIncomingCallStore.getState().clear()
  useCallNoticeStore.getState().dismiss()
  useSpeakingStore.getState().reset()
})

describe('joinChannel', () => {
  it('cria a chamada, assina a sala, conecta a mídia e fica ativa', async () => {
    const { controller, deps, media } = rig()
    await controller.joinChannel({ id: 'ch1', name: 'Geral', serverId: 's1' })
    expect(deps.api.startCall).toHaveBeenCalledWith({ type: 'channel', channel_id: 'ch1' })
    expect(deps.ws.subscribe).toHaveBeenCalledWith('call:c1')
    expect(media.connect).toHaveBeenCalledWith('wss://sala.exemplo', 'tok')
    expect(session()).toMatchObject({ phase: 'active', callId: 'c1', kind: 'channel', channelId: 'ch1', serverId: 's1', name: 'Geral' })
  })

  it('liga o microfone conforme o mudo local e avisa o servidor', async () => {
    const { controller, deps, media } = rig({ controls: () => ({ muted: true, deafened: false }) })
    await controller.joinChannel({ id: 'ch1', name: 'Geral', serverId: 's1' })
    expect(media.setMicEnabled).toHaveBeenLastCalledWith(false)
    expect(deps.ws.send).toHaveBeenCalledWith('call:voice', { call_id: 'c1', muted: true, deafened: false })
  })

  it('sala trancada: avisa e volta a ocioso sem conectar', async () => {
    const { controller, media, deps } = rig()
    ;(deps.api.startCall as jest.Mock).mockRejectedValue(new ApiError(423, 'call_locked'))
    await controller.joinChannel({ id: 'ch1', name: 'Geral', serverId: 's1' })
    expect(session().phase).toBe('idle')
    expect(media.connect).not.toHaveBeenCalled()
    expect(useCallNoticeStore.getState().message).toBe('Sala trancada. Peça para alguém abrir.')
  })

  it('falha da mídia sai da chamada e avisa', async () => {
    const { controller, media, deps } = rig()
    media.connect.mockRejectedValue(new Error('sem rede'))
    await controller.joinChannel({ id: 'ch1', name: 'Geral', serverId: 's1' })
    expect(session().phase).toBe('idle')
    expect(deps.ws.send).toHaveBeenCalledWith('call:leave', { call_id: 'c1' })
    expect(useCallNoticeStore.getState().message).toBe('Não foi possível entrar na chamada. Tente de novo.')
  })

  it('permissão de microfone negada: entra mudo e avisa', async () => {
    const { controller, media } = rig({ ensureMicPermission: jest.fn().mockResolvedValue(false) })
    await controller.joinChannel({ id: 'ch1', name: 'Geral', serverId: 's1' })
    expect(session().phase).toBe('active')
    expect(media.setMicEnabled).toHaveBeenLastCalledWith(false)
    expect(useCallNoticeStore.getState().message).toBe('Sem permissão do microfone. Você entrou mudo.')
  })

  it('entrar no mesmo canal de novo não faz nada', async () => {
    const { controller, deps } = rig()
    await controller.joinChannel({ id: 'ch1', name: 'Geral', serverId: 's1' })
    await controller.joinChannel({ id: 'ch1', name: 'Geral', serverId: 's1' })
    expect(deps.api.startCall).toHaveBeenCalledTimes(1)
  })

  it('entrar em outro canal sai do anterior primeiro', async () => {
    const { controller, deps } = rig()
    await controller.joinChannel({ id: 'ch1', name: 'Geral', serverId: 's1' })
    ;(deps.api.startCall as jest.Mock).mockResolvedValue({ id: 'c2', type: 'channel', status: 'active' })
    await controller.joinChannel({ id: 'ch2', name: 'Jogos', serverId: 's1' })
    expect(deps.ws.send).toHaveBeenCalledWith('call:leave', { call_id: 'c1' })
    expect(session()).toMatchObject({ callId: 'c2', channelId: 'ch2' })
  })
})

describe('callDm / accept / decline', () => {
  it('ligar para DM fica chamando sem conectar a mídia', async () => {
    const { controller, media, deps } = rig()
    ;(deps.api.startCall as jest.Mock).mockResolvedValue({ id: 'd1', type: 'dm', status: 'ringing' })
    await controller.callDm({ id: 'cv1', name: 'Ana' })
    expect(deps.api.startCall).toHaveBeenCalledWith({ type: 'dm', conversation_id: 'cv1' })
    expect(session()).toMatchObject({ phase: 'outgoing', callId: 'd1', kind: 'dm', conversationId: 'cv1', name: 'Ana' })
    expect(media.connect).not.toHaveBeenCalled()
  })

  it('quando atendem (fase connecting) a mídia conecta', async () => {
    const { controller, media, deps } = rig()
    ;(deps.api.startCall as jest.Mock).mockResolvedValue({ id: 'd1', type: 'dm', status: 'ringing' })
    await controller.callDm({ id: 'cv1', name: 'Ana' })
    session().setPhase('connecting')
    await controller.connectIfNeeded()
    expect(media.connect).toHaveBeenCalled()
    expect(session().phase).toBe('active')
  })

  it('atender: avisa o servidor, assina a sala e conecta', async () => {
    const { controller, deps, media } = rig()
    useIncomingCallStore.getState().ring({ callId: 'd9', conversationId: 'cv1', initiator: ana })
    await controller.acceptIncoming()
    expect(deps.ws.send).toHaveBeenCalledWith('call:accept', { call_id: 'd9' })
    expect(deps.ws.subscribe).toHaveBeenCalledWith('call:d9')
    expect(media.connect).toHaveBeenCalled()
    expect(useIncomingCallStore.getState().call).toBeNull()
    expect(session()).toMatchObject({ callId: 'd9', kind: 'dm', name: 'Ana', phase: 'active' })
  })

  it('recusar avisa o servidor e limpa', () => {
    const { controller, deps } = rig()
    useIncomingCallStore.getState().ring({ callId: 'd9', conversationId: 'cv1', initiator: ana })
    controller.declineIncoming()
    expect(deps.ws.send).toHaveBeenCalledWith('call:decline', { call_id: 'd9' })
    expect(useIncomingCallStore.getState().call).toBeNull()
  })
})

describe('leave e mídia', () => {
  it('sair avisa, desassina, desconecta e zera tudo', async () => {
    const { controller, deps, media } = rig()
    await controller.joinChannel({ id: 'ch1', name: 'Geral', serverId: 's1' })
    useParticipantsStore.getState().upsert(ana)
    await controller.leave()
    expect(deps.ws.send).toHaveBeenCalledWith('call:leave', { call_id: 'c1' })
    expect(deps.ws.unsubscribe).toHaveBeenCalledWith('call:c1')
    expect(media.disconnect).toHaveBeenCalled()
    expect(session().phase).toBe('idle')
    expect(useParticipantsStore.getState().people).toEqual([])
  })

  it('sair sem chamada não faz nada', async () => {
    const { controller, deps } = rig()
    await controller.leave()
    expect(deps.ws.send).not.toHaveBeenCalled()
  })

  it('mídia reconectando e voltando muda a fase', async () => {
    const { controller, emitConnection } = rig()
    await controller.joinChannel({ id: 'ch1', name: 'Geral', serverId: 's1' })
    emitConnection('reconnecting')
    expect(session().phase).toBe('reconnecting')
    emitConnection('connected')
    expect(session().phase).toBe('active')
  })

  it('mídia desconectada de vez encerra com aviso', async () => {
    const { controller, emitConnection } = rig()
    await controller.joinChannel({ id: 'ch1', name: 'Geral', serverId: 's1' })
    emitConnection('disconnected')
    await Promise.resolve()
    expect(session().phase).toBe('idle')
    expect(useCallNoticeStore.getState().message).toBe('A conexão com a chamada caiu.')
  })

  it('quem fala vai para a store', async () => {
    const { controller, emitSpeakers } = rig()
    await controller.joinChannel({ id: 'ch1', name: 'Geral', serverId: 's1' })
    emitSpeakers(['u1'])
    expect(useSpeakingStore.getState().speaking).toEqual(['u1'])
  })
})

describe('applyAudio', () => {
  it('fone liga/desliga o áudio que chega e o microfone', async () => {
    let deafened = false
    const { controller, media, deps } = rig({ controls: () => ({ muted: deafened, deafened }) })
    await controller.joinChannel({ id: 'ch1', name: 'Geral', serverId: 's1' })
    deafened = true
    await controller.applyAudio()
    expect(media.setListening).toHaveBeenLastCalledWith(false)
    expect(media.setMicEnabled).toHaveBeenLastCalledWith(false)
    expect(deps.ws.send).toHaveBeenLastCalledWith('call:voice', { call_id: 'c1', muted: true, deafened: true })
  })

  it('sem chamada não faz nada', async () => {
    const { controller, media } = rig()
    await controller.applyAudio()
    expect(media.setMicEnabled).not.toHaveBeenCalled()
  })
})
