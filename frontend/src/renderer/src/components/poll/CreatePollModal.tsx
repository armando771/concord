import { useState } from 'react'
import Modal from '../Modal'
import Button from '../Button'
import { PlusIcon } from '../icons'
import { PollAnswerMedia } from './PollCard'
import { showToast } from '../../store/toastStore'
import type { CreatePollInput } from '../../api/messages'
import {
  POLL_ANSWER_MAX,
  POLL_DURATIONS,
  POLL_EMOJIS,
  POLL_MAX_ANSWERS,
  POLL_MIN_ANSWERS,
  POLL_QUESTION_MAX,
  pollDraftError,
  pollDraftToInput,
  type PollDraft,
  type PollDraftAnswer
} from '../../lib/polls'

interface CreatePollModalProps {
  open: boolean
  onClose: () => void
  onCreate: (input: CreatePollInput) => Promise<void>
}

const emptyAnswer = (): PollDraftAnswer => ({ text: '', emoji: '', image_url: '' })

const emptyDraft = (): PollDraft => ({
  question: '',
  answers: [emptyAnswer(), emptyAnswer()],
  duration_hours: 24,
  allow_multiselect: false
})

/** Seletor do emoji ou da mini imagem de uma resposta. */
function MediaPicker({
  answer,
  onChange,
  onClose
}: {
  answer: PollDraftAnswer
  onChange: (media: Pick<PollDraftAnswer, 'emoji' | 'image_url'>) => void
  onClose: () => void
}): React.JSX.Element {
  const [url, setUrl] = useState(answer.image_url)

  return (
    <div
      className="absolute left-0 top-full z-10 mt-1 w-72 rounded-lg border border-subtle bg-floating p-3 shadow-2xl"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-8 gap-1">
        {POLL_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onChange({ emoji, image_url: '' })
              onClose()
            }}
            className={`cursor-pointer rounded-md p-1 text-lg leading-none transition-colors hover:bg-fg/10 ${
              answer.emoji === emoji ? 'bg-brand/30' : ''
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          onChange({ emoji: '', image_url: url.trim() })
          onClose()
        }}
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="ou link de uma imagem (https://…)"
          maxLength={512}
          className="glass-input min-w-0 flex-1 !py-1.5 text-xs"
        />
        <button
          type="submit"
          disabled={!url.trim()}
          className="cursor-pointer rounded-md bg-fg/10 px-2 text-xs font-semibold text-strong hover:bg-fg/15 disabled:opacity-40"
        >
          Usar
        </button>
      </form>
      {(answer.emoji || answer.image_url) && (
        <button
          type="button"
          onClick={() => {
            onChange({ emoji: '', image_url: '' })
            onClose()
          }}
          className="mt-2 cursor-pointer text-xs font-semibold text-gray-400 hover:text-red-400"
        >
          Remover emoji/imagem
        </button>
      )}
    </div>
  )
}

function CreatePollModal({ open, onClose, onCreate }: CreatePollModalProps): React.JSX.Element {
  const [draft, setDraft] = useState<PollDraft>(emptyDraft)
  const [picker, setPicker] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const error = pollDraftError(draft)

  const close = (): void => {
    setDraft(emptyDraft())
    setPicker(null)
    onClose()
  }

  const updateAnswer = (index: number, patch: Partial<PollDraftAnswer>): void => {
    setDraft((d) => ({
      ...d,
      answers: d.answers.map((a, i) => (i === index ? { ...a, ...patch } : a))
    }))
  }

  const removeAnswer = (index: number): void => {
    setPicker(null)
    setDraft((d) => ({ ...d, answers: d.answers.filter((_, i) => i !== index) }))
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (error || saving) return
    setSaving(true)
    try {
      await onCreate(pollDraftToInput(draft))
      close()
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Falha ao criar a enquete.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title="Criar enquete" onClose={close}>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        onMouseDown={() => setPicker(null)}
      >
        <label className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between text-sm font-medium text-gray-300">
            Pergunta
            <span className="text-[10px] text-gray-500">
              {draft.question.length}/{POLL_QUESTION_MAX}
            </span>
          </span>
          <input
            autoFocus
            value={draft.question}
            onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
            maxLength={POLL_QUESTION_MAX}
            placeholder="O que você quer perguntar?"
            className="glass-input"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-gray-300">Respostas</span>
          {draft.answers.map((answer, i) => (
            <div key={i} className="relative flex items-center gap-2">
              <button
                type="button"
                title="Escolher emoji ou imagem"
                aria-label={`Emoji ou imagem da resposta ${i + 1}`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setPicker((p) => (p === i ? null : i))}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-subtle bg-fg/5 text-lg text-gray-400 transition-colors hover:bg-fg/10"
              >
                {answer.emoji || answer.image_url ? (
                  <PollAnswerMedia answer={answer} />
                ) : (
                  <span aria-hidden="true" className="grayscale">
                    🙂
                  </span>
                )}
              </button>
              {picker === i && (
                <MediaPicker
                  answer={answer}
                  onChange={(media) => updateAnswer(i, media)}
                  onClose={() => setPicker(null)}
                />
              )}
              <input
                value={answer.text}
                onChange={(e) => updateAnswer(i, { text: e.target.value })}
                maxLength={POLL_ANSWER_MAX}
                placeholder={`Resposta ${i + 1}`}
                className="glass-input min-w-0 flex-1"
              />
              {draft.answers.length > POLL_MIN_ANSWERS && (
                <button
                  type="button"
                  onClick={() => removeAnswer(i)}
                  aria-label={`Remover resposta ${i + 1}`}
                  className="shrink-0 cursor-pointer px-1 text-strong/50 transition-colors hover:text-red-400"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {draft.answers.length < POLL_MAX_ANSWERS && (
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, answers: [...d.answers, emptyAnswer()] }))}
              className="flex cursor-pointer items-center gap-1.5 self-start rounded-md px-1 py-1 text-xs font-semibold text-brand transition-colors hover:text-strong"
            >
              <PlusIcon className="h-4 w-4" />
              Adicionar outra resposta
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            Duração
            <select
              value={draft.duration_hours}
              onChange={(e) => setDraft((d) => ({ ...d, duration_hours: Number(e.target.value) }))}
              className="glass-input !w-auto !py-1.5"
            >
              {POLL_DURATIONS.map((d) => (
                <option key={d.hours} value={d.hours} className="bg-floating">
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={draft.allow_multiselect}
              onChange={(e) => setDraft((d) => ({ ...d, allow_multiselect: e.target.checked }))}
              className="h-4 w-4 accent-brand"
            />
            Permitir múltiplas respostas
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={Boolean(error) || saving} title={error ?? undefined}>
            {saving ? 'Publicando...' : 'Publicar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default CreatePollModal
