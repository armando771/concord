import { useEffect, useRef, useState } from 'react'
import { useScreenQualityStore } from '../store/screenQualityStore'
import { loadScreenQuality, saveScreenQuality } from '../lib/screenShareQuality'
import ScreenQualityControls from './ScreenQualityControls'
import Button from '../../../shared/ui/Button'
import { trapTab } from '../../../shared/lib/focusTrap'

export default function ScreenQualityModal(): React.JSX.Element | null {
  const request = useScreenQualityStore((s) => s.request)
  return request ? <QualityDialog key="quality" request={request} /> : null
}

function QualityDialog({
  request
}: {
  request: { resolve: (quality: ReturnType<typeof loadScreenQuality> | null) => void }
}): React.JSX.Element {
  const portal = window.api?.screenShare?.flow === 'portal'
  const [quality, setQuality] = useState(loadScreenQuality)
  const mounted = useRef(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    mounted.current = true
    const previousFocus = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') request.resolve(null)
      trapTab(event, dialogRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previousFocus?.focus()
      mounted.current = false
      queueMicrotask(() => {
        if (!mounted.current) request.resolve(null)
      })
    }
  }, [request])
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        ref={dialogRef}
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="screen-quality-title"
        className="rounded-2xl border border-subtle bg-modal shadow-2xl shadow-black/70 w-full max-w-xl p-6"
      >
        <h2 id="screen-quality-title" className="text-xl font-bold text-strong">
          Compartilhe sua tela
        </h2>
        <ScreenQualityControls value={quality} onChange={setQuality} />
        {portal && (
          <p className="mt-3 text-xs text-gray-400">
            A tela é escolhida no seletor do sistema. No Linux, o som não vai junto — só o vídeo.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => request.resolve(null)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              saveScreenQuality(quality)
              request.resolve(quality)
            }}
          >
            Escolher tela
          </Button>
        </div>
      </div>
    </div>
  )
}
