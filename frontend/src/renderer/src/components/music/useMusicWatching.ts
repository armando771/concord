import { useEffect } from 'react'
import { setVideoWatching } from '../../api/music'
import { wantsVideo } from '../../lib/music'
import { useMusicStore } from '../../store/musicStore'

/**
 * Único ponto que avisa o backend que há espectador do vídeo (não é contado
 * por referência). Fica montado com a call, não com o painel: fechar o painel
 * não pode tirar o vídeo do palco.
 */
export function useMusicWatching(serverId: string | null | undefined): void {
  const hasVideo = useMusicStore((s) => !!s.state?.now?.item.has_video)
  const stageVideo = useMusicStore((s) => s.stageVideo)
  const panelVideo = useMusicStore((s) => s.videoEnabled && s.panelOpen)
  const watching = !!serverId && wantsVideo(hasVideo, stageVideo, panelVideo)

  useEffect(() => {
    if (!watching || !serverId) return
    void setVideoWatching(serverId, true).catch(() => {})
    return () => {
      void setVideoWatching(serverId, false).catch(() => {})
    }
  }, [serverId, watching])
}
