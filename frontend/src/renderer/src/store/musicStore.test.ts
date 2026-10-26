import { beforeEach, describe, expect, it } from 'vitest'
import { useMusicStore } from './musicStore'

const state = {
  call_id: 'c1',
  channel_id: 'v1',
  server_id: 's1',
  server_time: Date.now() + 1000,
  now: null,
  queue: [],
  skip: { votes: 0, needed: 1, voters: [] }
}

describe('musicStore', () => {
  beforeEach(() => {
    useMusicStore.setState({ state: null, ephemeral: [], presence: {}, serverOffsetMs: 0 })
  })

  it('painel do Maestro abre ao clicar nele e fecha ao sair da call', () => {
    const store = useMusicStore.getState()
    expect(useMusicStore.getState().panelOpen).toBe(false)
    store.openPanel()
    expect(useMusicStore.getState().panelOpen).toBe(true)
    store.closePanel()
    expect(useMusicStore.getState().panelOpen).toBe(false)
    store.openPanel()
    store.clearState()
    expect(useMusicStore.getState().panelOpen).toBe(false)
  })

  it('guarda o estado e o desvio do relógio do servidor', () => {
    useMusicStore.getState().handleWsEvent({ type: 'music:state', payload: state })
    const s = useMusicStore.getState()
    expect(s.state?.call_id).toBe('c1')
    expect(s.serverOffsetMs).toBeGreaterThan(500)
  })

  it('closed limpa só o estado da mesma call', () => {
    const store = useMusicStore.getState()
    store.handleWsEvent({ type: 'music:state', payload: state })
    store.handleWsEvent({
      type: 'music:state',
      payload: { ...state, call_id: 'outra', closed: true }
    })
    expect(useMusicStore.getState().state?.call_id).toBe('c1')
    store.handleWsEvent({ type: 'music:state', payload: { ...state, closed: true } })
    expect(useMusicStore.getState().state).toBeNull()
  })

  it('respostas e buscas viram mensagens efêmeras da sala certa', () => {
    const store = useMusicStore.getState()
    store.handleWsEvent({ type: 'music:reply', payload: { channel_id: 't1', text: 'oi' } })
    store.handleWsEvent({
      type: 'music:search',
      payload: { token: 'tk', channel_id: 't1', query: 'lofi', expires_at: 1, results: [] }
    })
    const eph = useMusicStore.getState().ephemeral
    expect(eph.map((e) => [e.room, e.kind])).toEqual([
      ['channel:t1', 'text'],
      ['channel:t1', 'search']
    ])
    store.dismiss(eph[0].id)
    expect(useMusicStore.getState().ephemeral).toHaveLength(1)
    store.markExpired(eph[1].id)
    expect(useMusicStore.getState().ephemeral[0].expired).toBe(true)
  })

  it('presença por servidor', () => {
    const store = useMusicStore.getState()
    store.handleWsEvent({
      type: 'music:presence',
      payload: { server_id: 's1', channel_id: 'v1', active: true }
    })
    store.handleWsEvent({
      type: 'music:presence',
      payload: { server_id: 's1', channel_id: 'v2', active: true }
    })
    store.handleWsEvent({
      type: 'music:presence',
      payload: { server_id: 's1', channel_id: 'v1', active: false }
    })
    expect(useMusicStore.getState().presence.s1).toEqual(['v2'])
  })
})
