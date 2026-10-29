import {
  resultLine,
  sendHeadline,
  summarizeResults,
  type ResultTone
} from '../lib/inviteFriendsList'
import type { InviteResult } from '../api/callInvites'

const TONE_CLASS: Record<ResultTone, string> = {
  good: 'text-success',
  neutral: 'text-gray-400',
  bad: 'text-danger'
}

function ResultRow({ result, name }: { result: InviteResult; name: string }): React.JSX.Element {
  const line = resultLine(result.status)
  return (
    <li className="flex min-h-10 items-center justify-between gap-3 rounded-lg px-2 py-1.5">
      <span className="min-w-0 truncate text-sm text-strong">{name}</span>
      <span className={`shrink-0 text-right text-xs ${TONE_CLASS[line.tone]}`}>{line.text}</span>
    </li>
  )
}

/**
 * Depois do envio: quantos convites saíram (cada um virou uma mensagem na
 * conversa privada) e, por pessoa, o que aconteceu.
 */
function InviteResultsList({
  results,
  nameOf
}: {
  results: InviteResult[]
  nameOf: (userId: string) => string
}): React.JSX.Element {
  const { sent } = summarizeResults(results)
  return (
    <div className="flex flex-col gap-3">
      <p role="status" className="text-sm font-medium text-strong">
        {sendHeadline(sent, results.length)}
      </p>
      <ul className="flex flex-col gap-1">
        {results.map((r) => (
          <ResultRow key={r.user_id} result={r} name={nameOf(r.user_id)} />
        ))}
      </ul>
    </div>
  )
}

export default InviteResultsList
