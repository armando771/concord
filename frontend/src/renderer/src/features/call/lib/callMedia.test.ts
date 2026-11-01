import { describe, expect, it } from 'vitest'
import {
  groupTracks,
  listScreenPublishers,
  StreamCache,
  wantsSubscription,
  type TrackEntry
} from './callMedia'

function fakeTrack(id: string): MediaStreamTrack {
  return { id } as MediaStreamTrack
}

describe('groupTracks', () => {
  it('separa microfone, tela, som da tela e câmera por usuário', () => {
    const entries: TrackEntry[] = [
      { userId: 'ana', source: 'microphone', track: fakeTrack('a-mic') },
      { userId: 'ana', source: 'screen_share', track: fakeTrack('a-screen') },
      { userId: 'ana', source: 'screen_share_audio', track: fakeTrack('a-screen-audio') },
      { userId: 'bia', source: 'microphone', track: fakeTrack('b-mic') },
      { userId: 'bia', source: 'camera', track: fakeTrack('b-cam') },
      { userId: 'bia', source: 'screen_share', track: fakeTrack('b-screen') }
    ]

    const grouped = groupTracks(entries)

    expect(grouped.voice).toEqual({ ana: [entries[0].track], bia: [entries[3].track] })
    expect(grouped.screen).toEqual({ ana: [entries[1].track], bia: [entries[5].track] })
    expect(grouped.screenAudio).toEqual({ ana: [entries[2].track] })
    expect(grouped.camera).toEqual({ bia: [entries[4].track] })
  })

  it('ignora fontes desconhecidas', () => {
    const grouped = groupTracks([{ userId: 'ana', source: 'unknown', track: fakeTrack('x') }])
    expect(grouped).toEqual({ voice: {}, screen: {}, screenAudio: {}, camera: {} })
  })
})

describe('StreamCache', () => {
  it('reaproveita o mesmo stream enquanto as tracks não mudam', () => {
    let created = 0
    const cache = new StreamCache((tracks) => ({ tracks, n: ++created }))
    const mic = fakeTrack('mic')

    const first = cache.get('ana:voice', [mic])
    const second = cache.get('ana:voice', [mic])

    expect(second).toBe(first)
    expect(created).toBe(1)
  })

  it('cria um stream novo quando as tracks mudam', () => {
    const cache = new StreamCache((tracks) => ({ tracks }))
    const first = cache.get('ana:screen', [fakeTrack('v1')])
    const second = cache.get('ana:screen', [fakeTrack('v2')])

    expect(second).not.toBe(first)
  })

  it('prune descarta chaves que não estão mais em uso', () => {
    let created = 0
    const cache = new StreamCache(() => ({ n: ++created }))
    const mic = fakeTrack('mic')
    cache.get('ana:voice', [mic])

    cache.prune(new Set())
    cache.get('ana:voice', [mic])

    expect(created).toBe(2)
  })
})

describe('wantsSubscription', () => {
  it('microfone e câmera sempre são assinados', () => {
    expect(wantsSubscription('microphone', 'ana', new Set())).toBe(true)
    expect(wantsSubscription('camera', 'ana', new Set())).toBe(true)
  })

  it('tela e som da tela só de quem estou assistindo', () => {
    expect(wantsSubscription('screen_share', 'ana', new Set())).toBe(false)
    expect(wantsSubscription('screen_share_audio', 'ana', new Set())).toBe(false)
    expect(wantsSubscription('screen_share', 'ana', new Set(['ana']))).toBe(true)
    expect(wantsSubscription('screen_share_audio', 'ana', new Set(['ana']))).toBe(true)
    expect(wantsSubscription('screen_share', 'bia', new Set(['ana']))).toBe(false)
  })
})

describe('listScreenPublishers', () => {
  it('lista quem publica tela, sem repetir, na ordem de chegada', () => {
    expect(
      listScreenPublishers([
        { userId: 'ana', source: 'microphone' },
        { userId: 'ana', source: 'screen_share' },
        { userId: 'ana', source: 'screen_share_audio' },
        { userId: 'bia', source: 'screen_share' },
        { userId: 'ana', source: 'screen_share' }
      ])
    ).toEqual(['ana', 'bia'])
  })

  it('sem tela devolve vazio', () => {
    expect(listScreenPublishers([{ userId: 'ana', source: 'microphone' }])).toEqual([])
  })
})
