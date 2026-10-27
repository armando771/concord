import { describe, expect, it, vi } from 'vitest'

vi.mock('../../chat/components/ReplyReference', () => ({
  default: (p: { authorName: string | null; content: string }) => (
    <p data-reply>{`${p.authorName}|${p.content}`}</p>
  )
}))
vi.mock('../../chat/components/MessageText', () => ({
  default: ({ content }: { content: string }) => <span>{content}</span>
}))
vi.mock('../../chat/components/MessageAttachments', () => ({ default: () => <u data-anexos /> }))

import { renderToStaticMarkup } from 'react-dom/server'
import type { ProposalComment } from '../api/proposals'
import CommentEditForm from './CommentEditForm'
import { CommentBody, CommentMeta, CommentReply } from './CommentParts'

const base = {
  id: 'c1',
  author_id: 'ana',
  author_name: 'Ana',
  body: 'olá',
  created_at: '2026-10-26T12:00:00Z',
  attachments: [],
  reactions: [],
  mentions: []
} as unknown as ProposalComment
const com = (over: Partial<ProposalComment>): ProposalComment => ({ ...base, ...over })

describe('CommentReply', () => {
  it('comentário que não é resposta não mostra nada', () => {
    expect(renderToStaticMarkup(<CommentReply comment={base} onJump={() => {}} />)).toBe('')
  })

  it('resposta mostra o autor e o trecho do original', () => {
    const html = renderToStaticMarkup(
      <CommentReply
        comment={com({
          reply_to_id: 'c0',
          reply_to: { id: 'c0', author_name: 'Bia', body: 'pergunta', attachments: [] } as never
        })}
        onJump={() => {}}
      />
    )
    expect(html).toContain('data-reply')
    expect(html).toContain('Bia|')
  })

  it('resposta a um comentário apagado ainda mostra a faixa, sem autor', () => {
    const html = renderToStaticMarkup(
      <CommentReply comment={com({ reply_to_id: 'c0', reply_to: null })} onJump={() => {}} />
    )
    expect(html).toContain('null|')
  })
})

describe('CommentMeta', () => {
  it('mostra o autor, e "(editado)" só se foi editado', () => {
    expect(renderToStaticMarkup(<CommentMeta comment={base} />)).toContain('Ana')
    expect(renderToStaticMarkup(<CommentMeta comment={base} />)).not.toContain('(editado)')
    expect(
      renderToStaticMarkup(<CommentMeta comment={com({ edited_at: '2026-10-26T13:00:00Z' })} />)
    ).toContain('(editado)')
  })
})

describe('CommentBody', () => {
  const form = (
    <CommentEditForm draft="x" onDraft={() => {}} saveDisabled={false} onSave={() => {}} onCancel={() => {}} />
  )

  it('mostra o texto e os anexos', () => {
    const html = renderToStaticMarkup(
      <CommentBody comment={com({ attachments: [{}] as never })} editing={false} editForm={form} />
    )
    expect(html).toContain('olá')
    expect(html).toContain('data-anexos')
  })

  it('editando, troca o texto pelo formulário', () => {
    const html = renderToStaticMarkup(<CommentBody comment={base} editing editForm={form} />)
    expect(html).toContain('aria-label="Editar comentário"')
    expect(html).not.toContain('<span>olá</span>')
  })

  it('só com anexo, não desenha texto vazio', () => {
    const html = renderToStaticMarkup(
      <CommentBody comment={com({ body: '', attachments: [{}] as never })} editing={false} editForm={form} />
    )
    expect(html).toContain('data-anexos')
    expect(html).not.toContain('<span>')
  })
})
