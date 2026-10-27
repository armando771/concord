import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ comments: undefined as unknown[] | undefined }))
vi.mock('../store/proposalStore', () => ({
  useProposalStore: (select: (s: unknown) => unknown) =>
    select({
      commentsByProposal: { p1: state.comments },
      loadComments: () => Promise.resolve(),
      editComment: vi.fn(),
      removeComment: vi.fn(),
      reactToComment: vi.fn()
    })
}))
vi.mock('../../../shared/store/toastStore', () => ({ showToast: { error: vi.fn(), info: vi.fn() } }))
vi.mock('../../../shared/ui/Avatar', () => ({ default: () => <u data-avatar /> }))
vi.mock('../../chat/components/MessageText', () => ({
  default: ({ content }: { content: string }) => <span>{content}</span>
}))
vi.mock('../../chat/components/MessageAttachments', () => ({ default: () => <u /> }))
vi.mock('../../chat/components/ReactionChips', () => ({ default: () => <u data-reacoes /> }))
vi.mock('../../chat/components/ReplyReference', () => ({ default: () => <u /> }))
vi.mock('../../chat/components/EmotePickerPopover', () => ({ default: () => <u /> }))
vi.mock('./CommentComposer', () => ({ default: () => <p>caixa de comentar</p> }))
vi.mock('./CommentActions', () => ({ default: () => <u /> }))
vi.mock('../../../shared/ui/skeleton/layouts', () => ({
  CommentListSkeleton: () => <p>skeleton</p>
}))

import { renderToStaticMarkup } from 'react-dom/server'
import ProposalComments from './ProposalComments'

const comment = (id: string, body: string): Record<string, unknown> => ({
  id,
  author_id: 'ana',
  author_name: 'Ana',
  body,
  created_at: '2026-10-26T12:00:00Z',
  attachments: [],
  reactions: [],
  mentions: []
})
const render = (): string =>
  renderToStaticMarkup(<ProposalComments proposalId="p1" meId="me" isTech={false} />)

describe('ProposalComments', () => {
  it('lista os comentários com a contagem e a caixa para comentar', () => {
    state.comments = [comment('c1', 'primeiro'), comment('c2', 'segundo')]
    const html = render()
    expect(html).toContain('Comentários (2)')
    expect(html).toContain('primeiro')
    expect(html).toContain('segundo')
    expect(html).toContain('caixa de comentar')
    expect(html).toContain('id="comment-c1"')
  })

  it('sem comentários, convida a começar a conversa', () => {
    state.comments = []
    expect(render()).toContain('Ninguém comentou ainda.')
  })

  it('enquanto carrega, mostra o esqueleto', () => {
    state.comments = undefined
    expect(render()).toContain('skeleton')
  })
})
