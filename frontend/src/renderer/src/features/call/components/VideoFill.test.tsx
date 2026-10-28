import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import VideoFill from './VideoFill'

const stream = {} as MediaStream

describe('VideoFill', () => {
  it('live: inteira (contain) sobre fundo preto, cantos arredondados', () => {
    const html = renderToStaticMarkup(<VideoFill stream={stream} fit="contain" />)
    expect(html).toContain('object-contain')
    expect(html).toContain('rounded-2xl')
    expect(html).toContain('muted')
  })

  it('câmera: preenche (cover), espelhada; tela cheia sem cantos', () => {
    const html = renderToStaticMarkup(<VideoFill stream={stream} fit="cover" mirror square />)
    expect(html).toContain('object-cover')
    expect(html).toContain('-scale-x-100')
    expect(html).not.toContain('rounded-2xl')
  })
})
