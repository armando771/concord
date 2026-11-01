import { findActivity } from '../../../../../shared/activities'
import { IS_WEB } from '../../../shared/lib/config'
import { useActivityStore } from '../../activity/store/activityStore'
import { ChevronDownIcon, XIcon } from '../../../shared/ui/icons'
import { ActivityGlyph } from './ActivityPickerPopover'

/**
 * Navegador: o jogo abre num painel por cima do app, num iframe com sandbox
 * (no desktop é uma janela própria). Minimizar esconde o painel sem parar o
 * jogo; a voz da chamada continua na página.
 */
function ActivityPanel(): React.JSX.Element | null {
  const local = useActivityStore((s) => s.local)
  const minimized = useActivityStore((s) => s.panelMinimized)
  const setMinimized = useActivityStore((s) => s.setPanelMinimized)
  const closeLocal = useActivityStore((s) => s.closeLocal)

  if (!IS_WEB || !local) return null
  const activity = findActivity(local.activityId)
  if (!activity) return null

  return (
    <div
      role="dialog"
      aria-label={activity.name}
      aria-hidden={minimized}
      className={`fixed inset-3 z-40 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl md:inset-8 ${
        minimized ? 'pointer-events-none invisible' : ''
      }`}
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-subtle bg-secondary px-3">
        <span style={{ color: activity.accent }}>
          <ActivityGlyph activity={activity} className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-strong">
          {activity.name}
        </span>
        <a
          href={local.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-gray-300 transition-colors hover:bg-fg/10 hover:text-strong"
        >
          Abrir em nova aba
        </a>
        <button
          type="button"
          onClick={() => setMinimized(true)}
          aria-label="Minimizar atividade"
          title="Minimizar (o jogo continua)"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-fg/10 hover:text-strong"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={closeLocal}
          aria-label="Sair da atividade"
          title="Sair do jogo"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-danger/20 hover:text-danger"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
      <iframe
        key={local.url}
        src={local.url}
        title={activity.name}
        sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-popups"
        allow="fullscreen; pointer-lock; autoplay; gamepad"
        referrerPolicy="strict-origin-when-cross-origin"
        className="min-h-0 w-full flex-1 border-0 bg-black"
      />
    </div>
  )
}

export default ActivityPanel
