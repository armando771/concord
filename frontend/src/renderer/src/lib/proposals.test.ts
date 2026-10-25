import { describe, expect, it } from 'vitest'
import type { PendingProposalMention, Proposal } from '../api/proposals'
import {
  badgeCount,
  canDeleteComment,
  canDeleteProposal,
  canDropOn,
  canEditComment,
  canEditProposal,
  canVote,
  closeLabel,
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
  MAX_MENTIONS,
  mentionIdsIn,
  mergeProposal,
  moveProposal,
  moveTargets,
  needsCloseConfirm,
  pickImageFiles,
  restoreProposal,
  sortColumn,
  timeLeftLabel,
  unseenCount,
  yesPercent
} from './proposals'

const NOW = new Date('2026-10-25T12:00:00Z').getTime()
const at = (ms: number): string => new Date(NOW + ms).toISOString()
const H = 3_600_000

const base: Proposal = {
  id: 'p1',
  author_id: 'u1',
  author_name: 'Ana',
  title: 'Modo escuro',
  description: '',
  status: 'voting',
  created_at: at(-H),
  voting_ends_at: at(2 * 24 * H),
  yes_votes: 0,
  no_votes: 0,
  comment_count: 0,
  images: []
}

const mention = (id: string): PendingProposalMention => ({
  proposal_id: 'p1',
  comment_id: id,
  proposal_title: 'Modo escuro',
  author_name: 'Beto',
  snippet: 'oi',
  created_at: at(-1000)
})

describe('timeLeftLabel', () => {
  it('formata dias, horas e minutos', () => {
    expect(timeLeftLabel(at(3 * 24 * H + 4 * H + 5000), NOW)).toBe('3d 4h')
    expect(timeLeftLabel(at(5 * H + 20 * 60_000 + 5000), NOW)).toBe('5h 20min')
    expect(timeLeftLabel(at(12 * 60_000 + 5000), NOW)).toBe('12min')
  })
  it('passou do prazo vira encerrando', () => {
    expect(timeLeftLabel(at(-1000), NOW)).toBe('encerrando')
    expect(timeLeftLabel('lixo', NOW)).toBe('encerrando')
  })
})

describe('yesPercent', () => {
  it('é 0 sem votos e arredonda', () => {
    expect(yesPercent({ yes_votes: 0, no_votes: 0 })).toBe(0)
    expect(yesPercent({ yes_votes: 2, no_votes: 1 })).toBe(67)
  })
})

describe('canVote', () => {
  it('só vota em votação e dentro do prazo', () => {
    expect(canVote(base, NOW)).toBe(true)
    expect(canVote({ ...base, status: 'proposed' }, NOW)).toBe(false)
    expect(canVote({ ...base, voting_ends_at: at(-1) }, NOW)).toBe(false)
  })
})

describe('unseenCount / badgeCount', () => {
  const seenAt = NOW - 2 * H

  it('conta só as novas em votação desde a última visita', () => {
    const list = [
      { ...base, id: 'nova', created_at: at(-H) },
      { ...base, id: 'antiga', created_at: at(-3 * H) },
      { ...base, id: 'minha', author_id: 'me', created_at: at(-H) },
      { ...base, id: 'fechada', status: 'done' as const, created_at: at(-H) },
      { ...base, id: 'vencida', voting_ends_at: at(-1), created_at: at(-H) }
    ]
    expect(unseenCount(list, seenAt, 'me', NOW)).toBe(1)
  })
  it('não conta nada antes de saber a última visita', () => {
    expect(unseenCount([base], null, 'me', NOW)).toBe(0)
  })
  it('o badge soma propostas novas e menções não vistas', () => {
    expect(badgeCount([base], [mention('c1'), mention('c2')], seenAt, 'me', NOW)).toBe(3)
    expect(badgeCount([], [], seenAt, 'me', NOW)).toBe(0)
  })
})

describe('moveTargets', () => {
  it('qualquer coluna, menos votação e a atual', () => {
    expect(moveTargets('voting')).toEqual(['proposed', 'in_progress', 'done', 'rejected'])
    expect(moveTargets('proposed')).toEqual(['in_progress', 'done', 'rejected'])
    expect(moveTargets('rejected')).toEqual(['proposed', 'in_progress', 'done'])
  })
})

describe('permissões', () => {
  it('autor edita só em votação aberta; time tech sempre', () => {
    expect(canEditProposal(base, 'u1', false, NOW)).toBe(true)
    expect(canEditProposal(base, 'u2', false, NOW)).toBe(false)
    expect(canEditProposal({ ...base, status: 'proposed' }, 'u1', false, NOW)).toBe(false)
    expect(canEditProposal({ ...base, voting_ends_at: at(-1) }, 'u1', false, NOW)).toBe(false)
    expect(canEditProposal({ ...base, status: 'done' }, 'u2', true, NOW)).toBe(true)
  })
  it('autor apaga em votação; time tech sempre', () => {
    expect(canDeleteProposal(base, 'u1', false)).toBe(true)
    expect(canDeleteProposal({ ...base, status: 'proposed' }, 'u1', false)).toBe(false)
    expect(canDeleteProposal({ ...base, status: 'proposed' }, 'u2', true)).toBe(true)
  })
  it('comentário: autor edita; autor e time tech apagam', () => {
    const c = { author_id: 'u1' }
    expect(canEditComment(c, 'u1')).toBe(true)
    expect(canEditComment(c, 'tech')).toBe(false)
    expect(canDeleteComment(c, 'tech', true)).toBe(true)
    expect(canDeleteComment(c, 'u2', false)).toBe(false)
    expect(canDeleteComment(c, null, false)).toBe(false)
  })
})

describe('pickImageFiles', () => {
  const png = (name = 'a.png', size = 1000): File =>
    ({ name, type: 'image/png', size }) as unknown as File

  it('aceita imagens e recusa o resto com motivo', () => {
    const out = pickImageFiles(0, [
      png(),
      { name: 'v.mp4', type: 'video/mp4', size: 10 } as unknown as File,
      png('grande.png', MAX_IMAGE_BYTES + 1)
    ])
    expect(out.accepted).toHaveLength(1)
    expect(out.errors).toHaveLength(2)
  })
  it('reconhece pela extensão quando o tipo vem vazio', () => {
    const f = { name: 'foto.JPG', type: '', size: 10 } as unknown as File
    expect(pickImageFiles(0, [f]).accepted).toEqual([f])
  })
  it('respeita o máximo de imagens junto das que já existem', () => {
    const out = pickImageFiles(MAX_IMAGES - 1, [png('1.png'), png('2.png')])
    expect(out.accepted).toHaveLength(1)
    expect(out.errors).toEqual([`Máximo de ${MAX_IMAGES} imagens por proposta.`])
  })
})

describe('mentionIdsIn', () => {
  it('só envia quem ainda está marcado no texto', () => {
    const picked = new Map([
      ['ana', 'id-ana'],
      ['beto', 'id-beto']
    ])
    expect(mentionIdsIn('oi @ana, tudo bem?', picked)).toEqual(['id-ana'])
    expect(mentionIdsIn('sem marcar ninguém', picked)).toEqual([])
  })
  it('limita ao máximo de menções por comentário', () => {
    const picked = new Map<string, string>()
    let body = ''
    for (let i = 0; i < MAX_MENTIONS + 3; i++) {
      picked.set(`user${i}`, `id${i}`)
      body += `@user${i} `
    }
    expect(mentionIdsIn(body, picked)).toHaveLength(MAX_MENTIONS)
  })
})

describe('mergeProposal', () => {
  it('mantém o meu voto quando o evento não traz', () => {
    const list = [{ ...base, my_vote: true }]
    const out = mergeProposal(list, { ...base, yes_votes: 3 })
    expect(out[0].yes_votes).toBe(3)
    expect(out[0].my_vote).toBe(true)
  })
  it('card novo entra no começo', () => {
    const out = mergeProposal([base], { ...base, id: 'p9' })
    expect(out.map((p) => p.id)).toEqual(['p9', 'p1'])
  })
})

const ALL = ['voting', 'proposed', 'in_progress', 'done', 'rejected'] as const

describe('canDropOn', () => {
  it('aceita qualquer coluna diferente, menos Em votação', () => {
    expect(canDropOn('voting', 'proposed')).toBe(true)
    expect(canDropOn('proposed', 'done')).toBe(true)
    expect(canDropOn('done', 'in_progress')).toBe(true)
    expect(canDropOn('in_progress', 'rejected')).toBe(true)
    expect(canDropOn('rejected', 'proposed')).toBe(true)
  })
  it('recusa a mesma coluna e a volta para votação', () => {
    expect(canDropOn('proposed', 'proposed')).toBe(false)
    expect(canDropOn('voting', 'voting')).toBe(false)
    expect(canDropOn('done', 'voting')).toBe(false)
    expect(canDropOn('rejected', 'voting')).toBe(false)
  })
  it('permite exatamente o que o menu Mover para oferece', () => {
    for (const from of ALL) {
      expect(ALL.filter((to) => canDropOn(from, to))).toEqual(moveTargets(from))
    }
  })
})

describe('needsCloseConfirm', () => {
  it('só pergunta ao tirar o card de Em votação', () => {
    expect(needsCloseConfirm({ status: 'voting' })).toBe(true)
    expect(needsCloseConfirm({ status: 'proposed' })).toBe(false)
    expect(needsCloseConfirm({ status: 'rejected' })).toBe(false)
  })
})

describe('sortColumn', () => {
  it('em votação: o prazo que acaba primeiro vem antes', () => {
    const a = { ...base, id: 'a', voting_ends_at: at(3 * H) }
    const b = { ...base, id: 'b', voting_ends_at: at(1 * H) }
    expect(sortColumn([a, b], 'voting').map((p) => p.id)).toEqual(['b', 'a'])
  })
  it('nas outras colunas: quem entrou por último fica no topo', () => {
    const old = { ...base, id: 'old', status: 'proposed' as const, moved_at: at(-5 * H) }
    const fresh = { ...base, id: 'fresh', status: 'proposed' as const, moved_at: at(-1 * H) }
    expect(sortColumn([old, fresh], 'proposed').map((p) => p.id)).toEqual(['fresh', 'old'])
  })
  it('sem moved_at cai no closed_at e depois no created_at', () => {
    const a = { ...base, id: 'a', status: 'done' as const, closed_at: at(-2 * H) }
    const b = { ...base, id: 'b', status: 'done' as const, created_at: at(-9 * H) }
    expect(sortColumn([b, a], 'done').map((p) => p.id)).toEqual(['a', 'b'])
  })
  it('não altera a lista original', () => {
    const list = [
      { ...base, id: 'a', voting_ends_at: at(3 * H) },
      { ...base, id: 'b', voting_ends_at: at(1 * H) }
    ]
    sortColumn(list, 'voting')
    expect(list.map((p) => p.id)).toEqual(['a', 'b'])
  })
})

describe('moveProposal / restoreProposal', () => {
  it('move só o card pedido, grava moved_at e o fechamento', () => {
    const other = { ...base, id: 'p2' }
    const out = moveProposal([base, other], 'p1', 'in_progress', NOW)
    expect(out[0].status).toBe('in_progress')
    expect(out[0].moved_at).toBe(new Date(NOW).toISOString())
    expect(out[0].closed_at).toBe(new Date(NOW).toISOString())
    expect(out[0].close_reason).toBe('manual')
    expect(out[1]).toBe(other)
  })
  it('mover de uma coluna já fechada mantém o closed_at e o motivo', () => {
    const closed = {
      ...base,
      status: 'proposed' as const,
      closed_at: at(-3 * H),
      close_reason: 'deadline' as const
    }
    const out = moveProposal([closed], 'p1', 'done', NOW)[0]
    expect(out.closed_at).toBe(at(-3 * H))
    expect(out.close_reason).toBe('deadline')
    expect(out.moved_at).toBe(new Date(NOW).toISOString())
  })
  it('o desfazer devolve o card exatamente como estava', () => {
    const moved = moveProposal([base], 'p1', 'done', NOW)
    expect(restoreProposal(moved, base)).toEqual([base])
  })
  it('id que não existe não muda nada', () => {
    expect(moveProposal([base], 'x', 'done', NOW)).toEqual([base])
  })
})

describe('closeLabel', () => {
  it('não mostra nada em votação', () => {
    expect(closeLabel(base)).toBeNull()
  })
  it('diz quem encerrou, ou que foi o prazo', () => {
    const closed = { ...base, status: 'proposed' as const, closed_at: '2026-10-25T12:00:00Z' }
    expect(closeLabel({ ...closed, close_reason: 'manual', closed_by_name: 'Hugo' })).toContain(
      'encerrada por Hugo (time tech)'
    )
    expect(closeLabel({ ...closed, close_reason: 'manual' })).toContain('pelo time tech')
    expect(closeLabel({ ...closed, close_reason: 'deadline' })).toContain('pelo prazo')
  })
})
