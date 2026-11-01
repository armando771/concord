import type { CloseToTrayState } from '../lib/desktopSettings'
import { Toggle } from './Toggle'

/** "Iniciar com o Windows" (só quando a plataforma suporta). */
export function AutostartCard({
  autostart,
  onToggle
}: {
  autostart: boolean | null | undefined
  onToggle: () => void
}): React.JSX.Element | null {
  if (typeof autostart !== 'boolean') return null
  return (
    <div className="rounded-xl border border-subtle bg-fg/5 p-4">
      <Toggle
        title="Iniciar com o Windows"
        description="Abre escondido na bandeja, pronto para receber chamadas."
        checked={autostart}
        onChange={onToggle}
      />
    </div>
  )
}

/** Linux: a bandeja depende do painel (Waybar, KDE, extensão do GNOME). */
export function CloseToTrayCard({
  state,
  onToggle
}: {
  state: CloseToTrayState | null | undefined
  onToggle: () => void
}): React.JSX.Element | null {
  if (!state) return null
  return (
    <div className="rounded-xl border border-subtle bg-fg/5 p-4">
      <Toggle
        title="Minimizar para a bandeja ao fechar"
        description={
          state.available
            ? 'Fechar a janela deixa a Salinha na bandeja, pronta para receber chamadas.'
            : 'Seu painel não está mostrando ícones de bandeja agora: enquanto isso, fechar a janela encerra a Salinha.'
        }
        checked={state.enabled}
        onChange={onToggle}
      />
    </div>
  )
}

export function NothingToConfigure({ show }: { show: boolean }): React.JSX.Element | null {
  if (!show) return null
  return <p className="text-ds-md text-gray-400">Nada para configurar aqui nesta plataforma.</p>
}
