import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import BackgroundPicker from './BackgroundPicker'
import type { BackgroundPreset, CustomBackground, VideoBackground } from '../lib/videoBackground'

const presets: BackgroundPreset[] = [
  { id: 'aurora', label: 'Aurora', dataUrl: 'data:image/svg+xml,aurora' },
  { id: 'oceano', label: 'Oceano', dataUrl: 'data:image/svg+xml,oceano' }
]
const customs: CustomBackground[] = [{ id: 'c1', dataUrl: 'data:image/jpeg;base64,AAA' }]
const none: VideoBackground = { mode: 'none', image: null }

function render(
  value: VideoBackground,
  extra: { error?: string | null; customs?: CustomBackground[] } = {}
): string {
  return renderToStaticMarkup(
    <BackgroundPicker
      value={value}
      customs={extra.customs ?? customs}
      presets={presets}
      error={extra.error}
      onChange={vi.fn()}
      onUpload={vi.fn()}
      onRemoveCustom={vi.fn()}
    />
  )
}

/** O botão (só ele) cujo texto ou aria-label contém `name`, para olhar o aria-pressed. */
function button(html: string, name: string): string {
  const found = html.split('<button').find((b) => b.split('</button>')[0].includes(name))
  expect(found, `botão ${name}`).toBeTruthy()
  return found!.split('</button>')[0]
}

describe('BackgroundPicker', () => {
  it('mostra Nenhum, Borrar, Personalizado e as imagens prontas (como no Discord)', () => {
    const html = render(none)
    expect(html).toContain('aria-label="Fundo do vídeo"')
    expect(html).toContain('Nenhum')
    expect(html).toContain('Borrar')
    expect(html).toContain('Personalizado')
    expect(html).toContain('aria-label="Aurora"')
    expect(html).toContain('aria-label="Oceano"')
    expect(html).toContain('data:image/svg+xml,aurora')
  })

  it('não tem nada de cor-chave, pano ou sensibilidade', () => {
    const html = render(none).toLowerCase()
    for (const word of ['chroma', 'pano', 'sensibilidade', 'verde', 'conta-gotas']) {
      expect(html).not.toContain(word)
    }
  })

  it('marca "Nenhum" como escolhido por padrão', () => {
    const html = render(none)
    expect(button(html, 'Nenhum')).toContain('aria-pressed="true"')
    expect(button(html, 'Borrar')).toContain('aria-pressed="false"')
  })

  it('marca Borrar quando é o fundo', () => {
    const html = render({ mode: 'blur', image: null })
    expect(button(html, 'Borrar')).toContain('aria-pressed="true"')
    expect(button(html, 'Nenhum')).toContain('aria-pressed="false"')
  })

  it('marca só a imagem pronta escolhida', () => {
    const html = render({ mode: 'image', image: { kind: 'preset', id: 'oceano' } })
    expect(button(html, 'aria-label="Oceano"')).toContain('aria-pressed="true"')
    expect(button(html, 'aria-label="Aurora"')).toContain('aria-pressed="false"')
  })

  it('imagem salva tem botão de remover e marca quando escolhida', () => {
    const html = render({ mode: 'image', image: { kind: 'custom', id: 'c1' } })
    expect(html).toContain('aria-label="Remover imagem"')
    expect(button(html, 'aria-label="Imagem personalizada"')).toContain('aria-pressed="true"')
  })

  it('GIF salvo aparece com a etiqueta GIF', () => {
    const gifs: CustomBackground[] = [
      { id: 'g1', dataUrl: 'blob:http://x/abc', animated: true },
      ...customs
    ]
    const html = render({ mode: 'none', image: null }, { customs: gifs })
    expect(html.match(/>GIF</g)).toHaveLength(1)
    expect(html.match(/aria-label="Remover imagem"/g)).toHaveLength(2)
  })

  it('sem imagens salvas não mostra remover', () => {
    expect(render(none, { customs: [] })).not.toContain('Remover imagem')
  })

  it('mostra o erro de envio', () => {
    const html = render(none, { error: 'A imagem é grande demais (máx. 15 MB).' })
    expect(html).toContain('role="alert"')
    expect(html).toContain('grande demais')
  })

  it('o campo de arquivo só aceita imagens', () => {
    expect(render(none)).toContain('accept="image/*"')
  })
})
