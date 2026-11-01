import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import VolumeSlider from './VolumeSlider'

const render = (value: number): string =>
  renderToStaticMarkup(<VolumeSlider label="Volume" value={value} onChange={() => {}} />)

describe('VolumeSlider', () => {
  it('mostra a porcentagem e o valor do range', () => {
    const html = render(0.5)
    expect(html).toContain('50%')
    expect(html).toContain('value="50"')
  })

  it('acima de 100% o número fica em aviso (boost)', () => {
    expect(render(1.2)).toContain('text-warning')
    expect(render(1)).not.toContain('text-warning')
  })
})
