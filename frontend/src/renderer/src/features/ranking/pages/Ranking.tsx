import { useEffect } from 'react'
import { CrownIcon } from '../../../shared/ui/icons'
import Button from '../../../shared/ui/Button'
import type { Ranking as RankingData } from '../api/ranking'
import MyRankBar from '../components/MyRankBar'
import PodiumCard from '../components/PodiumCard'
import RankRow from '../components/RankRow'
import { RankingSkeleton } from '../components/RankingSkeleton'
import { podiumSlots, splitRanking } from '../lib/ranking'
import { useRankingStore } from '../store/rankingStore'

interface ViewProps {
  ranking: RankingData | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

function RankingList({ ranking }: { ranking: RankingData }): React.JSX.Element {
  const { podium, rest } = splitRanking(ranking.entries)
  const myId = ranking.me?.position
  return (
    <>
      <ol aria-label="Pódio" className="flex items-end gap-2 sm:gap-4">
        {podiumSlots(podium).map((slot) => (
          <PodiumCard key={slot.entry.user_id} slot={slot} />
        ))}
      </ol>
      {rest.length > 0 && (
        <ol aria-label="Classificação" className="flex flex-col">
          {rest.map((entry) => (
            <RankRow key={entry.user_id} entry={entry} isMe={entry.position === myId} />
          ))}
        </ol>
      )}
    </>
  )
}

function RankingBody({ ranking, loading, error, onRetry }: ViewProps): React.JSX.Element {
  if (loading) return <RankingSkeleton />
  if (ranking === null) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-red-400">{error ?? 'Não foi possível carregar o ranking.'}</p>
        <Button variant="ghost" onClick={onRetry}>
          Tentar de novo
        </Button>
      </div>
    )
  }
  if (ranking.entries.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        Ninguém no ranking ainda. Entre numa call e seja o primeiro!
      </p>
    )
  }
  return <RankingList ranking={ranking} />
}

export function RankingView(props: ViewProps): React.JSX.Element {
  const { ranking, error, onRetry } = props
  return (
    <div className="flex h-full w-full overflow-hidden bg-primary backdrop-blur-2xl text-gray-100">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-subtle px-4">
          <CrownIcon className="h-5 w-5 text-amber-300" />
          <h1 className="text-base font-semibold">Rank global</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {ranking && error && (
              <p className="flex flex-wrap items-center gap-2 text-sm text-red-400">
                {error}
                <Button variant="ghost" onClick={onRetry}>
                  Tentar de novo
                </Button>
              </p>
            )}
            <RankingBody {...props} />
          </div>
        </main>
        {ranking && ranking.entries.length > 0 && <MyRankBar me={ranking.me} />}
      </div>
    </div>
  )
}

function Ranking(): React.JSX.Element {
  const ranking = useRankingStore((s) => s.ranking)
  const loading = useRankingStore((s) => s.loading)
  const error = useRankingStore((s) => s.error)
  const fetch = useRankingStore((s) => s.fetch)

  useEffect(() => {
    void fetch()
  }, [fetch])

  return (
    <RankingView ranking={ranking} loading={loading} error={error} onRetry={() => void fetch()} />
  )
}

export default Ranking
