import { Toggle } from '../../settings/components/Toggle'
import { OVERLAY_OPACITY_MAX, OVERLAY_OPACITY_MIN, OVERLAY_OPACITY_STEP } from '../lib/overlayState'
import { useOverlayPrefsStore } from '../store/overlayPrefsStore'
import OverlayShortcutField from './OverlayShortcutField'

/** Configurações → Aplicativo → Overlay (só onde há overlay, ex.: Windows). */
function OverlaySettings({ show }: { show: boolean }): React.JSX.Element | null {
  const overlayEnabled = useOverlayPrefsStore((s) => s.enabled)
  const setOverlayEnabled = useOverlayPrefsStore((s) => s.setEnabled)
  const overlayOpacity = useOverlayPrefsStore((s) => s.opacity)
  const setOverlayOpacity = useOverlayPrefsStore((s) => s.setOpacity)
  const overlayMoved = useOverlayPrefsStore(
    (s) => s.layout.position !== null || s.layout.scale !== 1
  )
  const resetOverlayLayout = useOverlayPrefsStore((s) => s.resetLayout)
  const overlayShowWatchers = useOverlayPrefsStore((s) => s.showWatchers)
  const setOverlayShowWatchers = useOverlayPrefsStore((s) => s.setShowWatchers)

  if (!show) return null
  return (
    <div className="rounded-xl border border-subtle bg-fg/5 p-4">
      <h3 className="mb-3 text-ds-sm font-medium text-gray-400">Overlay</h3>
      <Toggle
        title="Overlay nos jogos"
        description="Mostra quem está na chamada e quem está falando por cima de jogos em tela cheia (modo janela)."
        checked={overlayEnabled}
        onChange={() => setOverlayEnabled(!overlayEnabled)}
      />
      <OverlayShortcutField disabled={!overlayEnabled} />
      <div className="mt-4">
        <Toggle
          title="Mostrar quem assiste a minha live"
          description="Quando você transmite a tela, o overlay mostra um olho com o número de espectadores e um olho em quem está assistindo."
          checked={overlayShowWatchers}
          onChange={() => setOverlayShowWatchers(!overlayShowWatchers)}
        />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span>
          <span className="block text-ds-md font-medium text-strong">Posição e tamanho</span>
          <span className="block text-ds-sm text-gray-400">
            Volta para a esquerda, no meio da tela, no tamanho normal.
          </span>
        </span>
        <button
          type="button"
          onClick={resetOverlayLayout}
          disabled={!overlayMoved}
          className="shrink-0 cursor-pointer rounded-lg bg-fg/10 px-3 py-2 text-ds-sm font-medium text-strong transition-colors hover:bg-fg/15 disabled:cursor-default disabled:opacity-50"
        >
          Restaurar posição
        </button>
      </div>
      <label className="mt-4 flex flex-col gap-2">
        <span className="flex items-center justify-between text-ds-md font-medium text-strong">
          Opacidade do overlay (quem fala fica mais visível)
          <span className="text-xs font-medium text-gray-400">{overlayOpacity}%</span>
        </span>
        <input
          type="range"
          min={OVERLAY_OPACITY_MIN}
          max={OVERLAY_OPACITY_MAX}
          step={OVERLAY_OPACITY_STEP}
          value={overlayOpacity}
          disabled={!overlayEnabled}
          onChange={(e) => setOverlayOpacity(Number(e.target.value))}
          aria-label="Opacidade do overlay"
          className="accent-brand disabled:opacity-40"
        />
        <span className="text-xs text-gray-400">
          Bem fraquinho em repouso para não atrapalhar o jogo; quem está falando aparece mais forte.
        </span>
      </label>
    </div>
  )
}

export default OverlaySettings
