import { useEffect } from 'react'
import { useMusicStore } from '../../music/store/musicStore'
import type { MusicItem } from '../../music/api/music'
import { musicStageNow } from '../lib/stagePeople'

type MusicNow = { item: MusicItem; started_at: number } | null

/**
 * A música em cartaz quando o vídeo dela está no palco (null se não está).
 * Música sem vídeo (ou Maestro que saiu) desliga o vídeo no palco.
 */
export function useMusicStage(serverId?: string): MusicNow {
  const stageVideo = useMusicStore((s) => s.stageVideo)
  const setStageVideo = useMusicStore((s) => s.setStageVideo)
  const now = useMusicStore((s) => s.state?.now ?? null)
  const hasVideo = !!now?.item.has_video

  useEffect(() => {
    if (stageVideo && !hasVideo) setStageVideo(false)
  }, [stageVideo, hasVideo, setStageVideo])

  return musicStageNow(stageVideo, serverId, now)
}
