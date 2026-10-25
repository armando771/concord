import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCallStore } from '../../store/callStore'
import { useServerStore } from '../../store/serverStore'
import { useNoiseSuppressionStore } from '../../store/noiseSuppressionStore'
import {
  ActivityIcon,
  CameraIcon,
  CameraOffIcon,
  MonitorIcon,
  NoiseSuppressionIcon,
  PhoneOffIcon,
  SignalIcon,
  SoundboardIcon
} from '../icons'
import NoiseSuppressionPopover from './NoiseSuppressionPopover'
import SoundboardPopover from './SoundboardPopover'
import { useSoundboardHotkeys } from './useSoundboardHotkeys'
import { useCallChannelName } from './useCallChannelName'
import { showVoicePanel, voicePanelHeading, voicePanelLabel, voicePanelRoute } from './voicePanel'
import VoiceXPBar from '../level/VoiceXPBar'

const ICON_BUTTON =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors'

/** Botão da fileira de baixo (câmera, tela, atividades, mesa de áudio). */
function RowButton({
  label,
  title,
  active = false,
  disabled = false,
  expanded,
  onClick,
  children
}: {
  label: string
  title: string
  active?: boolean
  disabled?: boolean
  expanded?: boolean
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={expanded === undefined ? active : undefined}
      aria-expanded={expanded}
      title={title}
      className={`flex h-8 min-w-0 flex-1 items-center justify-center rounded-md transition-colors ${
        disabled
          ? 'cursor-not-allowed bg-white/5 text-gray-600'
          : active
            ? 'cursor-pointer bg-[#23a55a] text-white hover:bg-[#1e8c4a]'
            : 'cursor-pointer bg-white/6 text-gray-200 hover:bg-white/12 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Painel "Voz conectada" (como no Discord), acima da barra do usuário em todas
 * as telas enquanto houver chamada — canal de voz ou DM. Clicar no nome do
 * canal leva até a tela da chamada, de onde você estiver.
 */
function VoiceConnectedPanel(): React.JSX.Element | null {
  const navigate = useNavigate()
  const status = useCallStore((s) => s.status)
  const type = useCallStore((s) => s.type)
  const channelId = useCallStore((s) => s.channelId)
  const serverId = useCallStore((s) => s.serverId)
  const participants = useCallStore((s) => s.participants)
  const muted = useCallStore((s) => s.muted)
  const deafened = useCallStore((s) => s.deafened)
  const canStream = useCallStore((s) => s.canStream)
  const sharing = useCallStore((s) => s.isScreenSharing)
  const cameraOn = useCallStore((s) => s.localCameraStream !== null)
  const toggleCamera = useCallStore((s) => s.toggleCamera)
  const startScreenShare = useCallStore((s) => s.startScreenShare)
  const stopScreenShare = useCallStore((s) => s.stopScreenShare)
  const endCall = useCallStore((s) => s.endCall)

  const serverName = useServerStore((s) =>
    serverId ? s.servers.find((srv) => srv.id === serverId)?.name : undefined
  )
  const channelName = useCallChannelName(type === 'channel' ? serverId : null, channelId)
  const noiseSuppression = useNoiseSuppressionStore((s) => s.enabled)

  /** Botão do popover de supressão de ruído (null = fechado). */
  const [noiseAnchor, setNoiseAnchor] = useState<HTMLElement | null>(null)
  const closeNoise = useCallback(() => setNoiseAnchor(null), [])
  /** Botão do popover da mesa de áudio (null = fechado). */
  const [soundboardAnchor, setSoundboardAnchor] = useState<HTMLElement | null>(null)
  const closeSoundboard = useCallback(() => setSoundboardAnchor(null), [])

  useSoundboardHotkeys()

  if (!showVoicePanel(status)) return null

  const connected = status === 'active'
  const label = voicePanelLabel({
    type,
    channelName,
    serverName,
    peerName: participants[0]?.display_name
  })
  const route = voicePanelRoute({ type, serverId, channelId, participants })
  const goTitle = type === 'dm' ? 'Ir para a conversa' : 'Ir para o canal de voz'
  const cameraBlocked = !canStream && !cameraOn
  const screenBlocked = !canStream && !sharing
  const soundboardAvailable = type === 'channel' && connected

  return (
    <div className="shrink-0 border-t border-white/6 bg-[#07080b]/90 px-2 pb-2 pt-1.5">
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <p
            className={`flex items-center gap-1.5 text-[13px] font-bold leading-5 ${
              connected ? 'text-[#23a55a]' : 'text-[#f0b232]'
            }`}
          >
            <SignalIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{voicePanelHeading(status)}</span>
          </p>
          {route ? (
            <button
              type="button"
              onClick={() => navigate(route)}
              aria-label={`${goTitle}: ${label}`}
              title={`${goTitle}: ${label}`}
              className="block w-full cursor-pointer truncate text-left text-xs leading-4 text-gray-400 hover:text-gray-200 hover:underline"
            >
              {label}
            </button>
          ) : (
            <p className="truncate text-xs leading-4 text-gray-400" title={label}>
              {label}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            const button = e.currentTarget
            setNoiseAnchor((open) => (open ? null : button))
          }}
          aria-label="Supressão de ruído"
          aria-expanded={noiseAnchor !== null}
          title={
            noiseSuppression
              ? 'Supressão de ruído fornecida por RNNoise'
              : 'Supressão de ruído desativada'
          }
          className={`${ICON_BUTTON} ${
            noiseAnchor ? 'bg-white/15 text-white' : 'hover:bg-white/10 hover:text-white'
          } ${noiseSuppression ? 'text-gray-300' : 'text-gray-500'}`}
        >
          <NoiseSuppressionIcon className="h-5 w-5" off={!noiseSuppression} />
        </button>
        <button
          type="button"
          onClick={endCall}
          aria-label="Desconectar da voz"
          title="Desconectar"
          className={`${ICON_BUTTON} text-gray-300 hover:bg-[#f23f43]/15 hover:text-[#f23f43]`}
        >
          <PhoneOffIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        <RowButton
          label={cameraOn ? 'Desligar câmera' : 'Ligar câmera'}
          title={
            cameraBlocked
              ? 'Você não pode transmitir neste canal'
              : cameraOn
                ? 'Desligar câmera'
                : 'Ligar câmera'
          }
          active={cameraOn}
          disabled={!connected || cameraBlocked}
          onClick={() => void toggleCamera()}
        >
          {cameraOn ? <CameraIcon className="h-5 w-5" /> : <CameraOffIcon className="h-5 w-5" />}
        </RowButton>
        <RowButton
          label={sharing ? 'Parar de compartilhar tela' : 'Compartilhar tela'}
          title={
            screenBlocked
              ? 'Você não pode transmitir neste canal'
              : sharing
                ? 'Parar de compartilhar'
                : 'Compartilhar tela'
          }
          active={sharing}
          disabled={!connected || screenBlocked}
          onClick={() => (sharing ? stopScreenShare() : void startScreenShare())}
        >
          <MonitorIcon className="h-5 w-5" />
        </RowButton>
        {/* Atividades chegam em outra branch; até lá o botão só avisa. */}
        <RowButton label="Atividades" title="Em breve" disabled>
          <ActivityIcon className="h-5 w-5" />
        </RowButton>
        <RowButton
          label="Mesa de Áudio"
          title={
            type === 'channel' ? 'Mesa de Áudio' : 'A mesa de áudio é só em canais de servidor'
          }
          active={soundboardAnchor !== null}
          expanded={soundboardAvailable ? soundboardAnchor !== null : undefined}
          disabled={!soundboardAvailable}
          onClick={(e) => {
            const button = e.currentTarget
            setSoundboardAnchor((open) => (open ? null : button))
          }}
        >
          <SoundboardIcon className="h-5 w-5" />
        </RowButton>
      </div>

      <VoiceXPBar paused={muted || deafened} />
      {noiseAnchor && <NoiseSuppressionPopover anchor={noiseAnchor} onClose={closeNoise} />}
      {soundboardAnchor && soundboardAvailable && (
        <SoundboardPopover anchor={soundboardAnchor} onClose={closeSoundboard} />
      )}
    </div>
  )
}

export default VoiceConnectedPanel
