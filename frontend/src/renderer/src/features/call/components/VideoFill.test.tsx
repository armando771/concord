import { beforeEach, describe, expect, it, vi } from 'vitest'

const mine = {} as MediaStream
const bia = {} as MediaStream
const camera = {} as MediaStream

vi.mock('../store/callStore', () => ({
  useCallStore: (select: (s: unknown) => unknown) =>
    select({ localScreenStream: mine, screenStreams: { bia } })
}))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: (select: (s: unknown) => unknown) => select({ user: { id: 'eu' } })
}))

import { renderToStaticMarkup } from 'react-dom/server'
import VideoFill from './VideoFill'
import { useScreenStatsStore } from '../store/screenStatsStore'

describe('VideoFill', () => {
  beforeEach(() => useScreenStatsStore.getState().close())

  it('live: inteira (contain) sobre fundo preto, cantos arredondados', () => {
    const html = renderToStaticMarkup(<VideoFill stream={bia} fit="contain" />)
    expect(html).toContain('object-contain')
    expect(html).toContain('rounded-2xl')
    expect(html).toContain('muted')
  })

  it('câmera: preenche (cover), espelhada; tela cheia sem cantos', () => {
    const html = renderToStaticMarkup(<VideoFill stream={camera} fit="cover" mirror square />)
    expect(html).toContain('object-cover')
    expect(html).toContain('-scale-x-100')
    expect(html).not.toContain('rounded-2xl')
  })

  it('live (minha ou de outra pessoa) tem o ícone de estatísticas; câmera não', () => {
    const label = 'aria-label="Estatísticas da transmissão"'
    expect(renderToStaticMarkup(<VideoFill stream={bia} fit="contain" />)).toContain(label)
    expect(renderToStaticMarkup(<VideoFill stream={mine} fit="contain" />)).toContain(label)
    expect(renderToStaticMarkup(<VideoFill stream={camera} fit="cover" />)).not.toContain(label)
  })
})
