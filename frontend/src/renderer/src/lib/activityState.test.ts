import { describe, expect, it } from 'vitest'
import {
  activityBanner,
  activityReducer,
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
    expect(INITIAL_ACTIVITY_STATE).toEqual({ callId: null, shared: null, local: null })
  })

  it('call: trocar de chamada zera tudo; a mesma chamada não mexe', () => {
    const busy: ActivityState = {
      callId: 'call-1',
      shared: activityReducer(inCall, { type: 'started', activity: raw() }).shared,
      local: { activityId: 'krunker', url: 'https://krunker.io/' }
    }
    expect(activityReducer(busy, { type: 'call', callId: 'call-1' })).toBe(busy)
    expect(activityReducer(busy, { type: 'call', callId: 'call-2' })).toEqual({
      callId: 'call-2',
      shared: null,
      local: null
    })
    expect(activityReducer(busy, { type: 'call', callId: null })).toEqual(INITIAL_ACTIVITY_STATE)
  })

  it('started: guarda a atividade da chamada atual', () => {
    const next = activityReducer(inCall, { type: 'started', activity: raw() })
    expect(next.shared).toEqual({
      callId: 'call-1',
      activityId: 'krunker',
      url: 'https://krunker.io/?game=FRA:abc12',
      startedBy: ana
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
