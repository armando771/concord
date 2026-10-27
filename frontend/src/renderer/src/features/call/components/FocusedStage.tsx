import type { ReactNode } from 'react'
import type { ScreenEntry } from '../lib/screenWatch'
import type { CallUserInfo } from '../store/callStore'
import { useCallStore } from '../store/callStore'
import { useScreenTileProps } from '../hooks/useScreenTileProps'
import { watchedExtras } from '../lib/stagePeople'
import { ChevronDownIcon, XIcon } from '../../../shared/ui/icons'
import ParticipantTile from './ParticipantTile'

const overlayButton =
  'flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-gray-200 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white on-media'

/**
 * Foco grande (estilo Go Live): a transmissão em destaque em cima e, embaixo,
 * a faixa com os demais (`strip`, já montada por quem chama).
 */
function FocusedStage({
  entry,
  user,
  strip
}: {
  entry: ScreenEntry
  user: CallUserInfo
  strip: ReactNode
}): React.JSX.Element {
  const tile = useScreenTileProps(user)
  const setFocused = useCallStore((s) => s.setFocusedScreenUser)
  const stopWatchingScreen = useCallStore((s) => s.stopWatchingScreen)
  const extras = watchedExtras(entry, stopWatchingScreen)

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="relative flex min-h-0 flex-1 items-center justify-center [container-type:size]">
        <div className="absolute inset-x-0 top-0 z-10 flex items-start gap-2 px-1">
          <button
            onClick={() => setFocused(null)}
            aria-label="Sair do modo foco"
            title="Sair do modo foco"
            className={overlayButton}
          >
            <ChevronDownIcon className="h-4 w-4" />
          </button>
          {extras.onClose && (
            <button
              onClick={extras.onClose}
              aria-label="Fechar transmissão"
              title="Fechar transmissão"
              className={overlayButton}
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
        <ParticipantTile
          user={user}
          videoStream={entry.stream}
          isScreen
          size="fill"
          hasHeaderOffset={true}
          {...tile}
          streamAudioUserId={extras.streamAudioUserId}
          fullscreenable={extras.fullscreenable}
        />
      </div>
      {strip}
    </div>
  )
}

export default FocusedStage
