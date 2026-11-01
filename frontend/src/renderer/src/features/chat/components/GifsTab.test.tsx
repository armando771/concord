import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import GifsTab from './GifsTab'
import type { GiphyItem } from '../api/giphy'

const gif = { id: 'g1', title: 'Gato', url: 'https://g/1.gif', preview_url: '' } as GiphyItem

const render = (gifs: GiphyItem[], loading: boolean): string =>
  renderToStaticMarkup(<GifsTab gifs={gifs} loading={loading} onSelect={() => {}} />)

describe('GifsTab', () => {
  it('carregando, vazio e com GIFs', () => {
    expect(render([gif], true)).toContain('Carregando GIFs...')
    expect(render([], false)).toContain('Nenhum GIF encontrado.')
    const html = render([gif], false)
    expect(html).toContain('title="Gato"')
    expect(html).toContain('src="https://g/1.gif"')
  })
})
