import { describe, expect, it } from 'vitest'
import { myLiveWatchers } from './overlayWatchers'

const ana = { id: 'ana' }
const bia = { id: 'bia' }

describe('myLiveWatchers', () => {
  it('sem live, nada aparece (mesmo com lista de espectadores sobrando)', () => {
    expect(myLiveWatchers({ live: false, show: true, meId: 'eu', watchers: [ana] })).toEqual({
      viewers: null,
      ids: []
    })
  })

  it('opção desligada: nada aparece', () => {
    expect(myLiveWatchers({ live: true, show: false, meId: 'eu', watchers: [ana] })).toEqual({
      viewers: null,
      ids: []
    })
  })

  it('live sem ninguém assistindo mostra o olho com 0', () => {
    expect(myLiveWatchers({ live: true, show: true, meId: 'eu', watchers: [] })).toEqual({
      viewers: 0,
      ids: []
    })
  })

  it('conta e lista quem assiste, sem repetir nem contar a mim', () => {
    const watchers = [ana, bia, { id: 'ana' }, { id: 'eu' }]
    expect(myLiveWatchers({ live: true, show: true, meId: 'eu', watchers })).toEqual({
      viewers: 2,
      ids: ['ana', 'bia']
    })
  })
})
