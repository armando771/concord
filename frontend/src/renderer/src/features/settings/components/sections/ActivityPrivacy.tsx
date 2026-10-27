import { Toggle } from '../AppSettings'
import { usePresenceActivityStore } from '../../../activity/store/presenceActivityStore'

/**
 * Privacidade → Atividade: mostrar ou não o jogo em andamento. Só no app de
 * desktop (o navegador não detecta nada).
 */
export function ActivityPrivacy(): React.JSX.Element | null {
  const showActivity = usePresenceActivityStore((s) => s.enabled)
  const setShowActivity = usePresenceActivityStore((s) => s.setEnabled)
  if (!window.api?.games) return null
  return (
    <section className="border-b border-subtle pb-6">
      <h2 className="mb-3 text-ds-sm font-medium text-gray-400">Atividade</h2>
      <Toggle
        title="Mostrar o jogo que estou jogando"
        description="Amigos e membros de servidores em comum veem o jogo em andamento embaixo do seu nome. Só jogos conhecidos são detectados; nada mais sai do seu computador."
        checked={showActivity}
        onChange={() => setShowActivity(!showActivity)}
      />
    </section>
  )
}
