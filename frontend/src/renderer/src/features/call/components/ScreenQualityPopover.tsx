import { useEffect, useRef, useState } from 'react'
import { useCallStore } from '../store/callStore'
import { createHoverIntent } from '../../../shared/lib/hoverIntent'
import { DEFAULT_SCREEN_QUALITY } from '../lib/screenShareQuality'
import ScreenQualityControls from './ScreenQualityControls'
import { useScreenAdaptStore } from '../store/screenAdaptStore'
import { adaptStatusText } from '../lib/screenAdaptNotice'

const DELAY_MS = 150

/**
 * Durante a transmissão, o botão de parar abre as opções de qualidade quando o
 * mouse passa por cima ou quando ele recebe foco pelo teclado. Clicar continua
 * parando a transmissão.
 */
export default function ScreenQualityPopover({
  children,
  className = '',
  align = 'center',
  disabled = false
}: {
  children: React.ReactNode
  className?: string
  /** Em que lado do botão o painel se alinha. */
  align?: 'center' | 'start'
  disabled?: boolean
}): React.JSX.Element {
  const sharing = useCallStore((s) => s.isScreenSharing && s.screenShareQuality !== null)
  const [open, setOpen] = useState(false)
  const [wasSharing, setWasSharing] = useState(sharing)
  const [hover] = useState(() =>
    createHoverIntent({ openDelay: DELAY_MS, closeDelay: DELAY_MS, onOpenChange: setOpen })
  )
  const root = useRef<HTMLDivElement>(null)
  // Mouse e foco de teclado mantêm o painel aberto. Foco por clique não: senão
  // o painel ficaria aberto depois que o mouse sai.
  const pointer = useRef(false)
  const keyboardFocus = useRef(false)
  const settle = (): void => {
    if (pointer.current || keyboardFocus.current) hover.enter()
    else hover.leave()
  }

  if (wasSharing !== sharing) {
    setWasSharing(sharing)
    setOpen(false)
  }
  useEffect(() => () => hover.cancel(), [hover, sharing])

  const visible = open && sharing && !disabled

  return (
    <div
      ref={root}
      className={`relative z-30 flex ${className}`}
      onMouseEnter={() => {
        pointer.current = true
        settle()
      }}
      onMouseLeave={() => {
        pointer.current = false
        settle()
      }}
      onFocus={(event) => {
        keyboardFocus.current = (event.target as HTMLElement).matches(':focus-visible')
        if (keyboardFocus.current) hover.show()
        else settle()
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          keyboardFocus.current = false
          settle()
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && visible) {
          event.stopPropagation()
          // Antes de fechar: o painel some com o foco nele, então o foco volta ao botão.
          root.current?.querySelector('button')?.focus()
          hover.close()
        }
      }}
    >
      {children}
      {visible && (
        <div
          className={`absolute bottom-full pb-3 ${
            align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'
          }`}
        >
          <QualityCard />
        </div>
      )}
    </div>
  )
}

function QualityCard(): React.JSX.Element {
  const applied = useCallStore((s) => s.screenShareQuality ?? DEFAULT_SCREEN_QUALITY)
  const pending = useCallStore((s) => s.pendingScreenQuality)
  const update = useCallStore((s) => s.updateScreenQuality)
  return (
    <div
      role="dialog"
      aria-label="Qualidade da transmissão"
      aria-busy={pending !== null}
      className="w-64 rounded-xl border border-subtle bg-floating p-3 shadow-2xl"
    >
      <p className="text-sm font-bold text-strong">Qualidade da transmissão</p>
      <ScreenQualityControls compact value={pending ?? applied} onChange={update} />
      <AdaptStatus />
      <p className="mt-2 text-xs text-gray-500">
        {pending ? 'Aplicando…' : 'Não interrompe quem está assistindo.'}
      </p>
    </div>
  )
}

/** O controlador baixou a qualidade (ou está no limite): diz o que está saindo e por quê. */
function AdaptStatus(): React.JSX.Element | null {
  const text = useScreenAdaptStore((s) => adaptStatusText(s.view))
  if (!text) return null
  return (
    <p role="status" className="mt-2 text-xs font-semibold text-warning">
      {text}
    </p>
  )
}
