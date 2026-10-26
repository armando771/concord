import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ACTIVITIES,
  validateActivityLink,
  type ActivityDefinition
} from '../../../../shared/activities'
import { useActivityStore } from '../../store/activityStore'
import { useCallStore } from '../../store/callStore'
import { CrosshairIcon } from '../icons'

const POPOVER_WIDTH = 360
const GAP = 10
const MARGIN = 8

/** Ícone de cada atividade do catálogo. */
export function ActivityGlyph({
  activity,
  className = ''
}: {
  activity: ActivityDefinition
  className?: string
}): React.JSX.Element {
  switch (activity.icon) {
    case 'crosshair':
    default:
      return <CrosshairIcon className={className} />
  }
}

function ActivityCard({
  activity,
  selected,
  onSelect
}: {
  activity: ActivityDefinition
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
        selected
          ? 'border-brand bg-brand/15'
          : 'border-subtle bg-fg/[0.04] hover:border-normal hover:bg-fg/[0.08]'
      }`}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-input"
        style={{ color: activity.accent }}
      >
        <ActivityGlyph activity={activity} className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-strong">{activity.name}</span>
          <span className="rounded bg-fg/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-300">
            {activity.category}
          </span>
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-gray-400">
          {activity.description}
        </span>
      </span>
    </button>
  )
}

/** Escolha da atividade (catálogo) e link opcional da sala, ao lado dos controles. */
function ActivityPickerPopover({
  anchor,
  onClose
}: {
  anchor: HTMLElement
  onClose: () => void
}): React.JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null)
  const callId = useCallStore((s) => s.callId)
  const start = useActivityStore((s) => s.start)
  const [selectedId, setSelectedId] = useState(ACTIVITIES[0]?.id ?? '')
  const [link, setLink] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      const target = e.target as Node
      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [anchor, onClose])

  const selected = ACTIVITIES.find((a) => a.id === selectedId)

  const handleStart = async (): Promise<void> => {
    if (!selected || !callId || busy) return
    const checked = validateActivityLink(selected.id, link)
    if (!checked.ok) {
      setError(checked.error)
      return
    }
    setBusy(true)
    const failure = await start(callId, selected.id, checked.url)
    setBusy(false)
    if (failure) {
      setError(failure)
      return
    }
    onClose()
  }

  const rect = anchor.getBoundingClientRect()
  const left = Math.min(
    Math.max(MARGIN, rect.left + rect.width / 2 - POPOVER_WIDTH / 2),
    window.innerWidth - POPOVER_WIDTH - MARGIN
  )
  const bottom = Math.max(MARGIN, window.innerHeight - rect.top + GAP)

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="Atividades"
      style={{ width: POPOVER_WIDTH, left, bottom }}
      className="fixed z-50 flex max-h-[460px] flex-col rounded-2xl border border-subtle bg-floating p-4 shadow-2xl"
    >
      <div className="mb-3">
        <p className="text-sm font-bold text-strong">Atividades</p>
        <p className="text-[11px] text-gray-400">
          Jogue com quem está na chamada — a voz continua aqui.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {ACTIVITIES.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            selected={activity.id === selectedId}
            onSelect={() => {
              setSelectedId(activity.id)
              setError(null)
            }}
          />
        ))}
      </div>

      {selected && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            void handleStart()
          }}
        >
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-gray-300">
              Cole o link da sala (opcional)
            </span>
            <input
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => {
                setLink(e.target.value)
                setError(null)
              }}
              placeholder={selected.linkExample}
              aria-invalid={error !== null}
              className={`w-full rounded-xl border bg-input px-3 py-1.5 text-xs text-strong placeholder-gray-500 focus:outline-none ${
                error ? 'border-danger' : 'border-subtle focus:border-brand'
              }`}
            />
          </label>
          {error ? (
            <p role="alert" className="text-[11px] text-danger">
              {error}
            </p>
          ) : (
            <p className="text-[11px] text-gray-500">
              Sem link, quem entrar abre a página inicial do jogo.
            </p>
          )}
          <button
            type="submit"
            disabled={!callId || busy}
            className="w-full cursor-pointer rounded-xl bg-brand py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Abrindo…' : `Abrir ${selected.name}`}
          </button>
        </form>
      )}
    </div>,
    document.body
  )
}

export default ActivityPickerPopover
