import { useEffect, useState } from 'react'
import type { CallUserInfo } from '../store/callStore'
import { AutoHide } from '../lib/fullscreenControls'
import { FullscreenExitIcon } from '../../../shared/ui/icons'
import { StreamVolume } from './StreamAudioControls'
import { FullscreenAnnotationButtons } from './AnnotationVisibilityButton'
import ScreenWatchersOverlay from './ScreenWatchersOverlay'

/**
 * Camada por cima do vídeo em tela cheia: barra mínima (nome, volume, sair)
 * que some após ~2,5 s sem mexer o mouse e volta ao mexer.
 */
function FullscreenOverlay({
  name,
  userId,
  onExit,
  watchers
}: {
  name: string
  /** Dono da transmissão de tela; sem ele (câmera) não há volume nem anotações. */
  userId?: string
  onExit: () => void
  watchers?: CallUserInfo[]
}): React.JSX.Element {
  const [visible, setVisible] = useState(true)
  const [autoHide] = useState(() => new AutoHide(setVisible))

  useEffect(() => {
    autoHide.start()
    return () => autoHide.stop()
  }, [autoHide])

  return (
    <div
      onMouseMove={() => autoHide.show()}
      className={`absolute inset-0 z-30 ${visible ? '' : 'cursor-none'}`}
    >
      {watchers && watchers.length > 0 && (
        <div
          className={`absolute left-5 top-5 z-40 transition-opacity duration-200 ${
            visible ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <ScreenWatchersOverlay watchers={watchers} />
        </div>
      )}

      <div
        onMouseEnter={() => autoHide.hold()}
        onMouseLeave={() => autoHide.release()}
        onFocus={() => autoHide.show()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`on-media absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-5 pb-4 pt-10 transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-strong">{name}</span>
        {userId && <FullscreenAnnotationButtons sharerId={userId} />}
        {userId && (
          <div className="flex items-center gap-2 rounded-lg bg-black/60 px-2 py-1 on-media">
            <StreamVolume userId={userId} />
          </div>
        )}
        <button
          type="button"
          onClick={onExit}
          aria-label="Sair da tela cheia"
          title="Sair da tela cheia"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-black/60 text-gray-100 transition-colors hover:bg-white/15 on-media"
        >
          <FullscreenExitIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default FullscreenOverlay
