import { describe, expect, it, vi } from 'vitest'

vi.mock('../../chat/components/MessageActionsBar', () => ({
  default: (p: { onCopy?: unknown; onEdit?: unknown; onDelete?: unknown; deleteTitle: string }) => (
    <p
      data-copy={Boolean(p.onCopy)}
      data-edit={Boolean(p.onEdit)}
      data-delete={Boolean(p.onDelete)}
      data-title={p.deleteTitle}
    />
  )
}))

import { renderToStaticMarkup } from 'react-dom/server'
import type { ProposalComment } from '../api/proposals'
import CommentActions from './CommentActions'

const comment = {
  id: 'c1',
  author_id: 'ana',
  body: 'texto',
  created_at: new Date().toISOString(),
  attachments: [],
  reactions: [],
  mentions: []
} as unknown as ProposalComment

function render(meId: string | null, isTech: boolean, over: Partial<ProposalComment> = {}): string {
  return renderToStaticMarkup(
    <CommentActions
      comment={{ ...comment, ...over }}
      meId={meId}
      isTech={isTech}
      onReact={() => {}}
      onTogglePicker={() => {}}
      onReply={() => {}}
      onEdit={() => {}}
      onDelete={() => {}}
    />
  )
}

describe('CommentActions', () => {
  it('o autor pode copiar, editar e apagar o próprio comentário', () => {
    const html = render('ana', false)
    expect(html).toContain('data-copy="true"')
    expect(html).toContain('data-edit="true"')
    expect(html).toContain('data-delete="true"')
    expect(html).toContain('data-title="Excluir comentário"')
  })

  it('outra pessoa não edita nem apaga; o time tech apaga (com o título da moderação)', () => {
    const outro = render('bia', false)
    expect(outro).toContain('data-edit="false"')
    expect(outro).toContain('data-delete="false"')
    const tech = render('bia', true)
    expect(tech).toContain('data-delete="true"')
    expect(tech).toContain('Excluir comentário (time tech)')
  })

  it('comentário só com anexo não tem o que copiar', () => {
    expect(render('ana', false, { body: '' })).toContain('data-copy="false"')
  })
})
