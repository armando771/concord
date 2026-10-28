import { useEffect } from 'react'
import { ChangelogIcon, DiamondIcon } from '../../../shared/ui/icons'
import { CrownIcon } from '../../../shared/ui/iconsExtra'
import { useProposalStore } from '../../proposals/store/proposalStore'
import { useRankingStore } from '../../ranking/store/rankingStore'
import HubCard from '../components/HubCard'
import { CHANGELOG_PATH, PROPOSALS_PATH, RANKING_PATH, proposalsStat, rankStat } from '../lib/hub'

interface ViewProps {
  proposalsStat: string | null
  rankStat: string | null
}

/** Tela inicial da aba do diamante: três cards, um para cada assunto. */
export function ImprovementsHubView({ proposalsStat, rankStat }: ViewProps): React.JSX.Element {
  return (
    <div className="flex h-full w-full overflow-hidden bg-primary backdrop-blur-2xl text-gray-100">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-subtle px-4">
          <DiamondIcon className="h-6 w-6 text-violet-400" />
          <h1 className="text-base font-bold tracking-wide text-strong">Melhorias</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <p className="text-sm text-gray-400">
              Ajude a decidir o que vem por aí, veja o que mudou e confira quem manda nas calls.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <HubCard
                to={PROPOSALS_PATH}
                icon={<DiamondIcon className="size-7" />}
                title="Propostas de melhorias"
                description="Sugira ideias e vote no que o time deve construir."
                stat={proposalsStat}
                tone={{ glow: 'bg-violet-500', icon: 'text-violet-400' }}
              />
              <HubCard
                to={CHANGELOG_PATH}
                icon={<ChangelogIcon className="size-7" />}
                title="Novidades"
                description="O que mudou em cada versão do Salinha."
                stat={null}
                tone={{ glow: 'bg-emerald-500', icon: 'text-emerald-400' }}
              />
              <HubCard
                to={RANKING_PATH}
                icon={<CrownIcon className="size-7" />}
                title="Rank global"
                description="Os 100 maiores níveis do Salinha."
                stat={rankStat}
                tone={{ glow: 'bg-amber-400', icon: 'text-amber-300' }}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function ImprovementsHub(): React.JSX.Element {
  const proposals = useProposalStore((s) => s.proposals)
  const proposalsLoaded = useProposalStore((s) => s.loaded)
  const ranking = useRankingStore((s) => s.ranking)
  const fetchRanking = useRankingStore((s) => s.fetch)

  useEffect(() => {
    void fetchRanking()
  }, [fetchRanking])

  return (
    <ImprovementsHubView
      proposalsStat={proposalsStat(proposals, proposalsLoaded)}
      rankStat={rankStat(ranking !== null, ranking?.me ?? null)}
    />
  )
}

export default ImprovementsHub
