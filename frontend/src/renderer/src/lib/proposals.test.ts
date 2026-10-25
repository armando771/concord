import { describe, expect, it } from 'vitest'
import type { PendingProposalMention, Proposal } from '../api/proposals'
import {
  badgeCount,
  canDeleteComment,
  canDeleteProposal,
  canEditComment,
  canEditProposal,
  canVote,
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
  MAX_MENTIONS,
  mentionIdsIn,
  mergeProposal,
  moveTargets,
  pickImageFiles,
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
