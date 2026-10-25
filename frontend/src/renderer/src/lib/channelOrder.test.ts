import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./rtc', () => ({
  getAudioStream: vi.fn(),
  getDisplayStream: vi.fn(),
  getCameraStream: vi.fn()
}))

vi.mock('../router', () => ({
  router: { state: { location: { pathname: '/' } }, navigate: vi.fn() }
}))
import { reorderChannelList } from './channelOrder'
import { primaryChannelId } from './primaryChannel'
import type { Channel } from '../api/channels'
import * as channelsApi from '../api/channels'
import { useServerStore } from '../store/serverStore'
import { useChatStore } from '../store/chatStore'

const makeChannel = (
  id: string,
  name: string,
  type: 'text' | 'voice',
  position = 0
): Channel => ({
  id,
  server_id: 'srv-1',
  name,
  type,
  position,
  created_by: 'u-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
})

describe('reorderChannelList (regras puras de drag-and-drop)', () => {
  const initial: Channel[] = [
    makeChannel('t1', 'chat-dos-brothers', 'text', 0),
    makeChannel('t2', 'avisos', 'text', 1),
    makeChannel('t3', 'memes', 'text', 2),
    makeChannel('v1', 'predador', 'voice', 0),
    makeChannel('v2', 'conversinhas-2', 'voice', 1),
    makeChannel('v3', 'conversinhas-3', 'voice', 2),
    makeChannel('v4', 'conversinhas-4', 'voice', 3)
  ]

  it('move canal de voz do fim para o topo (before)', () => {
    const res = reorderChannelList(initial, 'v4', 'v1', 'before')
    expect(res).not.toBeNull()
    expect(res?.sectionIds).toEqual(['v4', 'v1', 'v2', 'v3'])
    const voices = res?.nextChannels.filter((c) => c.type === 'voice') ?? []
    expect(voices.map((c) => c.name)).toEqual([
      'conversinhas-4',
      'predador',
      'conversinhas-2',
      'conversinhas-3'
    ])
    expect(voices.map((c) => c.position)).toEqual([0, 1, 2, 3])
    // Canais de texto permanecem intactos
    expect(res?.nextChannels.filter((c) => c.type === 'text').map((c) => c.id)).toEqual([
      't1',
      't2',
      't3'
    ])
  })

  it('move canal de voz do topo para o meio (after)', () => {
    const res = reorderChannelList(initial, 'v1', 'v3', 'after')
    expect(res).not.toBeNull()
    expect(res?.sectionIds).toEqual(['v2', 'v3', 'v1', 'v4'])
  })

  it('move canal de texto para baixo e atualiza fallback do canal principal', () => {
    const res = reorderChannelList(initial, 't1', 't2', 'after')
    expect(res).not.toBeNull()
    expect(res?.sectionIds).toEqual(['t2', 't1', 't3'])
    // Sem primary_channel_id fixado, o novo primeiro canal de texto vira o principal
    expect(primaryChannelId({ primary_channel_id: null }, res!.nextChannels)).toBe('t2')
    // Com primary_channel_id fixado em t1, continua sendo t1 mesmo mudando de posição
    expect(primaryChannelId({ primary_channel_id: 't1' }, res!.nextChannels)).toBe('t1')
  })

  it('retorna null quando solta na mesma posição efetiva (evita requisição desnecessária)', () => {
    expect(reorderChannelList(initial, 'v1', 'v2', 'before')).toBeNull()
    expect(reorderChannelList(initial, 'v2', 'v1', 'after')).toBeNull()
    expect(reorderChannelList(initial, 'v1', 'v1', 'before')).toBeNull()
  })

  it('bloqueia tentativa de mover canal de texto para seção de voz e vice-versa', () => {
    expect(reorderChannelList(initial, 't1', 'v1', 'before')).toBeNull()
    expect(reorderChannelList(initial, 'v1', 't1', 'after')).toBeNull()
  })
})

describe('Integração serverStore + chatStore (otimismo, rollback e WebSocket em tempo real)', () => {
  const baseChannels: Channel[] = [
    makeChannel('t1', 'chat-dos-brothers', 'text', 0),
    makeChannel('v1', 'predador', 'voice', 0),
    makeChannel('v2', 'conversinhas-2', 'voice', 1),
    makeChannel('v3', 'conversinhas-3', 'voice', 2)
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    useServerStore.setState({
      currentServer: {
        id: 'srv-1',
        name: 'BH RX',
        icon_url: '',
        owner_id: 'owner-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      },
      channels: baseChannels
    })
    useChatStore.setState({
      channelsByServer: { 'srv-1': baseChannels.map((c) => c.id) }
    })
  })

  it('aplica atualização otimista imediata e persiste retorno da API', async () => {
    const moved = reorderChannelList(baseChannels, 'v3', 'v1', 'before')!
    let resolveApi!: (value: Channel[]) => void
    const spy = vi.spyOn(channelsApi, 'reorderChannels').mockImplementation(
      () =>
        new Promise<Channel[]>((resolve) => {
          resolveApi = resolve
        })
    )

    const promise = useServerStore
      .getState()
      .reorderChannels('srv-1', moved.nextChannels, moved.sectionIds)

    // Antes mesmo da API responder, a UI já mostra a nova ordem (otimista)
    expect(
      useServerStore
        .getState()
        .channels.filter((c) => c.type === 'voice')
        .map((c) => c.id)
    ).toEqual(['v3', 'v1', 'v2'])

    resolveApi(moved.nextChannels)
    await promise

    expect(spy).toHaveBeenCalledWith('srv-1', ['v3', 'v1', 'v2'])
    expect(
      useServerStore
        .getState()
        .channels.filter((c) => c.type === 'voice')
        .map((c) => c.id)
    ).toEqual(['v3', 'v1', 'v2'])
  })

  it('reverte automaticamente a ordem na UI se a API falhar', async () => {
    const moved = reorderChannelList(baseChannels, 'v3', 'v1', 'before')!
    vi.spyOn(channelsApi, 'reorderChannels').mockRejectedValue(new Error('only admins can manage channels'))

    await expect(
      useServerStore.getState().reorderChannels('srv-1', moved.nextChannels, moved.sectionIds)
    ).rejects.toThrow('only admins can manage channels')

    // Estado revertido para a ordem original
    expect(
      useServerStore
        .getState()
        .channels.filter((c) => c.type === 'voice')
        .map((c) => c.id)
    ).toEqual(['v1', 'v2', 'v3'])
  })

  it('atualiza a ordem em tempo real para todos os clientes ao receber evento WS channel:reorder', () => {
    const moved = reorderChannelList(baseChannels, 'v2', 'v1', 'before')!

    useChatStore.getState().handleWsEvent({
      type: 'channel:reorder',
      payload: {
        server_id: 'srv-1',
        channels: moved.nextChannels
      }
    })

    expect(
      useServerStore
        .getState()
        .channels.filter((c) => c.type === 'voice')
        .map((c) => c.name)
    ).toEqual(['conversinhas-2', 'predador', 'conversinhas-3'])
    expect(useChatStore.getState().channelsByServer['srv-1']).toEqual([
      't1',
      'v2',
      'v1',
      'v3'
    ])
  })
})
