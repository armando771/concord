import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Field } from './ProfileField'
import ProfileLinksField from './ProfileLinksField'
import UnsavedChangesBar from './UnsavedChangesBar'
import { saveLabel } from '../../lib/saveProfile'

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

describe('UnsavedChangesBar', () => {
  it('texto do botão', () => {
    expect(saveLabel(false, null)).toBe('Salvar alterações')
    expect(saveLabel(true, null)).toBe('Salvando...')
    expect(saveLabel(true, 0.42)).toBe('Enviando 42%')
  })
  it('tremendo e com erro', () => {
    const html = renderToStaticMarkup(
      <UnsavedChangesBar
        shaking
        saving={false}
        invalid
        progress={null}
        onReset={noop}
        onSave={noop}
      />
    )
    expect(html).toContain('unsaved-shake')
    expect(html).toContain('Corrija os campos em vermelho')
    const calm = renderToStaticMarkup(
      <UnsavedChangesBar
        shaking={false}
        saving={false}
        invalid={false}
        progress={null}
        onReset={noop}
        onSave={noop}
      />
    )
    expect(calm).not.toContain('unsaved-shake')
  })
})
