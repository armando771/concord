import { useEffect, useMemo, useState } from 'react'
import type { ProposalStatus } from '../api/proposals'
import { ApiError } from '../api/client'
import Button from '../components/Button'
import { DiamondIcon } from '../components/icons'
import NewProposalModal from '../components/proposals/NewProposalModal'
import ProposalCard from '../components/proposals/ProposalCard'
import { BOARD_COLUMNS, REJECTED_COLUMN } from '../lib/proposals'
import { useAuthStore } from '../store/authStore'
import { useProposalStore } from '../store/proposalStore'
import { showToast } from '../store/toastStore'

// Atualiza a contagem regressiva dos cards.
const CLOCK_MS = 30_000

function Proposals(): React.JSX.Element {
  const proposals = useProposalStore((s) => s.proposals)
  const isTech = useProposalStore((s) => s.isTech)
  const loading = useProposalStore((s) => s.loading)
  const fetchProposals = useProposalStore((s) => s.fetchProposals)
  const vote = useProposalStore((s) => s.vote)
  const removeVote = useProposalStore((s) => s.removeVote)
  const setStatus = useProposalStore((s) => s.setStatus)
  const remove = useProposalStore((s) => s.remove)
  const meId = useAuthStore((s) => s.user?.id ?? null)

  const [now, setNow] = useState(() => Date.now())
  const [creating, setCreating] = useState(false)
  const [showRejected, setShowRejected] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    fetchProposals()
  }, [fetchProposals])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_MS)
    return () => clearInterval(timer)
  }, [])

  const columns = showRejected ? [...BOARD_COLUMNS, REJECTED_COLUMN] : BOARD_COLUMNS
  const rejectedCount = useMemo(
    () => proposals.filter((p) => p.status === 'rejected').length,
    [proposals]
  )

  const run = async (id: string, action: () => Promise<void>, fallback: string): Promise<void> => {
    setBusyId(id)
    try {
      await action()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'voting_closed') {
        showToast.info('A votação dessa proposta já terminou.')
        fetchProposals()
      } else {
        showToast.error(err instanceof Error ? err.message : fallback)
      }
    } finally {
      setBusyId(null)
    }
  }

  const move = (id: string, status: ProposalStatus): Promise<void> =>
    run(id, () => setStatus(id, status), 'Não foi possível mover a proposta.')

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#07080b]/90 backdrop-blur-2xl text-gray-100">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/6 px-4">
          <DiamondIcon className="h-6 w-6 text-violet-400" />
          <span className="text-base font-bold tracking-wide text-white">Propostas</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={() => setShowRejected((v) => !v)}>
              {showRejected ? 'Ocultar recusadas' : `Ver recusadas (${rejectedCount})`}
            </Button>
            <Button onClick={() => setCreating(true)}>Nova proposta</Button>
          </div>
        </header>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">Carregando propostas...</div>
        ) : (
          <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto px-6 py-4">
            {columns.map((col) => {
              const cards = proposals
                .filter((p) => p.status === col.status)
                .sort((a, b) =>
                  col.status === 'voting'
                    ? a.voting_ends_at.localeCompare(b.voting_ends_at)
                    : (b.closed_at ?? b.created_at).localeCompare(a.closed_at ?? a.created_at)
                )
              return (
                <section
                  key={col.status}
                  className="flex min-h-0 min-w-64 flex-1 basis-64 flex-col rounded-2xl border border-white/6 bg-[#12141d]/60"
                >
                  <div className="shrink-0 px-3 pb-2 pt-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-white">{col.title}</h2>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-gray-300">
                        {cards.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">{col.hint}</p>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
                    {cards.length === 0 ? (
                      <p className="py-6 text-center text-xs text-gray-500">Nada por aqui ainda.</p>
                    ) : (
                      cards.map((p) => (
                        <ProposalCard
                          key={p.id}
                          proposal={p}
                          now={now}
                          meId={meId}
                          isTech={isTech}
                          busy={busyId === p.id}
                          onVote={(approve) =>
                            run(p.id, () => vote(p.id, approve), 'Não foi possível votar.')
                          }
                          onRemoveVote={() =>
                            run(p.id, () => removeVote(p.id), 'Não foi possível retirar o voto.')
                          }
                          onMove={(status) => move(p.id, status)}
                          onDelete={() =>
                            run(p.id, () => remove(p.id), 'Não foi possível excluir a proposta.')
                          }
                        />
                      ))
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      <NewProposalModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

export default Proposals
