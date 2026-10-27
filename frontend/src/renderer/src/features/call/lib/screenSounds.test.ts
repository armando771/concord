import { describe, expect, it, vi } from 'vitest'
import {
  createScreenSoundGate,
  screenSoundsBetween,
  type ScreenSoundView
} from './screenSounds'

const view = (over: Partial<ScreenSoundView> = {}): ScreenSoundView => ({
  callId: 'call-1',
  status: 'active',
  deafened: false,
  participantIds: ['eu', 'ana', 'bia', 'caio'],
  sharers: [],
  watchers: {},
  ...over
})

describe('screenSoundsBetween: transmissão que começa e termina', () => {
  it('alguém abre transmissão na minha call: liveStart', () => {
    expect(screenSoundsBetween(view(), view({ sharers: ['ana'] }), 'eu')).toEqual(['liveStart'])
  })

  it('eu abrindo a minha transmissão não toca nada', () => {
    expect(screenSoundsBetween(view(), view({ sharers: ['eu'] }), 'eu')).toEqual([])
  })

  it('transmissão que já estava rolando continua sem som', () => {
    const v = view({ sharers: ['ana'] })
    expect(screenSoundsBetween(v, view({ sharers: ['ana'] }), 'eu')).toEqual([])
  })

  it('a transmissão de alguém acaba: liveEnd', () => {
    expect(screenSoundsBetween(view({ sharers: ['ana'] }), view(), 'eu')).toEqual(['liveEnd'])
  })

  it('eu parando a minha transmissão não toca nada', () => {
    expect(screenSoundsBetween(view({ sharers: ['eu'] }), view(), 'eu')).toEqual([])
  })

  it('quem transmitia saiu da call: só o som de sair, sem liveEnd', () => {
    const prev = view({ sharers: ['ana'] })
    const next = view({ sharers: [], participantIds: ['eu', 'bia', 'caio'] })
    expect(screenSoundsBetween(prev, next, 'eu')).toEqual([])
  })

  it('duas transmissões abrindo juntas tocam um som só', () => {
    expect(screenSoundsBetween(view(), view({ sharers: ['ana', 'bia'] }), 'eu')).toEqual([
      'liveStart'
    ])
  })
})

describe('screenSoundsBetween: alguém começa a assistir', () => {
  const watching = (...ids: string[]) => ({ ana: ids.map((id) => ({ id })) })

  it('estou assistindo e entra mais um: liveJoin', () => {
    const prev = view({ sharers: ['ana'], watchers: watching('eu') })
    const next = view({ sharers: ['ana'], watchers: watching('eu', 'bia') })
    expect(screenSoundsBetween(prev, next, 'eu')).toEqual(['liveJoin'])
  })

  it('sou o dono da live e alguém começa a assistir: liveJoin', () => {
    const prev = view({ sharers: ['eu'] })
    const next = view({ sharers: ['eu'], watchers: { eu: [{ id: 'bia' }] } })
    expect(screenSoundsBetween(prev, next, 'eu')).toEqual(['liveJoin'])
  })

  it('eu acabei de entrar na live: não toca para mim', () => {
    const prev = view({ sharers: ['ana'] })
    const next = view({ sharers: ['ana'], watchers: watching('eu') })
    expect(screenSoundsBetween(prev, next, 'eu')).toEqual([])
  })

  it('estou na call mas não assisto aquela live: não toca', () => {
    const prev = view({ sharers: ['ana'], watchers: watching('caio') })
    const next = view({ sharers: ['ana'], watchers: watching('caio', 'bia') })
    expect(screenSoundsBetween(prev, next, 'eu')).toEqual([])
  })

  it('assisto a live de ana, mas entram na de bia: não toca', () => {
    const prev = view({ sharers: ['ana', 'bia'], watchers: watching('eu') })
    const next = view({
      sharers: ['ana', 'bia'],
      watchers: { ...watching('eu'), bia: [{ id: 'caio' }] }
    })
    expect(screenSoundsBetween(prev, next, 'eu')).toEqual([])
  })

  it('alguém sai da live: não toca', () => {
    const prev = view({ sharers: ['ana'], watchers: watching('eu', 'bia') })
    const next = view({ sharers: ['ana'], watchers: watching('eu') })
    expect(screenSoundsBetween(prev, next, 'eu')).toEqual([])
  })

  it('a live acaba e a lista de quem assistia esvazia: só liveEnd', () => {
    const prev = view({ sharers: ['ana'], watchers: watching('eu', 'bia') })
    expect(screenSoundsBetween(prev, view(), 'eu')).toEqual(['liveEnd'])
  })

  it('várias pessoas entram de uma vez: um liveJoin só', () => {
    const prev = view({ sharers: ['ana'], watchers: watching('eu') })
    const next = view({ sharers: ['ana'], watchers: watching('eu', 'bia', 'caio') })
    expect(screenSoundsBetween(prev, next, 'eu')).toEqual(['liveJoin'])
  })
})

describe('screenSoundsBetween: quando não toca nada', () => {
  const started = (over: Partial<ScreenSoundView>): [ScreenSoundView, ScreenSoundView] => [
    view(over),
    view({ sharers: ['ana'], ...over })
  ]

  it('ensurdecido', () => {
    const [prev, next] = started({ deafened: true })
    expect(screenSoundsBetween(prev, next, 'eu')).toEqual([])
  })

  it('entrando na call (call nova ou trocada): estado inicial não é novidade', () => {
    expect(
      screenSoundsBetween(view({ callId: null }), view({ sharers: ['ana'] }), 'eu')
    ).toEqual([])
    expect(
      screenSoundsBetween(view({ callId: 'outra' }), view({ sharers: ['ana'] }), 'eu')
    ).toEqual([])
  })

  it('call ainda não ativa (tocando/conectando)', () => {
    const [prev, next] = started({ status: 'outgoing' })
    expect(screenSoundsBetween(prev, next, 'eu')).toEqual([])
    expect(screenSoundsBetween(view({ status: 'outgoing' }), view({ sharers: ['ana'] }), 'eu')).toEqual([])
  })

  it('sem usuário logado', () => {
    const [prev, next] = started({})
    expect(screenSoundsBetween(prev, next, undefined)).toEqual([])
  })
})

describe('createScreenSoundGate', () => {
  const setup = (start = 0) => {
    let now = start
    const play = vi.fn()
    const gate = createScreenSoundGate({ play, now: () => now })
    return { gate, play, advance: (ms: number) => (now += ms) }
  }
  const prev = view()
  const next = view({ sharers: ['ana'] })

  it('mudança do estado durante um evento do WS toca', () => {
    const { gate, play } = setup()
    gate.stateChanged(prev, next, 'eu')
    gate.wsEventHandled()
    expect(play).toHaveBeenCalledWith('liveStart')
  })

  it('mudança sem evento do WS (carga inicial, reconexão) não toca', () => {
    const { gate, play } = setup()
    gate.stateChanged(prev, next, 'eu')
    gate.endOfTick()
    gate.wsEventHandled()
    expect(play).not.toHaveBeenCalled()
  })

  it('evento do WS sem mudança relevante não toca (nem repete o som anterior)', () => {
    const { gate, play } = setup()
    gate.stateChanged(prev, next, 'eu')
    gate.wsEventHandled()
    gate.wsEventHandled()
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('rajada: o mesmo som dentro de 1 s toca uma vez; depois volta a tocar', () => {
    const { gate, play, advance } = setup(10_000)
    const emit = (): void => {
      gate.stateChanged(prev, next, 'eu')
      gate.wsEventHandled()
    }
    emit()
    advance(300)
    emit()
    expect(play).toHaveBeenCalledTimes(1)
    advance(800)
    emit()
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('sons diferentes não se atrapalham', () => {
    const { gate, play } = setup()
    gate.stateChanged(prev, next, 'eu')
    gate.stateChanged(next, view({ sharers: ['ana'], watchers: { ana: [{ id: 'eu' }] } }), 'eu')
    gate.stateChanged(
      view({ sharers: ['ana'], watchers: { ana: [{ id: 'eu' }] } }),
      view({ sharers: ['ana'], watchers: { ana: [{ id: 'eu' }, { id: 'bia' }] } }),
      'eu'
    )
    gate.wsEventHandled()
    expect(play.mock.calls.map((c) => c[0])).toEqual(['liveStart', 'liveJoin'])
  })
})
