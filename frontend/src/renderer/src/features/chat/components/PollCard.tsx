import { useEffect, useState } from 'react'
import type { Poll, PollAnswer } from '../api/messages'
import { isPollClosed, pollPercent, pollTimeLeft, pollWinners } from '../lib/polls'
import { showToast } from '../../../shared/store/toastStore'
import { PollIcon } from '../../../shared/ui/icons'

interface PollCardProps {
  poll: Poll
  isAuthor: boolean
  onVote: (answerIds: number[]) => Promise<void>
  onEnd: () => Promise<void>
}

/** Emoji ou mini imagem da resposta. */
export function PollAnswerMedia({
  answer,
  className = 'h-6 w-6 text-xl'
}: {
  answer: Pick<PollAnswer, 'emoji' | 'image_url'>
  className?: string
}): React.JSX.Element | null {
  if (answer.emoji) {
    return (
      <span className={`flex shrink-0 items-center justify-center leading-none ${className}`}>
        {answer.emoji}
      </span>
    )
  }
  if (answer.image_url) {
    return (
      <img
        src={answer.image_url}
        alt=""
        className={`shrink-0 rounded object-cover ${className}`}
        draggable={false}
      />
    )
  }
  return null
}

/** Re-renderiza a cada 30 s para atualizar o "Faltam…" e encerrar no prazo. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function PollCard({ poll, isAuthor, onVote, onEnd }: PollCardProps): React.JSX.Element {
  const now = useNow()
  const closed = isPollClosed(poll, now)
  const hasVoted = poll.answers.some((a) => a.me_voted)
  const [selected, setSelected] = useState<number[]>([])
  const [peek, setPeek] = useState(false)
  const [busy, setBusy] = useState(false)
  const showResults = closed || hasVoted || peek
  const winners = closed ? pollWinners(poll) : []

  const toggle = (answerId: number): void => {
    if (showResults) return
    setSelected((current) => {
      if (!poll.allow_multiselect) return current[0] === answerId ? [] : [answerId]
      return current.includes(answerId)
        ? current.filter((id) => id !== answerId)
        : [...current, answerId]
    })
  }

  const run = async (action: () => Promise<void>, fallback: string): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await action()
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : fallback)
    } finally {
      setBusy(false)
    }
  }

  const handleVote = (): Promise<void> =>
    run(async () => {
      await onVote(selected)
      setSelected([])
      setPeek(false)
    }, 'Falha ao votar.')

  const votesLabel = `${poll.total_voters} ${poll.total_voters === 1 ? 'voto' : 'votos'}`

  return (
    <div className="mt-1 w-full max-w-md rounded-xl border border-subtle bg-input p-4">
      <p className="break-words text-[15px] font-semibold text-strong">{poll.question}</p>
      <p className="mb-3 mt-0.5 text-xs text-gray-400">
        {closed
          ? 'Enquete encerrada'
          : poll.allow_multiselect
            ? 'Selecione uma ou mais respostas'
            : 'Selecione uma resposta'}
      </p>

      <div className="flex flex-col gap-2" role={showResults ? 'list' : 'group'}>
        {poll.answers.map((answer) => {
          const percent = pollPercent(answer.count, poll.total_voters)
          const isSelected = selected.includes(answer.answer_id)
          const isWinner = winners.includes(answer.answer_id)
          return (
            <button
              key={answer.answer_id}
              type="button"
              onClick={() => toggle(answer.answer_id)}
              disabled={showResults || busy}
              role={showResults ? 'listitem' : poll.allow_multiselect ? 'checkbox' : 'radio'}
              aria-checked={showResults ? undefined : isSelected}
              className={`relative flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors ${
                isSelected
                  ? 'border-brand bg-brand/15'
                  : answer.me_voted && showResults
                    ? 'border-brand/60 bg-fg/[0.04]'
                    : 'border-subtle bg-fg/[0.04]'
              } ${showResults ? 'cursor-default' : 'cursor-pointer hover:border-strong hover:bg-fg/[0.07]'}`}
            >
              {showResults && (
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 transition-[width] duration-500 ${
                    isWinner ? 'bg-success/25' : 'bg-brand/20'
                  }`}
                  style={{ width: `${percent}%` }}
                />
              )}
              <PollAnswerMedia answer={answer} />
              <span className="relative min-w-0 flex-1 break-words text-sm font-medium text-gray-100">
                {answer.text}
              </span>
              {showResults ? (
                <span className="relative flex shrink-0 items-center gap-2 text-xs font-semibold text-gray-300">
                  {answer.me_voted && (
                    <span className="text-brand" title="Seu voto">
                      ✓
                    </span>
                  )}
                  <span title={`${answer.count} ${answer.count === 1 ? 'voto' : 'votos'}`}>
                    {percent}%
                  </span>
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className={`relative flex h-5 w-5 shrink-0 items-center justify-center border-2 text-[11px] text-white ${
                    poll.allow_multiselect ? 'rounded-md' : 'rounded-full'
                  } ${isSelected ? 'border-brand bg-brand' : 'border-gray-500'}`}
                >
                  {isSelected && '✓'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <PollIcon className="h-3.5 w-3.5" />
          {votesLabel} · {pollTimeLeft(poll, now)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {!closed && !hasVoted && (
            <button
              type="button"
              onClick={() => setPeek((v) => !v)}
              className="cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:text-strong"
            >
              {peek ? 'Voltar a votar' : 'Mostrar resultados'}
            </button>
          )}
          {!closed && hasVoted && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => onVote([]), 'Falha ao remover o voto.')}
              className="cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:text-strong disabled:opacity-50"
            >
              Remover voto
            </button>
          )}
          {!closed && isAuthor && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(onEnd, 'Falha ao encerrar a enquete.')}
              className="cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-gray-300 transition-colors hover:text-red-400 disabled:opacity-50"
            >
              Encerrar enquete
            </button>
          )}
          {!showResults && (
            <button
              type="button"
              disabled={busy || selected.length === 0}
              onClick={() => void handleVote()}
              className="cursor-pointer rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Votar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default PollCard
