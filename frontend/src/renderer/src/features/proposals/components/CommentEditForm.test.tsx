import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CommentEditForm from './CommentEditForm'

function render(over: Partial<React.ComponentProps<typeof CommentEditForm>> = {}): string {
  return renderToStaticMarkup(
    <CommentEditForm
      draft="oi"
      onDraft={() => {}}
      saveDisabled={false}
      onSave={() => {}}
      onCancel={() => {}}
      {...over}
    />
  )
}

describe('CommentEditForm', () => {
  it('mostra o texto, Cancelar e Salvar', () => {
    const html = render()
    expect(html).toContain('aria-label="Editar comentário"')
    expect(html).toContain('>oi</textarea>')
    expect(html).toContain('Cancelar')
    expect(html).toContain('Salvar')
  })

  it('Salvar fica desabilitado quando não dá para salvar', () => {
    expect(render({ saveDisabled: true })).toMatch(/<button[^>]*\sdisabled=""[^>]*>Salvar/)
    expect(render()).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>Salvar/)
  })
})
