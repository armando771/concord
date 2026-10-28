import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Field } from './ProfileField'
import ProfileLinksField from './ProfileLinksField'
import BannerColorField from './BannerColorField'

const noop = (): void => {}

describe('Field', () => {
  it('rótulo, dica, contador e erro', () => {
    const html = renderToStaticMarkup(
      <Field label="Nome" hint="Dica" error="Errado" counter={{ used: 12, max: 10 }}>
        <input />
      </Field>
    )
    expect(html).toContain('Nome')
    expect(html).toContain('Dica')
    expect(html).toContain('Errado')
    expect(html).toContain('-2')
    expect(html).toContain('text-danger')
  })
  it('só o rótulo', () => {
    const html = renderToStaticMarkup(
      <Field label="Nome">
        <input />
      </Field>
    )
    expect(html).not.toContain('text-danger')
  })
})

describe('ProfileLinksField', () => {
  it('um link com erro e o limite', () => {
    const links = ['a', 'b', 'c', 'd', 'e']
    const html = renderToStaticMarkup(
      <ProfileLinksField links={links} linkErrors={['Link inválido.']} onChange={noop} />
    )
    expect(html).toContain('Link inválido.')
    expect(html).toContain('Máximo de 5 links.')
  })
})

describe('BannerColorField', () => {
  it('cores prontas com nome; a escolhida fica marcada e dá para voltar ao padrão', () => {
    const html = renderToStaticMarkup(<BannerColorField value="#7c3aed" onChange={noop} />)
    expect(html).toContain('aria-label="Roxo"')
    expect(html).toMatch(/aria-label="Roxo" aria-pressed="true"/)
    expect(html).toContain('Usar a cor padrão')
  })
  it('sem cor: nada marcado, sem "padrão"; o erro aparece', () => {
    const html = renderToStaticMarkup(
      <BannerColorField value={null} error="Cor inválida." onChange={noop} />
    )
    expect(html).not.toContain('aria-pressed="true"')
    expect(html).not.toContain('Usar a cor padrão')
    expect(html).toContain('Cor inválida.')
  })
})
