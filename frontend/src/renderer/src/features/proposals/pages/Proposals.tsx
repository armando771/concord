import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ProposalStatus } from '../api/proposals'
import { ApiError } from '../../../shared/api/client'
import Button from '../../../shared/ui/Button'
import { ChangelogIcon, DiamondIcon } from '../../../shared/ui/icons'
import BoardColumn from '../components/BoardColumn'
import ConfirmCloseModal from '../components/ConfirmCloseModal'
import ConfirmTakeoverModal from '../components/ConfirmTakeoverModal'
import GithubUsernameButton from '../components/GithubUsernameButton'
import DraggableProposalCard from '../components/DraggableProposalCard'
import RejectDropZone from '../components/RejectDropZone'
import NewProposalModal from '../components/NewProposalModal'
import ProposalDetailModal from '../components/ProposalDetailModal'
import ProposalCard from '../components/ProposalCard'
import {
  BOARD_COLUMNS,
  canDropOn,
  needsCloseConfirm,
  needsTakeover,
  REJECTED_COLUMN,
  sortColumn
} from '../lib/proposals'
import { snapCenterToCursor } from '../../../shared/lib/dragModifiers'
import { useAuthStore } from '../../auth/store/authStore'
import { useProposalStore } from '../store/proposalStore'
import { showToast } from '../../../shared/store/toastStore'
import { ProposalBoardSkeleton } from '../../../shared/ui/skeleton/layouts'

interface ProposalActions {
  onVote: (approve: boolean) => Promise<void>
  onRemoveVote: () => Promise<void>
  onMove: (status: ProposalStatus) => Promise<void>
  onDelete: () => Promise<void>
}

// Atualiza a contagem regressiva dos cards.
const CLOCK_MS = 30_000

// O arrasto só começa depois de alguns pixels: um clique parado abre o card e os
// botões de dentro dele continuam funcionando.
const DRAG_DISTANCE_PX = 8

function Proposals(): React.JSX.Element {
  const proposals = useProposalStore((s) => s.proposals)
  const isTech = useProposalStore((s) => s.isTech)
  const loading = useProposalStore((s) => s.loading)
  const fetchProposals = useProposalStore((s) => s.fetchProposals)
  const vote = useProposalStore((s) => s.vote)
  const removeVote = useProposalStore((s) => s.removeVote)
  const setStatus = useProposalStore((s) => s.setStatus)
  const remove = useProposalStore((s) => s.remove)
  const markSeen = useProposalStore((s) => s.markSeen)
  const markMentionsSeen = useProposalStore((s) => s.markMentionsSeen)
  const pendingMentions = useProposalStore((s) => s.pendingMentions)
  const meId = useAuthStore((s) => s.user?.id ?? null)

  const [now, setNow] = useState(() => Date.now())
  const [creating, setCreating] = useState(false)
  const [showRejected, setShowRejected] = useState(false)
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  // Mover um card em votação espera a confirmação do time tech.
  const [pendingMove, setPendingMove] = useState<{ id: string; status: ProposalStatus } | null>(
    null
  )
  // O card aberto fica na URL (?proposal=<id>): as notificações de menção abrem direto nele.
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('proposal')
  const selected = selectedId ? (proposals.find((p) => p.id === selectedId) ?? null) : null
  const dragging = draggingId ? (proposals.find((p) => p.id === draggingId) ?? null) : null
  // Se a votação acabou (ou o card sumiu) com a confirmação aberta, não há mais o que confirmar.
  const pendingCard = pendingMove ? (proposals.find((p) => p.id === pendingMove.id) ?? null) : null
  // Mover um card que está com outro dev pede confirmação (tira a tarefa dele).
  const [pendingTakeover, setPendingTakeover] = useState<{
    id: string
    status: ProposalStatus
  } | null>(null)
  const takeoverCard = pendingTakeover
    ? (proposals.find((p) => p.id === pendingTakeover.id) ?? null)
    : null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_DISTANCE_PX } })
  )

  useEffect(() => {
    fetchProposals()
  }, [fetchProposals])

  // Abrir o quadro zera o badge; sair marca de novo o que chegou enquanto estava aqui.
  useEffect(() => {
    markSeen()
    return () => markSeen()
  }, [markSeen])

  // Proposta que não existe mais (apagada, ou link antigo): fecha o modal.
  useEffect(() => {
    if (selectedId && !loading && !selected) setParams({}, { replace: true })
  }, [selectedId, selected, loading, setParams])

  // Quem abre o card vê as menções dele, inclusive as que chegam com o modal aberto.
  const hasMentionHere = selectedId
    ? pendingMentions.some((m) => m.proposal_id === selectedId)
    : false
  useEffect(() => {
    if (selectedId && hasMentionHere) void markMentionsSeen(selectedId)
  }, [selectedId, hasMentionHere, markMentionsSeen])

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

  // O card já voltou sozinho (setStatus desfaz); recarregar mostra o que mudou de verdade
  // (por exemplo, outra pessoa moveu o mesmo card antes).
  const move = (id: string, status: ProposalStatus, takeOver = false): Promise<void> =>
    run(
      id,
      async () => {
        try {
          await setStatus(id, status, takeOver)
        } catch (err) {
          await fetchProposals()
          // Outro dev pegou o card no meio: confirma de novo, já com o nome dele.
          if (err instanceof ApiError && err.code === 'assignee_conflict') {
            setPendingTakeover({ id, status })
            return
          }
          throw err
        }
      },
      'Não foi possível mover a proposta.'
    )

  // Arrastando ou pelo menu "Mover para…": a mesma regra e as mesmas confirmações.
  const requestMove = async (id: string, status: ProposalStatus): Promise<void> => {
    const card = proposals.find((p) => p.id === id)
    if (!card || !canDropOn(card.status, status)) return
    if (needsCloseConfirm(card)) {
      setPendingMove({ id, status })
      return
    }
    if (needsTakeover(card, meId, status)) {
      setPendingTakeover({ id, status })
      return
    }
    await move(id, status)
  }

  const actions = (id: string): ProposalActions => ({
    onVote: (approve) => run(id, () => vote(id, approve), 'Não foi possível votar.'),
    onRemoveVote: () => run(id, () => removeVote(id), 'Não foi possível retirar o voto.'),
    onMove: (status) => requestMove(id, status),
    onDelete: () => run(id, () => remove(id), 'Não foi possível excluir a proposta.')
  })

  const handleDragStart = (event: DragStartEvent): void => setDraggingId(String(event.active.id))

  const endDrag = (): void => setDraggingId(null)

  const handleDragEnd = (event: DragEndEvent): void => {
    endDrag()
    const card = proposals.find((p) => p.id === event.active.id)
    if (!card || !event.over) return
    const target = event.over.id as ProposalStatus
    if (target === 'voting' && card.status !== 'voting') {
      showToast.info('Uma votação encerrada não reabre.')
      return
    }
    if (canDropOn(card.status, target)) void requestMove(card.id, target)
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-primary backdrop-blur-2xl text-gray-100">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-subtle px-4">
          <DiamondIcon className="h-6 w-6 text-violet-400" />
          <span className="text-base font-bold tracking-wide text-strong">Propostas</span>
          <div className="flex items-center gap-2">
            {isTech && <GithubUsernameButton />}
            <Button variant="ghost" onClick={() => setShowRejected((v) => !v)}>
              {showRejected ? 'Ocultar recusadas' : `Ver recusadas (${rejectedCount})`}
            </Button>
            <Button
              variant="ghost"
              className="inline-flex items-center"
              onClick={() => navigate('/changelog')}
            >
              <ChangelogIcon className="mr-1.5 h-4 w-4" />
              Novidades
            </Button>
            <Button onClick={() => setCreating(true)}>Nova proposta</Button>
          </div>
        </header>

        {loading ? (
          <ProposalBoardSkeleton columns={columns} />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={endDrag}
          >
            <div className="relative flex min-h-0 flex-1">
              <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto px-6 py-4">
                {columns.map((col) => {
                  const cards = sortColumn(
                    proposals.filter((p) => p.status === col.status),
                    col.status
                  )
                  return (
                    <BoardColumn
                      key={col.status}
                      status={col.status}
                      title={col.title}
                      hint={col.hint}
                      count={cards.length}
                      dragFrom={dragging?.status ?? null}
                    >
                      {cards.length === 0 ? (
                        <p className="py-6 text-center text-xs text-gray-500">
                          Nada por aqui ainda.
                        </p>
                      ) : (
                        cards.map((p) => (
                          <DraggableProposalCard
                            key={p.id}
                            draggable={isTech && busyId !== p.id}
                            proposal={p}
                            now={now}
                            meId={meId}
                            isTech={isTech}
                            busy={busyId === p.id}
                            onOpen={() => setParams({ proposal: p.id })}
                            {...actions(p.id)}
                          />
                        ))
                      )}
                    </BoardColumn>
                  )
                })}
              </div>
              {/* Com "Recusada" oculta, uma faixa fixa recebe os cards recusados durante o arrasto. */}
              {dragging && !showRejected && dragging.status !== 'rejected' && <RejectDropZone />}
            </div>
            {/* Sem animação de soltar: o card já está na coluna nova (movido na hora). */}
            <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
              {dragging && (
                <ProposalCard
                  overlay
                  proposal={dragging}
                  now={now}
                  meId={meId}
                  isTech={false}
                  busy={false}
                  onOpen={() => {}}
                  onVote={() => {}}
                  onRemoveVote={() => {}}
                  onMove={() => {}}
                  onDelete={() => {}}
                />
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <NewProposalModal open={creating} onClose={() => setCreating(false)} />
      {selected && (
        <ProposalDetailModal
          proposal={selected}
          now={now}
          meId={meId}
          isTech={isTech}
          busy={busyId === selected.id}
          onClose={() => setParams({})}
          {...actions(selected.id)}
        />
      )}
      {pendingMove && pendingCard && needsCloseConfirm(pendingCard) && (
        <ConfirmCloseModal
          proposal={pendingCard}
          target={pendingMove.status}
          onCancel={() => setPendingMove(null)}
          onConfirm={() => {
            const { id, status } = pendingMove
            setPendingMove(null)
            void move(id, status)
          }}
        />
      )}
      {pendingTakeover && takeoverCard?.assignee && (
        <ConfirmTakeoverModal
          proposal={takeoverCard}
          target={pendingTakeover.status}
          onCancel={() => setPendingTakeover(null)}
          onConfirm={() => {
            const { id, status } = pendingTakeover
            setPendingTakeover(null)
            void move(id, status, true)
          }}
        />
      )}
    </div>
  )
}

export default Proposals
