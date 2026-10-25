import { useEffect, useRef, useState } from 'react'
import type { CallUserInfo } from '../../store/callStore'
import VoiceStateIcons from './VoiceStateIcons'
import { VolumeOffIcon, XIcon } from '../icons'
import { useAuthStore } from '../../store/authStore'
import { useLevelStore } from '../../store/levelStore'
import { levelUpEffects } from '../../lib/levels'
import LevelUpBurst from '../level/LevelUpBurst'

export function VideoFill({
  stream,
  fit,
  mirror,
  onAspect
}: {
  stream: MediaStream
  fit: 'cover' | 'contain'
  mirror?: boolean
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
      className={`absolute inset-0 h-full w-full rounded-2xl ${
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
  videoStream = null,
  size = 'lg',
  isScreen = false,
  mirror = false,
  onClick,
  onContextMenu,
  locallyMuted = false,
  action,
  onClose
}: {
  user: CallUserInfo
  speaking?: boolean
  selfMuted?: boolean
  deafened?: boolean
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
}): React.JSX.Element {
  const initial = user.display_name.charAt(0).toUpperCase()
  // 'fill': o maior retângulo com a proporção do vídeo que cabe no container
  // (o pai precisa ter container-type: size).
  const [aspect, setAspect] = useState(16 / 9)
  const dims = size === 'fill' ? 'max-h-full max-w-full' : size === 'lg' ? 'h-48 w-80' : 'h-28 w-44'
  const fillStyle =
    size === 'fill'
      ? { aspectRatio: String(aspect), width: `min(100cqw, calc(100cqh * ${aspect}))` }
      : undefined
  const avatarDims = size === 'lg' ? 'h-24 w-24 text-3xl' : 'h-14 w-14 text-lg'
  // Subida de nível: do 60 em diante o tile brilha na cor da faixa; o burst
  // no avatar é para os outros (quem subiu já tem a celebração na janela).
  const meId = useAuthStore((s) => s.user?.id)
  const celebration = useLevelStore((s) => (isScreen ? undefined : s.celebrations[user.id]))
  const levelFx = celebration ? levelUpEffects(celebration.level, celebration.previous) : null

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      role={onClick ? 'button' : undefined}
      title={onClick && isScreen ? 'Expandir tela' : undefined}
      style={fillStyle}
      className={`relative flex items-center justify-center overflow-hidden rounded-2xl bg-white/[0.04] transition-all ${dims} ${
        isScreen
          ? 'ring-2 ring-[#23a55a] shadow-[0_0_24px_rgba(35,165,90,0.25)]'
          : speaking
            ? 'ring-2 ring-[#23a55a] shadow-[0_0_24px_rgba(35,165,90,0.25)]'
            : 'ring-1 ring-white/6'
      } ${onClick ? 'cursor-pointer hover:brightness-110' : ''}`}
    >
      {videoStream && (
        <VideoFill
          stream={videoStream}
          fit={isScreen ? 'contain' : 'cover'}
          mirror={mirror}
          onAspect={size === 'fill' ? setAspect : undefined}
        />
      )}
      {celebration && levelFx?.tileGlow && (
        <span
          key={celebration.key}
          aria-hidden="true"
          className="level-anim pointer-events-none absolute inset-0 z-[1] rounded-2xl"
          style={{
            boxShadow: `inset 0 0 40px 8px ${levelFx.tier.color}, inset 0 0 0 2px ${levelFx.tier.color}`,
            animation: 'level-tile-glow 1.6s ease-in-out 2 both'
          }}
        />
      )}
      {!videoStream && (
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div
              className={`flex items-center justify-center rounded-full font-bold text-white transition-colors ${avatarDims} ${
                speaking ? 'bg-[#23a55a]' : 'bg-violet-600'
              }`}
            >
              {initial}
            </div>
            {!isScreen && user.id !== meId && (
              <LevelUpBurst userId={user.id} size={size === 'lg' ? 96 : 56} />
            )}
          </div>
          {action}
        </div>
      )}
      {onClose && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          aria-label="Fechar transmissão"
          title="Fechar transmissão"
          className="absolute right-2 top-2 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/60 text-gray-200 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      )}
      {isScreen && (
        <div
          className={`absolute top-2 flex items-center gap-1.5 rounded-md bg-[#f23f43] px-1.5 py-0.5 ${
            onClose ? 'right-11' : 'right-2'
          }`}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          <span className="text-[10px] font-bold uppercase tracking-wide text-white">Ao vivo</span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 backdrop-blur-sm">
        {locallyMuted && (
          <span title="Silenciado por você" className="text-gray-300">
            <VolumeOffIcon className="h-3 w-3" />
          </span>
        )}
        <VoiceStateIcons muted={selfMuted} deafened={deafened} className="h-3 w-3" />
        <span className="truncate text-xs font-semibold text-white">{user.display_name}</span>
      </div>
    </div>
  )
}

export default ParticipantTile
