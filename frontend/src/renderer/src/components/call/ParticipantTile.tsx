import { useEffect, useRef, useState } from 'react'
import type { CallUserInfo } from '../../store/callStore'
import { useSoundboardStore } from '../../store/soundboardStore'
import { useMusicStore } from '../../store/musicStore'
import VoiceStateIcons from './VoiceStateIcons'
import StreamAudioControls from './StreamAudioControls'
import FullscreenOverlay from './FullscreenOverlay'
import { useStreamFullscreen } from './useStreamFullscreen'
import {
  ClickDisambiguator,
  canTileFullscreen,
  isInteractiveTarget
} from '../../lib/fullscreenControls'
import { VolumeOffIcon, XIcon, PencilIcon } from '../icons'
import { useAuthStore } from '../../store/authStore'
import { useCallStore } from '../../store/callStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { useLevelStore } from '../../store/levelStore'
import { levelUpEffects } from '../../lib/levels'
import LevelUpBurst from '../level/LevelUpBurst'
import Avatar from '../Avatar'
import MaestroAvatar from '../music/MaestroAvatar'
import { isMaestroIdentity, T18 } from '../../lib/music'
import ScreenWatchersOverlay from './ScreenWatchersOverlay'
import ScreenAnnotationCanvas from './ScreenAnnotationCanvas'
import ScreenAnnotationToolbar from './ScreenAnnotationToolbar'
import StyledName from '../StyledName'
import CallActivityBadge from './CallActivityBadge'

export function VideoFill({
  stream,
  fit,
  mirror,
  square,
  onAspect
}: {
  stream: MediaStream
  fit: 'cover' | 'contain'
  mirror?: boolean
  /** Sem cantos arredondados (tela cheia). */
  square?: boolean
  /** Proporção (largura/altura) do vídeo assim que ela é conhecida/muda. */
  onAspect?: (aspect: number) => void
}): React.JSX.Element {
  const ref = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    void el.play().catch(() => {})
  }, [stream])

  useEffect(() => {
    const el = ref.current
    if (!el || !onAspect) return
    const report = (): void => {
      if (el.videoWidth > 0 && el.videoHeight > 0) onAspect(el.videoWidth / el.videoHeight)
    }
    el.addEventListener('loadedmetadata', report)
    el.addEventListener('resize', report)
    report()
    return () => {
      el.removeEventListener('loadedmetadata', report)
      el.removeEventListener('resize', report)
    }
  }, [onAspect])

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={`absolute inset-0 h-full w-full ${square ? '' : 'rounded-2xl'} ${
        fit === 'contain' ? 'bg-black object-contain' : 'object-cover'
      } ${mirror ? '-scale-x-100' : ''}`}
    />
  )
}

function ParticipantTile({
  user,
  speaking = false,
  selfMuted = false,
  deafened = false,
  serverMuted = false,
  serverDeafened = false,
  videoStream = null,
  size = 'lg',
  isScreen = false,
  mirror = false,
  onClick: onClickProp,
  onContextMenu,
  locallyMuted = false,
  action,
  onClose,
  streamAudioUserId,
  fullscreenable = true,
  watchers,
  hasHeaderOffset = false
}: {
  user: CallUserInfo
  speaking?: boolean
  selfMuted?: boolean
  deafened?: boolean
  /** Impostos por um moderador (silenciar/ensurdecer no servidor). */
  serverMuted?: boolean
  serverDeafened?: boolean
  /** Stream de vídeo (tela/câmera) exibido dentro do tile. */
  videoStream?: MediaStream | null
  size?: 'md' | 'lg' | 'fill'
  /** Modo compartilhamento de tela: object-contain + destaque verde + AO VIVO. */
  isScreen?: boolean
  /** Espelha o vídeo (câmera local). */
  mirror?: boolean
  onClick?: () => void
  /** Botão direito: menu do usuário (volume, silenciar…). */
  onContextMenu?: (e: React.MouseEvent) => void
  /** Silenciado por você (só você não ouve). */
  locallyMuted?: boolean
  /** Botão abaixo do avatar quando não há vídeo (ex.: "Assistir transmissão"). */
  action?: React.ReactNode
  /** Mostra o X de fechar a transmissão no canto superior direito (o esquerdo é do "Mover" do mosaico). */
  onClose?: () => void
  /** Live de outra pessoa: barra de mutar/volume (só para você) ao passar o mouse. */
  streamAudioUserId?: string
  /** Botão e duplo clique de tela cheia (só com vídeo; câmera e transmissão assistida). */
  fullscreenable?: boolean
  /** Espectadores assistindo à transmissão (ao vivo). */
  watchers?: CallUserInfo[]
  /** Espaço para não cobrir botões do cabeçalho da transmissão focada. */
  hasHeaderOffset?: boolean
}): React.JSX.Element {
  // Clicar no Maestro na call abre/fecha o painel "Tocando agora" (vídeo, fila…).
  const toggleMusicPanel = useMusicStore((s) => s.togglePanel)
  const onClick = onClickProp ?? (isMaestroIdentity(user.id) ? toggleMusicPanel : undefined)
  const activeSound = useSoundboardStore((s) => (isScreen ? undefined : s.activePlays[user.id]))
  const isPlayingSound = Boolean(activeSound)
  // 'fill': o maior retângulo com a proporção do vídeo que cabe no container
  // (o pai precisa ter container-type: size).
  const [aspect, setAspect] = useState(16 / 9)
  const dims = size === 'fill' ? 'max-h-full max-w-full' : size === 'lg' ? 'h-48 w-80' : 'h-28 w-44'
  const fillStyle =
    size === 'fill'
      ? { aspectRatio: String(aspect), width: `min(100cqw, calc(100cqh * ${aspect}))` }
      : undefined
  const avatarSize = size === 'lg' ? 96 : 56
  // Subida de nível: do 60 em diante o tile brilha na cor da faixa; o burst
  // no avatar é para os outros (quem subiu já tem a celebração na janela).
  const meId = useAuthStore((s) => s.user?.id)
  const celebration = useLevelStore((s) => (isScreen ? undefined : s.celebrations[user.id]))
  const levelFx = celebration ? levelUpEffects(celebration.level, celebration.previous) : null

  const callId = useCallStore((s) => s.callId)
  const isDrawing = useAnnotationStore((s) => Boolean(s.drawingActive[user.id]))
  const toggleDrawing = useAnnotationStore((s) => s.toggleDrawing)

  const canFullscreen = canTileFullscreen(fullscreenable, !!videoStream)
  const {
    ref: tileRef,
    active: inFullscreen,
    toggle: toggleFullscreen
  } = useStreamFullscreen(canFullscreen)
  // Clique abre o foco, duplo clique é tela cheia: o clique espera a janela do
  // duplo para não trocar de tela (e sair do fullscreen) no meio do gesto.
  const [clicks] = useState(() => new ClickDisambiguator())
  useEffect(() => () => clicks.cancel(), [clicks])
  const handleClick = (): void => {
    if (!onClick || inFullscreen) return
    if (canFullscreen) clicks.click(onClick)
    else onClick()
  }
  const handleDoubleClick = (e: React.MouseEvent): void => {
    if (!canFullscreen || isInteractiveTarget(e.target as Element)) return
    clicks.cancel()
    toggleFullscreen()
  }

  return (
    <div
      ref={tileRef}
      onClick={handleClick}
      onDoubleClick={canFullscreen ? handleDoubleClick : undefined}
      onContextMenu={onContextMenu}
      data-maestro-tile={isMaestroIdentity(user.id) ? '' : undefined}
      role={onClick ? 'button' : undefined}
      title={onClick && isScreen ? 'Expandir tela' : undefined}
      style={inFullscreen ? undefined : fillStyle}
      className={`group/tile relative flex items-center justify-center overflow-hidden transition-all ${
        inFullscreen ? 'bg-black' : `rounded-2xl bg-white/[0.04] ${dims}`
      } ${
        inFullscreen
          ? ''
          : isScreen
            ? 'ring-2 ring-[#23a55a] shadow-[0_0_24px_rgba(35,165,90,0.25)]'
            : speaking || isPlayingSound
              ? 'ring-2 ring-[#23a55a] shadow-[0_0_24px_rgba(35,165,90,0.25)]'
              : 'ring-1 ring-white/6'
      } ${onClick && !inFullscreen ? 'cursor-pointer hover:brightness-110' : ''}`}
    >
      {videoStream && (
        <VideoFill
          stream={videoStream}
          fit={isScreen || inFullscreen ? 'contain' : 'cover'}
          mirror={mirror}
          square={inFullscreen}
          onAspect={size === 'fill' ? setAspect : undefined}
        />
      )}
      {celebration && levelFx?.tileGlow && (
        <span
          key={celebration.key}
          aria-hidden="true"
          className="level-anim pointer-events-none absolute inset-0 z-[1] rounded-2xl"
          style={{
            boxShadow: `inset 0 0 ${Math.round(24 + 32 * levelFx.glow)}px ${Math.round(4 + 8 * levelFx.glow)}px ${levelFx.tier.color}, inset 0 0 0 2px ${levelFx.tier.color}`,
            animation: 'level-tile-glow 1.6s ease-in-out 2 both'
          }}
        />
      )}
      {!videoStream && (
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            {isMaestroIdentity(user.id) ? (
              <MaestroAvatar size={avatarSize} />
            ) : (
              <Avatar
                userId={user.id}
                name={user.display_name}
                avatarUrl={user.avatar_url}
                size={avatarSize}
                animate="always"
                className={`rounded-full transition-shadow ${
                  speaking || isPlayingSound ? 'ring-4 ring-[#23a55a]' : ''
                }`}
              />
            )}
            {!isScreen && user.id !== meId && (
              <LevelUpBurst userId={user.id} size={size === 'lg' ? 96 : 56} />
            )}
          </div>
          {action}
        </div>
      )}
      {activeSound && (
        <div
          data-testid={`soundboard-badge-${user.id}`}
          className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-full border border-[#23a55a]/50 bg-black/75 px-2.5 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur-sm"
        >
          <span>{activeSound.emoji || '🔊'}</span>
          <span className="truncate">{activeSound.soundName}</span>
          <span className="h-1.5 w-1.5 shrink-0 animate-ping rounded-full bg-[#23a55a]" />
        </div>
      )}
      {isScreen && !inFullscreen && watchers && watchers.length > 0 && (
        <ScreenWatchersOverlay
          watchers={watchers}
          className={`absolute top-2 ${hasHeaderOffset ? 'left-22' : 'left-2'}`}
        />
      )}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
        {isScreen && !inFullscreen && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              toggleDrawing(user.id)
            }}
            aria-label="Anotações na transmissão"
            title={isDrawing ? 'Fechar anotações' : 'Anotar / Desenhar na transmissão (Epic Pen)'}
            className={`flex h-6 items-center gap-1 rounded-md px-1.5 text-xs font-semibold backdrop-blur-sm transition-colors cursor-pointer ${
              isDrawing
                ? 'bg-[#23a55a] text-white shadow-md ring-1 ring-white/30'
                : 'bg-black/60 text-gray-200 hover:bg-black/80 hover:text-white'
            }`}
          >
            <PencilIcon className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium hidden sm:inline">Desenhar</span>
          </button>
        )}
        {isScreen && !inFullscreen && (
          <div className="flex items-center gap-1.5 rounded-md bg-[#f23f43] px-1.5 py-0.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-white">
              Ao vivo
            </span>
          </div>
        )}
        {onClose && !inFullscreen && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            aria-label="Fechar transmissão"
            title="Fechar transmissão"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/60 text-gray-200 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {isScreen && (
        <ScreenAnnotationCanvas
          sharerId={user.id}
          callId={callId ?? ''}
          isDrawingMode={isDrawing}
        />
      )}
      {isScreen && isDrawing && (
        <ScreenAnnotationToolbar
          sharerId={user.id}
          callId={callId ?? ''}
          onClose={() => toggleDrawing(user.id)}
          className="absolute bottom-12 left-1/2 -translate-x-1/2"
        />
      )}
      {videoStream && (streamAudioUserId || canFullscreen) && !inFullscreen && (
        <StreamAudioControls
          userId={streamAudioUserId}
          onToggleFullscreen={canFullscreen ? toggleFullscreen : undefined}
        />
      )}
      {inFullscreen && (
        <FullscreenOverlay
          name={user.display_name}
          userId={streamAudioUserId}
          onExit={toggleFullscreen}
          watchers={watchers}
        />
      )}
      <div
        className={`absolute bottom-2 left-2 max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 backdrop-blur-sm ${
          inFullscreen ? 'hidden' : 'flex'
        }`}
      >
        {locallyMuted && (
          <span title="Silenciado por você" className="text-gray-300">
            <VolumeOffIcon className="h-3 w-3" />
          </span>
        )}
        <VoiceStateIcons
          muted={selfMuted}
          deafened={deafened}
          serverMuted={serverMuted}
          serverDeafened={serverDeafened}
          className="h-3 w-3"
        />
        <span className="truncate text-xs font-semibold text-white">
          <StyledName name={user.display_name} userId={user.id} style={user.name_style} />
        </span>
        {!isScreen && <CallActivityBadge userId={user.id} className="h-3.5 w-3.5" />}
        {isMaestroIdentity(user.id) && (
          <span className="rounded bg-violet-400/30 px-1 text-[9px] font-bold uppercase text-violet-100">
            {T18.tag}
          </span>
        )}
      </div>
    </div>
  )
}

export default ParticipantTile
