import type { ReactNode } from 'react'
import { XIcon } from '../../../shared/ui/icons'
import MusicVideo from '../../music/components/MusicVideo'
import type { MusicItem } from '../../music/api/music'
import { useMusicStore } from '../../music/store/musicStore'

/** Vídeo da música em destaque (como uma tela em foco) + faixa com as pessoas. */
function MusicStage({
  serverId,
  item,
  startedAt,
  strip
}: {
  serverId: string
  item: MusicItem
  startedAt: number
  strip: ReactNode
}): React.JSX.Element {
  const setStageVideo = useMusicStore((s) => s.setStageVideo)

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div
        data-music-video-stage
        className="relative flex min-h-0 flex-1 items-center justify-center bg-black"
      >
        <MusicVideo serverId={serverId} item={item} startedAt={startedAt} variant="stage" />
        <button
          type="button"
          onClick={() => setStageVideo(false)}
          aria-label="Fechar"
          className="absolute right-2 top-2 cursor-pointer rounded-full bg-black/60 p-1 text-white on-media"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
      {strip}
    </div>
  )
}

export default MusicStage
