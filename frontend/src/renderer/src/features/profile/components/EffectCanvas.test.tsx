import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EffectCanvas from './EffectCanvas'

const params = { density: 1, speed: 1, color: '#ff7a1a' }

describe('EffectCanvas', () => {
  it('efeito de canvas: um <canvas> decorativo por cima do cartão', () => {
    const html = renderToStaticMarkup(<EffectCanvas effect="fire" params={params} />)
    expect(html).toBe('<canvas aria-hidden="true" class="pt-fx"></canvas>')
  })

  it('efeito desconhecido (ou de CSS) não desenha nada', () => {
    expect(renderToStaticMarkup(<EffectCanvas effect="snow" params={params} />)).toBe('')
    expect(renderToStaticMarkup(<EffectCanvas effect="xyz" params={params} />)).toBe('')
  })
})
