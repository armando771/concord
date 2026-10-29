import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ReplyReference from './ReplyReference'

describe('ReplyReference', () => {
  it('renderiza o nome do autor com a cor do cargo primário quando fornecida', () => {
    const html = renderToStaticMarkup(
      <ReplyReference
        authorName="Armando"
        authorColor="#e91e63"
        content="Olá mundo"
        onJump={() => {}}
      />
    )
    expect(html).toContain('@Armando')
    expect(html).toContain('color:#e91e63')
  })

  it('usa cor padrão (text-gray-300) quando authorColor não é definida', () => {
    const html = renderToStaticMarkup(
      <ReplyReference authorName="Armando" content="Olá mundo" onJump={() => {}} />
    )
    expect(html).toContain('<span class="shrink-0 font-semibold text-gray-300">@Armando</span>')
  })

  it('renderiza o avatar do autor na referência com foto ou inicial', () => {
    const htmlComFoto = renderToStaticMarkup(
      <ReplyReference
        authorName="Armando"
        authorAvatarUrl="https://example.com/avatar.png"
        content="Olá mundo"
        onJump={() => {}}
      />
    )
    expect(htmlComFoto).toContain('https://example.com/avatar.png')

    const htmlSemFoto = renderToStaticMarkup(
      <ReplyReference authorName="Armando" content="Olá mundo" onJump={() => {}} />
    )
    expect(htmlSemFoto).toContain('>A</div>')
  })

  it('usa emptyLabel padrão (🖼️ Imagem) quando content está vazio e nunca exibe como enquete', () => {
    const html = renderToStaticMarkup(
      <ReplyReference authorName="Armando" content="" onJump={() => {}} />
    )
    expect(html).toContain('🖼️ Imagem')
    expect(html).not.toContain('Enquete')
  })

  it('mostra aviso quando a mensagem original foi excluída', () => {
    const html = renderToStaticMarkup(
      <ReplyReference authorName={null} content="" onJump={() => {}} />
    )
    expect(html).toContain('Mensagem original foi excluída')
  })
})
