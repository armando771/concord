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
    expect(html).toContain('@Armando')
    expect(html).toContain('text-gray-300')
    expect(html).not.toContain('style=')
  })

  it('mostra aviso quando a mensagem original foi excluída', () => {
    const html = renderToStaticMarkup(
      <ReplyReference authorName={null} content="" onJump={() => {}} />
    )
    expect(html).toContain('Mensagem original foi excluída')
  })
})
