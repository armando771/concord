import { describe, expect, it } from 'vitest'
import {
  activityBanner,
  activityOfPlayer,
  activityReducer,
  activityStarterName,
  canJoinFromProfile,
  capturedRoomToShare,
  needsJoinReport,
  INITIAL_ACTIVITY_STATE,
  type ActivityState,
  type RawCallActivity
} from './activityState'

const ana = { id: 'u-ana', username: 'ana', display_name: 'Ana', avatar_url: null }
const bia = { id: 'u-bia', username: 'bia', display_name: 'Bia', avatar_url: null }

function raw(over: Partial<RawCallActivity> = {}): RawCallActivity {
  return {
    call_id: 'call-1',
    activity_id: 'krunker',
    url: 'https://krunker.io/?game=FRA:abc12',
    started_by: ana,
    ...over
  }
}

const inCall: ActivityState = { ...INITIAL_ACTIVITY_STATE, callId: 'call-1' }

describe('activityReducer', () => {
  it('começa vazio', () => {
    expect(INITIAL_ACTIVITY_STATE).toEqual({
      callId: null,
      shared: null,
      local: null,
      pending: null
    })
  })

  it('call: trocar de chamada zera tudo; a mesma chamada não mexe', () => {
    const busy: ActivityState = {
      callId: 'call-1',
      shared: activityReducer(inCall, { type: 'started', activity: raw() }).shared,
      local: { activityId: 'krunker', url: 'https://krunker.io/' },
      pending: { activityId: 'krunker', url: 'https://krunker.io/' }
    }
    expect(activityReducer(busy, { type: 'call', callId: 'call-1' })).toBe(busy)
    expect(activityReducer(busy, { type: 'call', callId: 'call-2' })).toEqual({
      callId: 'call-2',
      shared: null,
      local: null,
      pending: null
    })
    expect(activityReducer(busy, { type: 'call', callId: null })).toEqual(INITIAL_ACTIVITY_STATE)
  })

  it('started: guarda a atividade da chamada atual', () => {
    const next = activityReducer(inCall, { type: 'started', activity: raw() })
    expect(next.shared).toEqual({
      callId: 'call-1',
      activityId: 'krunker',
      url: 'https://krunker.io/?game=FRA:abc12',
      startedBy: ana,
      players: ['u-ana']
    })
  })

  it('started: ignora outra chamada, atividade fora do catálogo e payload torto', () => {
    expect(activityReducer(inCall, { type: 'started', activity: raw({ call_id: 'x' }) })).toBe(
      inCall
    )
    expect(
      activityReducer(inCall, { type: 'started', activity: raw({ activity_id: 'doom' }) })
    ).toBe(inCall)
    expect(
      activityReducer(inCall, {
        type: 'started',
        activity: { call_id: 'call-1' } as unknown as RawCallActivity
      })
    ).toBe(inCall)
  })

  it('started: link fora das origens vira "sem link" (abre a página do jogo)', () => {
    const next = activityReducer(inCall, {
      type: 'started',
      activity: raw({ url: 'https://evil.com/' })
    })
    expect(next.shared?.url).toBe('')
  })

  it('started de outra pessoa troca a atividade (novo dono)', () => {
    const a = activityReducer(inCall, { type: 'started', activity: raw() })
    const b = activityReducer(a, { type: 'started', activity: raw({ started_by: bia, url: '' }) })
    expect(b.shared?.startedBy).toEqual(bia)
    expect(b.shared?.url).toBe('')
  })

  it('hydrate: estado da chamada (quem entra depois); null limpa', () => {
    const next = activityReducer(inCall, { type: 'hydrate', callId: 'call-1', activity: raw() })
    expect(next.shared?.startedBy.id).toBe('u-ana')
    expect(
      activityReducer(next, { type: 'hydrate', callId: 'call-1', activity: null }).shared
    ).toBe(null)
    expect(activityReducer(inCall, { type: 'hydrate', callId: 'call-9', activity: raw() })).toBe(
      inCall
    )
  })

  it('stopped: some a atividade se for da mesma chamada e do mesmo dono', () => {
    const open = activityReducer(inCall, { type: 'started', activity: raw() })
    expect(
      activityReducer(open, { type: 'stopped', callId: 'call-1', startedBy: 'u-ana' }).shared
    ).toBe(null)
    // Fim atrasado da atividade antiga não derruba a nova (de outra pessoa).
    expect(activityReducer(open, { type: 'stopped', callId: 'call-1', startedBy: 'u-bia' })).toBe(
      open
    )
    expect(activityReducer(open, { type: 'stopped', callId: 'call-2', startedBy: 'u-ana' })).toBe(
      open
    )
  })

  it('stopped não fecha o jogo de quem já entrou', () => {
    const open: ActivityState = {
      ...activityReducer(inCall, { type: 'started', activity: raw() }),
      local: { activityId: 'krunker', url: 'https://krunker.io/' }
    }
    const next = activityReducer(open, { type: 'stopped', callId: 'call-1', startedBy: 'u-ana' })
    expect(next.local).toEqual({ activityId: 'krunker', url: 'https://krunker.io/' })
  })

  it('opened/closed: o jogo aberto aqui (só dentro de uma chamada)', () => {
    const opened = activityReducer(inCall, {
      type: 'opened',
      activityId: 'krunker',
      url: 'https://krunker.io/'
    })
    expect(opened.local).toEqual({ activityId: 'krunker', url: 'https://krunker.io/' })
    expect(activityReducer(opened, { type: 'closed' }).local).toBe(null)
    expect(
      activityReducer(INITIAL_ACTIVITY_STATE, {
        type: 'opened',
        activityId: 'krunker',
        url: 'https://krunker.io/'
      })
    ).toBe(INITIAL_ACTIVITY_STATE)
    expect(
      activityReducer(inCall, { type: 'opened', activityId: 'doom', url: 'https://krunker.io/' })
    ).toBe(inCall)
  })
})

describe('activityReducer: abrir só depois do servidor aceitar', () => {
  const requested = activityReducer(inCall, {
    type: 'requested',
    activityId: 'krunker',
    url: 'https://krunker.io/?game=FRA:abc12'
  })

  it('requested: fica pendente, o jogo ainda não abre', () => {
    expect(requested.pending).toEqual({
      activityId: 'krunker',
      url: 'https://krunker.io/?game=FRA:abc12'
    })
    expect(requested.local).toBeNull()
    expect(
      activityReducer(INITIAL_ACTIVITY_STATE, {
        type: 'requested',
        activityId: 'krunker',
        url: 'https://krunker.io/'
      })
    ).toBe(INITIAL_ACTIVITY_STATE)
    expect(
      activityReducer(inCall, { type: 'requested', activityId: 'doom', url: 'https://krunker.io/' })
    ).toBe(inCall)
  })

  it('o eco do servidor (call:activity meu) abre o jogo pendente', () => {
    const next = activityReducer(requested, { type: 'started', activity: raw(), meId: 'u-ana' })
    expect(next.pending).toBeNull()
    expect(next.local).toEqual({ activityId: 'krunker', url: 'https://krunker.io/?game=FRA:abc12' })
    expect(next.shared?.startedBy.id).toBe('u-ana')
  })

  it('call:activity de outra pessoa não consome o meu pendente', () => {
    const next = activityReducer(requested, {
      type: 'started',
      activity: raw({ started_by: bia }),
      meId: 'u-ana'
    })
    expect(next.pending).toEqual(requested.pending)
    expect(next.local).toBeNull()
  })

  it('eco sem pendente (ex.: troca de link) não abre nada', () => {
    const next = activityReducer(inCall, { type: 'started', activity: raw(), meId: 'u-ana' })
    expect(next.local).toBeNull()
  })

  it('rejected (call:activity:error ou sem resposta) descarta o pendente', () => {
    const next = activityReducer(requested, { type: 'rejected' })
    expect(next.pending).toBeNull()
    expect(next.local).toBeNull()
    expect(activityReducer(inCall, { type: 'rejected' })).toBe(inCall)
  })
})

describe('activityBanner', () => {
  const open = activityReducer(inCall, { type: 'started', activity: raw() })

  it('sem atividade: nada', () => {
    expect(activityBanner(inCall, 'u-bia')).toBeNull()
  })

  it('para os outros: "Fulano abriu …" e Entrar', () => {
    expect(activityBanner(open, 'u-bia')).toEqual({
      text: 'Ana abriu Krunker.io',
      activityName: 'Krunker.io',
      mine: false,
      joined: false,
      hasLink: true,
      launchUrl: 'https://krunker.io/?game=FRA:abc12'
    })
  })

  it('sem link: Entrar abre a página do jogo', () => {
    const noLink = activityReducer(inCall, { type: 'started', activity: raw({ url: '' }) })
    expect(activityBanner(noLink, 'u-bia')?.launchUrl).toBe('https://krunker.io/')
    expect(activityBanner(noLink, 'u-bia')?.hasLink).toBe(false)
  })

  it('para quem abriu: "Você abriu …"', () => {
    expect(activityBanner(open, 'u-ana')).toMatchObject({
      text: 'Você abriu Krunker.io',
      mine: true
    })
  })

  it('call de canal: quem abriu aparece pelo apelido do servidor', () => {
    expect(activityBanner(open, 'u-bia', { 'u-ana': 'Aninha' })?.text).toBe(
      'Aninha abriu Krunker.io'
    )
    expect(activityBanner(open, 'u-bia', { 'u-outra': 'X' })?.text).toBe('Ana abriu Krunker.io')
    // Para quem abriu continua "Você".
    expect(activityBanner(open, 'u-ana', { 'u-ana': 'Aninha' })?.text).toBe('Você abriu Krunker.io')
  })

  it('já com o jogo aberto aqui: joined', () => {
    const joined = { ...open, local: { activityId: 'krunker', url: 'https://krunker.io/' } }
    expect(activityBanner(joined, 'u-bia')?.joined).toBe(true)
  })

  it('nome vazio cai no usuário', () => {
    const anon = activityReducer(inCall, {
      type: 'started',
      activity: raw({ started_by: { ...ana, display_name: '' } })
    })
    expect(activityBanner(anon, 'u-bia')?.text).toBe('ana abriu Krunker.io')
  })
})

describe('activityStarterName (aviso "X abriu … na chamada")', () => {
  const shared = activityReducer(inCall, { type: 'started', activity: raw() }).shared!

  it('apelido do servidor na call de canal; sem mapa (DM), o nome de exibição', () => {
    expect(activityStarterName(shared, { 'u-ana': 'Aninha' })).toBe('Aninha')
    expect(activityStarterName(shared, undefined)).toBe('Ana')
  })
})

describe('jogadores da atividade (selo, perfil)', () => {
  const started = (players?: unknown): ActivityState =>
    activityReducer(inCall, {
      type: 'started',
      activity: { ...raw(), ...(players === undefined ? {} : { players }) } as RawCallActivity
    })

  it('started traz quem joga; sem a lista (backend antigo), só quem abriu', () => {
    expect(started(['u-ana', 'u-bia']).shared?.players).toEqual(['u-ana', 'u-bia'])
    expect(started().shared?.players).toEqual(['u-ana'])
  })

  it('lista torta: só ids em texto, sem repetidos, com quem abriu', () => {
    expect(started(['u-bia', 7, null, 'u-bia', '']).shared?.players).toEqual(['u-ana', 'u-bia'])
    expect(started('u-bia').shared?.players).toEqual(['u-ana'])
  })

  it('players: troca a lista se for a atividade aberta', () => {
    const state = started()
    const next = activityReducer(state, {
      type: 'players',
      callId: 'call-1',
      activityId: 'krunker',
      players: ['u-ana', 'u-bia']
    })
    expect(next.shared?.players).toEqual(['u-ana', 'u-bia'])
    // Outra chamada ou outra atividade: ignora.
    expect(
      activityReducer(state, {
        type: 'players',
        callId: 'call-2',
        activityId: 'krunker',
        players: []
      })
    ).toBe(state)
    expect(
      activityReducer(state, {
        type: 'players',
        callId: 'call-1',
        activityId: 'doom',
        players: []
      })
    ).toBe(state)
    expect(
      activityReducer(INITIAL_ACTIVITY_STATE, {
        type: 'players',
        callId: 'call-1',
        activityId: 'krunker',
        players: []
      })
    ).toEqual(INITIAL_ACTIVITY_STATE)
  })

  it('activityOfPlayer: a atividade de quem está jogando; null para o resto', () => {
    const state = started(['u-ana', 'u-bia'])
    expect(activityOfPlayer(state, 'u-bia')?.name).toBe('Krunker.io')
    expect(activityOfPlayer(state, 'u-cris')).toBeNull()
    expect(activityOfPlayer(INITIAL_ACTIVITY_STATE, 'u-ana')).toBeNull()
  })

  it('needsJoinReport: jogo aberto aqui e ainda fora da lista', () => {
    const state = started(['u-ana'])
    const playing: ActivityState = { ...state, local: { activityId: 'krunker', url: 'x' } }
    expect(needsJoinReport(playing, 'u-bia')).toBe(true)
    // Já na lista, quem abriu, sem jogo aberto ou jogo de outra atividade: não.
    expect(
      needsJoinReport({ ...playing, shared: started(['u-ana', 'u-bia']).shared }, 'u-bia')
    ).toBe(false)
    expect(needsJoinReport(playing, 'u-ana')).toBe(false)
    expect(needsJoinReport(state, 'u-bia')).toBe(false)
    expect(needsJoinReport({ ...playing, local: { activityId: 'doom', url: 'x' } }, 'u-bia')).toBe(
      false
    )
    expect(needsJoinReport(playing, null)).toBe(false)
  })

  it('canJoinFromProfile: outra pessoa jogando e eu ainda fora do jogo', () => {
    const state = started(['u-ana', 'u-bia'])
    expect(canJoinFromProfile(state, 'u-cris', 'u-bia')).toBe(true)
    expect(canJoinFromProfile(state, 'u-bia', 'u-bia')).toBe(false)
    expect(canJoinFromProfile(state, 'u-cris', 'u-cris')).toBe(false)
    const playing: ActivityState = { ...state, local: { activityId: 'krunker', url: 'x' } }
    expect(canJoinFromProfile(playing, 'u-cris', 'u-bia')).toBe(false)
    expect(canJoinFromProfile(INITIAL_ACTIVITY_STATE, 'u-cris', 'u-bia')).toBe(false)
  })
})

describe('capturedRoomToShare (sala lida da janela de quem abriu)', () => {
  const mine: ActivityState = {
    ...activityReducer(inCall, { type: 'started', activity: raw({ url: '' }) }),
    local: { activityId: 'krunker', url: 'https://krunker.io/' }
  }

  it('quem abriu, com o jogo aberto: compartilha a sala nova', () => {
    expect(
      capturedRoomToShare(mine, 'u-ana', 'krunker', 'https://krunker.io/?game=BRZ:tukbo')
    ).toBe('https://krunker.io/?game=BRZ:tukbo')
  })

  it('a sala já compartilhada não vai de novo', () => {
    const shared = activityReducer(mine, {
      type: 'started',
      activity: raw({ url: 'https://krunker.io/?game=BRZ:tukbo' })
    })
    expect(
      capturedRoomToShare(shared, 'u-ana', 'krunker', 'https://krunker.io/?game=BRZ:tukbo')
    ).toBeNull()
  })

  it('não compartilha: outra pessoa abriu, outra atividade, sem jogo aberto ou link de fora', () => {
    const room = 'https://krunker.io/?game=BRZ:tukbo'
    expect(capturedRoomToShare(mine, 'u-bia', 'krunker', room)).toBeNull()
    expect(capturedRoomToShare(mine, 'u-ana', 'doom', room)).toBeNull()
    expect(capturedRoomToShare({ ...mine, local: null }, 'u-ana', 'krunker', room)).toBeNull()
    expect(
      capturedRoomToShare(mine, 'u-ana', 'krunker', 'https://evil.com/?game=BRZ:tukbo')
    ).toBeNull()
    expect(capturedRoomToShare(mine, null, 'krunker', room)).toBeNull()
  })
})
