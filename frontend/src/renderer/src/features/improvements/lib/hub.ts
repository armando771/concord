import type { Proposal } from '../../proposals/api/proposals'
import type { MyRank } from '../../ranking/api/ranking'
import { myPositionText } from '../../ranking/lib/ranking'

// Rotas da aba do diamante: o hub e as três telas que ele abre.
export const HUB_PATH = '/melhorias'
export const PROPOSALS_PATH = '/proposals'
export const CHANGELOG_PATH = '/changelog'
export const RANKING_PATH = '/ranking'

const HUB_PATHS = [HUB_PATH, PROPOSALS_PATH, CHANGELOG_PATH, RANKING_PATH]

/** O caminho é o hub ou uma das telas dele (acende o diamante no trilho). */
export function isHubPath(path: string): boolean {
  return HUB_PATHS.some((p) => path === p || path.startsWith(`${p}/`))
}

/** Dado ao vivo do card Propostas; nulo enquanto o quadro não carregou. */
export function proposalsStat(proposals: Proposal[], loaded: boolean): string | null {
  if (!loaded) return null
  const voting = proposals.filter((p) => p.status === 'voting').length
  if (voting === 0) return 'Nenhuma em votação'
  return voting === 1 ? '1 em votação' : `${voting} em votação`
}

/** Dado ao vivo do card Rank global; nulo enquanto o ranking não carregou. */
export function rankStat(loaded: boolean, me: MyRank | null): string | null {
  return loaded ? myPositionText(me) : null
}
