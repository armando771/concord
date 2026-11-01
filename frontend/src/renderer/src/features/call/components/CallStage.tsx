import { useEffect } from 'react'
import { useCallStore } from '../store/callStore'
import { useMusicStage } from '../hooks/useMusicStage'
import { useStageData } from '../hooks/useStageData'
import { stageMode, type StageMode } from '../lib/stagePeople'
import FocusedStage from './FocusedStage'
import MosaicStage from './MosaicStage'
import MusicStage from './MusicStage'
import StagePeopleStrip from './StagePeopleStrip'
import VoiceGrid from './VoiceGrid'
import { useGuestRoster } from '../../guests/hooks/useGuestRoster'

/**
 * Palco da chamada estilo Discord: sem vídeo = grid de avatares; com telas
 * ou câmeras, mosaico redimensionável e reorganizável e, ao clicar numa
 * tela, foco grande + demais em mini-grid. Tela dos outros começa pausada
 * (card "Assistir transmissão") e só é baixada depois do clique.
 * Compartilhado entre VoiceChannelView e DmCallView.
 */
function CallStage({
  gap = 'gap-6',
  speaking,
  serverId
}: {
  gap?: string
  /** servidor da call (habilita o vídeo do Maestro no palco) */
  serverId?: string
  /** ids dos usuários falando agora (useSpeaking) */
  speaking?: Set<string>
}): React.JSX.Element | null {
  const stage = useStageData()
  // Quem entrou por link de visitante (selo nos tiles e no painel de volumes).
  useGuestRoster()
  const music = useMusicStage(serverId)
  const focusedId = useCallStore((s) => s.focusedScreenUserId)
  const setStageVisible = useCallStore((s) => s.setStageVisible)

  // Montado = tela da call visível (canal conectado ou DM expandida); fora
  // dela a transmissão assistida vira miniatura (ScreenMiniPlayer).
  useEffect(() => {
    setStageVisible(true)
    return () => setStageVisible(false)
  }, [setStageVisible])

  const { meInfo, people, screens, cameras, nameOf } = stage
  const focused = screens.find((entry) => entry.userId === focusedId && entry.watching) ?? null
  const mode = stageMode({
    musicStage: !!music,
    hasScreens: screens.length > 0,
    hasCameras: cameras.length > 0,
    hasFocus: !!focused
  })
  const strip = (exceptId?: string): React.JSX.Element => (
    <StagePeopleStrip
      screens={screens}
      meInfo={meInfo}
      people={people}
      nameOf={nameOf}
      speaking={speaking}
      exceptId={exceptId}
    />
  )

  const views: Record<StageMode, () => React.JSX.Element | null> = {
    music: () =>
      music && serverId ? (
        <MusicStage
          serverId={serverId}
          item={music.item}
          startedAt={music.started_at}
          strip={strip()}
        />
      ) : null,
    voice: () => <VoiceGrid gap={gap} meInfo={meInfo} people={people} speaking={speaking} />,
    mosaic: () => (
      <MosaicStage
        screens={screens}
        cameras={cameras}
        meId={stage.meId}
        meInfo={meInfo}
        people={people}
        nameOf={nameOf}
        speaking={speaking}
      />
    ),
    focus: () =>
      focused && (
        <FocusedStage entry={focused} user={nameOf(focused.userId)} strip={strip(focused.userId)} />
      )
  }
  return views[mode]()
}

export default CallStage
