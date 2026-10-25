import type { Proposal, ProposalStatus } from '../api/proposals'

/** Colunas do quadro, na ordem; "Recusada" fica atrás de um filtro. */
export const BOARD_COLUMNS: { status: ProposalStatus; title: string; hint: string }[] = [
  { status: 'voting', title: 'Em votação', hint: 'A comunidade decide em 7 dias' },
  { status: 'proposed', title: 'Proposto pro time tech', hint: 'Aprovado pela votação' },
  { status: 'in_progress', title: 'Em desenvolvimento', hint: 'O time está trabalhando' },
  { status: 'done', title: 'Concluído', hint: 'Já está no app' }
]

export const REJECTED_COLUMN = {
  status: 'rejected' as ProposalStatus,
  title: 'Recusada',
  hint: 'Não teve mais sim que não'
}

/** Para onde o time tech pode mover um card (espelha o backend). */
export const NEXT_STATUSES: Partial<Record<ProposalStatus, ProposalStatus[]>> = {
  proposed: ['in_progress', 'rejected'],
  in_progress: ['proposed', 'done', 'rejected'],
  done: ['in_progress']
}

export const STATUS_ACTION_LABEL: Record<ProposalStatus, string> = {
  voting: 'Em votação',
  proposed: 'Voltar para proposto',
  in_progress: 'Iniciar desenvolvimento',
  done: 'Marcar como concluído',
  rejected: 'Recusar'
}

/** "3d 4h", "5h 20min", "12min" ou "encerrando" quando o prazo acabou. */
export function timeLeftLabel(endsAt: string, now: number = Date.now()): string {
  const ms = new Date(endsAt).getTime() - now
  if (!Number.isFinite(ms) || ms <= 0) return 'encerrando'
  const minutes = Math.floor(ms / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes % 60}min`
  return `${Math.max(minutes, 1)}min`
}

/** Porcentagem de "sim" (0 quando ninguém votou). */
export function yesPercent(p: Pick<Proposal, 'yes_votes' | 'no_votes'>): number {
  const total = p.yes_votes + p.no_votes
  return total === 0 ? 0 : Math.round((p.yes_votes / total) * 100)
}

/** Ainda dá para votar: em votação e dentro do prazo. */
export function canVote(p: Pick<Proposal, 'status' | 'voting_ends_at'>, now = Date.now()): boolean {
  return p.status === 'voting' && new Date(p.voting_ends_at).getTime() > now
}

/** Propostas em votação em que a pessoa ainda não votou (badge da barra). */
export function pendingVoteCount(proposals: Proposal[], now = Date.now()): number {
  return proposals.filter((p) => canVote(p, now) && p.my_vote == null).length
}

/** Junta o card vindo do tempo real mantendo o voto de quem está logado. */
export function mergeProposal(list: Proposal[], incoming: Proposal): Proposal[] {
  const current = list.find((p) => p.id === incoming.id)
  const merged = { ...incoming, my_vote: incoming.my_vote ?? current?.my_vote ?? null }
  if (!current) return [merged, ...list]
  return list.map((p) => (p.id === incoming.id ? merged : p))
}
