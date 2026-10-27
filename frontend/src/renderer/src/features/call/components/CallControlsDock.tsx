import { useUIStore } from '../../../shared/store/uiStore'
import { ChevronDownIcon, ChevronUpIcon } from '../../../shared/ui/icons'
import VoiceControls from './VoiceControls'
import ActivityBar from './ActivityBar'
import InviteFriendsButton from './InviteFriendsButton'

/**
 * Faixa dos controles da chamada embaixo do palco. Ela ocupa o próprio espaço
 * (não fica por cima dos cards) e pode ser ocultada: aí sobra só a pílula
 * "Mostrar controles" e o palco ganha a altura de volta.
 */
function CallControlsDock(): React.JSX.Element {
  const hidden = useUIStore((s) => s.callControlsHidden)
  const toggle = useUIStore((s) => s.toggleCallControls)

  if (hidden) {
    return (
      <>
        <ActivityBar />
        <div className="flex shrink-0 justify-center pb-3">
          <button
            type="button"
            onClick={toggle}
            aria-label="Mostrar controles da chamada"
            title="Mostrar controles"
            className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-subtle bg-secondary px-3 text-[11px] font-semibold text-gray-300 shadow-lg transition-colors hover:bg-fg/10 hover:text-strong"
          >
            <ChevronUpIcon className="h-3.5 w-3.5" />
            Mostrar controles
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <ActivityBar />
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 pb-4">
        <VoiceControls />
        <InviteFriendsButton />
        <button
          type="button"
          onClick={toggle}
          aria-label="Ocultar controles da chamada"
          title="Ocultar controles"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-subtle bg-secondary text-gray-400 shadow-lg transition-colors hover:bg-fg/10 hover:text-strong"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
      </div>
    </>
  )
}

export default CallControlsDock
