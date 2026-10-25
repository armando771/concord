import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCallStore } from '../../store/callStore'
import { trapTab } from '../../lib/focusTrap'
import type { ScreenShareQuality } from '../../lib/screenShareQuality'
import { GearIcon } from '../icons'
import Button from '../Button'
import ScreenQualityControls from './ScreenQualityControls'

export default function ScreenQualityButton(): React.JSX.Element | null {
  const stream = useCallStore((s) => s.localScreenStream)
  const quality = useCallStore((s) => s.screenShareQuality)
  const [openedStream, setOpenedStream] = useState<MediaStream | null>(null)
  const open = openedStream === stream
  if (!stream || !quality) return null
  return (
    <>
      <button
        type="button"
        aria-label="Qualidade da transmissão"
        title="Qualidade da transmissão"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpenedStream(stream)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-200 hover:bg-white/10"
      >
        <GearIcon className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <QualityDialog initial={quality} onClose={() => setOpenedStream(null)} />,
          document.body
        )}
    </>
  )
}

function QualityDialog({
  initial,
  onClose
}: {
  initial: ScreenShareQuality
  onClose: () => void
}): React.JSX.Element {
  const [quality, setQuality] = useState(initial)
  const busy = useCallStore((s) => s.screenQualityUpdating)
  const update = useCallStore((s) => s.updateScreenQuality)
  const dialog = useRef<HTMLDivElement>(null)
  const title = 'active-screen-quality-title'
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    dialog.current?.focus()
    return () => previousFocus?.focus()
  }, [])
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title}
        aria-busy={busy}
        tabIndex={-1}
        ref={dialog}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) {
            event.stopPropagation()
            onClose()
          }
          trapTab(event.nativeEvent, dialog.current)
        }}
        className="glass-card w-full max-w-xl p-6"
      >
        <h2 id={title} className="text-xl font-bold text-white">
          Qualidade da transmissão
        </h2>
        <p className="mt-2 text-sm text-gray-400">Altere sem interromper quem está assistindo.</p>
        <ScreenQualityControls value={quality} onChange={setQuality} disabled={busy} />
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              if (await update(quality)) onClose()
            }}
          >
            {busy ? 'Aplicando…' : 'Aplicar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
