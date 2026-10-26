import { useState } from 'react'
import { useFriendStore } from '../store/friendStore'
import {
  canSubmitFriend,
  feedbackTone,
  submitFriendRequest,
  type AddFriendOutcome
} from '../lib/addFriend'

function FeedbackText({ outcome }: { outcome: AddFriendOutcome }): React.JSX.Element {
  if (!outcome.ok) return <>{outcome.error}</>
  return outcome.accepted ? (
    <>
      Vocês agora são amigos, <strong>{outcome.name}</strong>!
    </>
  ) : (
    <>
      Pedido de amizade enviado para <strong>{outcome.name}</strong>!
    </>
  )
}

/** "Adicionar amigo": manda o pedido pelo nome de usuário exato. */
export default function AddFriend(): React.JSX.Element {
  const sendRequest = useFriendStore((s) => s.sendRequest)
  const [username, setUsername] = useState('')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<AddFriendOutcome | null>(null)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (sending) return
    setSending(true)
    const outcome = await submitFriendRequest(sendRequest, username)
    setFeedback((prev) => outcome ?? prev)
    setUsername((prev) => (outcome?.ok ? '' : prev))
    setSending(false)
  }

  const tone = feedbackTone(feedback)
  return (
    <section className="border-b border-subtle pb-5">
      <h2 className="text-ds-lg font-semibold text-strong">Adicionar amigo</h2>
      <p className="mt-1 text-ds-sm text-gray-400">
        Você pode adicionar amigos com o nome de usuário deles no Salinha.
      </p>
      <form
        onSubmit={submit}
        className={`mt-4 flex flex-wrap items-center gap-3 rounded-lg border bg-floating py-2 pl-3 pr-2 transition-colors focus-within:border-brand sm:flex-nowrap ${tone.border}`}
      >
        <input
          autoFocus
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            setFeedback(null)
          }}
          maxLength={32}
          placeholder="Você pode adicionar amigos com o nome de usuário deles."
          className="min-w-0 flex-1 basis-40 bg-transparent text-ds-md text-strong outline-none placeholder:text-gray-500"
        />
        <button
          type="submit"
          disabled={!canSubmitFriend(username, sending)}
          className="shrink-0 cursor-pointer rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Enviar pedido de amizade
        </button>
      </form>
      {feedback && (
        <p className={`mt-2 text-ds-sm ${tone.text}`}>
          <FeedbackText outcome={feedback} />
        </p>
      )}
    </section>
  )
}
