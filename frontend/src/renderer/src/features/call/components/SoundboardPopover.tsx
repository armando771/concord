import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCallStore } from '../store/callStore'
import { useVoiceModStore } from '../store/voiceModStore'
import { isVoiceModActive } from '../lib/voiceModPresets'
import { MicIcon, SoundPadsIcon } from '../../../shared/ui/icons'
import SoundboardSoundsPanel from './SoundboardSoundsPanel'
import VoiceModPanel from './VoiceModPanel'

const POPOVER_WIDTH = 480
const GAP = 10
const MARGIN = 8

type Section = 'sounds' | 'voice'

const SECTIONS: { id: Section; label: string; subtitle: string }[] = [
  { id: 'sounds', label: 'Sons', subtitle: 'Toque sons na chamada para todos' },
  { id: 'voice', label: 'Voz', subtitle: 'Todos na chamada ouvem a sua voz alterada' }
]

function SoundboardPopover({
  anchor,
  onClose
}: {
  anchor: HTMLElement
  onClose: () => void
}): React.JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null)
  const serverId = useCallStore((s) => s.serverId)
  const voiceModActive = useVoiceModStore(isVoiceModActive)
  const [section, setSection] = useState<Section>('sounds')
  // Modal de upload ou gravação de atalho aberto na seção Sons: não fechar por fora.
  const [busy, setBusy] = useState(false)
  const handleBusy = useCallback((next: boolean) => setBusy(next), [])

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (busy) return
      const target = e.target as Node
      if (!ref.current?.contains(target) && !anchor.contains(target)) {
        onClose()
      }
    }
    const onKey = (e: KeyboardEvent): void => {
      if (busy) return
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [anchor, onClose, busy])

  if (!serverId) return null

  const rect = anchor.getBoundingClientRect()
  const left = Math.min(
    Math.max(MARGIN, rect.left + rect.width / 2 - POPOVER_WIDTH / 2),
    window.innerWidth - POPOVER_WIDTH - MARGIN
  )
  const bottom = Math.max(MARGIN, window.innerHeight - rect.top + GAP)
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="Mesa de Áudio"
      style={{ width: POPOVER_WIDTH, left, bottom }}
      className="fixed z-50 flex max-h-[460px] gap-3 rounded-2xl border border-subtle bg-floating p-3 shadow-2xl"
    >
      <div
        role="tablist"
        aria-orientation="vertical"
        className="flex shrink-0 flex-col gap-1.5 border-r border-subtle pr-3"
      >
        {SECTIONS.map(({ id, label }) => {
          const selected = id === section
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={label}
              title={label}
              onClick={() => setSection(id)}
              className={`relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl transition-colors ${
                selected
                  ? 'bg-brand text-white'
                  : 'bg-fg/[0.06] text-gray-300 hover:bg-fg/[0.12] hover:text-strong'
              }`}
            >
              {id === 'sounds' ? (
                <SoundPadsIcon className="h-5 w-5" />
              ) : (
                <MicIcon className="h-5 w-5" />
              )}
              {id === 'voice' && voiceModActive && (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-floating)] bg-success-strong"
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="mb-3">
          <p className="text-sm font-bold text-strong">Mesa de Áudio · {current.label}</p>
          <p className="text-[11px] text-gray-400">{current.subtitle}</p>
        </div>
        {section === 'sounds' ? (
          <SoundboardSoundsPanel serverId={serverId} onBusyChange={handleBusy} />
        ) : (
          <VoiceModPanel />
        )}
      </div>
    </div>,
    document.body
  )
}

export default SoundboardPopover
