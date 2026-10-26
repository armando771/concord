import { describe, expect, it } from 'vitest'
import { buildPerfContext } from './perfContext'

const idle = { status: 'idle', isScreenSharing: false, watchedScreenIds: [] as string[] }

describe('buildPerfContext', () => {
  it('normaliza a rota e deixa as flags desligadas fora de chamada', () => {
    expect(buildPerfContext('/channels/42', idle)).toEqual({
      route: '/channels/:id',
      inCall: false,
      sharing: false,
      watching: false
    })
  })

  it('só chamada ativa conta como inCall', () => {
    expect(buildPerfContext('/', { ...idle, status: 'active' }).inCall).toBe(true)
    expect(buildPerfContext('/', { ...idle, status: 'ringing' }).inCall).toBe(false)
    expect(buildPerfContext('/', { ...idle, status: 'outgoing' }).inCall).toBe(false)
  })

  it('transmitindo e assistindo vêm do estado da chamada', () => {
    const ctx = buildPerfContext('/', {
      status: 'active',
      isScreenSharing: true,
      watchedScreenIds: ['u1']
    })
    expect(ctx).toMatchObject({ sharing: true, watching: true })
  })
})
