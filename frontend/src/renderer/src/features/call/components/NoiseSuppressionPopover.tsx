import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNoiseSuppressionStore } from '../store/noiseSuppressionStore'
import { useRnnoiseStatusStore } from '../store/rnnoiseStatusStore'
import MicTest from './MicTest'
import Switch from '../../../shared/ui/Switch'

const RNNOISE_URL = 'https://jmvalin.ca/demo/rnnoise/'
const POPOVER_WIDTH = 320
const GAP = 8
const MARGIN = 8

/** Conteúdo do popover (também usado em Configurações → Voz). */
export function NoiseSuppressionSettings(): React.JSX.Element {
  const enabled = useNoiseSuppressionStore((s) => s.enabled)
  const available = useRnnoiseStatusStore((s) => s.available)
  const setEnabled = useNoiseSuppressionStore((s) => s.setEnabled)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-bold text-strong">Supressão de ruído</p>
        <Switch checked={enabled} onChange={setEnabled} label="Supressão de ruído" />
      </div>
      <p className="text-sm leading-snug text-gray-300">
        Ative a supressão de ruído RNNoise! Ruídos de fundo como ventilador, teclado e
        ar-condicionado são removidos enquanto você fala. Seus amigos só ouvirão a sua voz.
      </p>
      {/* Desligada não há supressão nenhuma: o aviso do fallback só vale ligada. */}
      {enabled && !available && (
        <p className="text-xs text-warning">
          O RNNoise não carregou neste computador — usando a supressão padrão.
        </p>
      )}
      <div className="space-y-2">
        <p className="text-sm font-bold text-strong">Teste do microfone</p>
        <MicTest />
      </div>
      <div className="flex items-end justify-between gap-3 pt-1">
        <div>
          <p className="text-xs font-bold text-gray-400">Fornecido por</p>
          <p className="text-lg font-black tracking-tight text-strong">
            RNNoise <span className="text-xs font-medium text-gray-400">Xiph.Org</span>
          </p>
        </div>
        <a
          href={RNNOISE_URL}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-link hover:underline"
        >
          Saiba mais
        </a>
      </div>
    </div>
  )
}

/** Popover acima do botão de supressão de ruído do painel "Voz conectada". */
function NoiseSuppressionPopover({
  anchor,
  onClose
}: {
  anchor: HTMLElement
  onClose: () => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  // Fica acima do botão, sem sair da janela (a sidebar é estreita).
  const rect = anchor.getBoundingClientRect()
  const left = Math.min(
    Math.max(MARGIN, rect.left + rect.width / 2 - POPOVER_WIDTH / 2),
    window.innerWidth - POPOVER_WIDTH - MARGIN
  )
  const bottom = window.innerHeight - rect.top + GAP

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

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="Supressão de ruído"
      style={{ width: POPOVER_WIDTH, left, bottom }}
      className="fixed z-50 rounded-xl border border-subtle bg-floating p-4 shadow-2xl"
    >
      <NoiseSuppressionSettings />
    </div>,
    document.body
  )
}

export default NoiseSuppressionPopover
