import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCallStore } from '../../store/callStore'
import { useAuthStore } from '../../store/authStore'
import { useActivity } from '../../store/presenceActivityStore'
import { useServerStore } from '../../store/serverStore'
import { useNoiseSuppressionStore } from '../../store/noiseSuppressionStore'
import { useActivityStore } from '../../store/activityStore'
import {
  ActivityIcon,
  CameraIcon,
  CameraOffIcon,
  MonitorIcon,
  LockIcon,
  LockOpenIcon,
  NoiseSuppressionIcon,
  HangUpIcon,
  SignalIcon,
  SoundboardIcon
} from '../icons'
import { GamepadIcon } from '../icons'
import ActivityPickerPopover from './ActivityPickerPopover'
import NoiseSuppressionPopover from './NoiseSuppressionPopover'
import ConnectionStatsPopover from './ConnectionStatsPopover'
import SoundboardPopover from './SoundboardPopover'
import ScreenQualityPopover from './ScreenQualityPopover'
import { useSoundboardHotkeys } from './useSoundboardHotkeys'
import { useCallChannelName } from './useCallChannelName'
import { showVoicePanel, voicePanelHeading, voicePanelLabel, voicePanelRoute } from './voicePanel'
import VoiceXPBar from '../level/VoiceXPBar'

// @max-[239px]: sidebar no mínimo (o @container é o SidebarFooter).
const ICON_BUTTON =
  'flex h-8 w-8 @max-[239px]:w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors'

/**
 * Cor do botão: 'on' = câmera/tela ligada (verde); 'open' = popover aberto e
 * 'running' = atividade rodando (roxo, como no palco).
 */
type RowTone = 'idle' | 'on' | 'open' | 'running'

const ROW_TONE: Record<RowTone, string> = {
  idle: 'bg-white/6 text-gray-200 hover:bg-white/12 hover:text-white',
  on: 'bg-[#23a55a] text-white hover:bg-[#1e8c4a]',
  open: 'bg-[#5865f2] text-white',
  running: 'bg-[#5865f2]/25 text-white hover:bg-[#5865f2]/40'
}

/**
 * Botão da fileira de baixo (câmera, tela, atividades, mesa de áudio). O
 * rótulo já diz o estado ("Ligar câmera"/"Desligar câmera"), então sem
 * aria-pressed (o leitor de tela anunciaria o estado duas vezes).
 */
function RowButton({
  label,
  title,
  tone = 'idle',
  disabled = false,
  expanded,
  onClick,
  children
}: {
  label: string
  title?: string
  tone?: RowTone
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
      aria-expanded={expanded}
      title={title}
      className={`flex h-8 min-w-0 flex-1 items-center justify-center rounded-md transition-colors ${
        disabled
          ? 'cursor-not-allowed bg-white/5 text-gray-600'
          : `cursor-pointer ${ROW_TONE[tone]}`
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
  const callId = useCallStore((s) => s.callId)
  const type = useCallStore((s) => s.type)
  const channelId = useCallStore((s) => s.channelId)
  const serverId = useCallStore((s) => s.serverId)
  // Só a outra pessoa da DM: sem re-render a cada mudança na lista da call.
  const peerId = useCallStore((s) => s.participants[0]?.id ?? null)
  const peerName = useCallStore((s) => s.participants[0]?.display_name)
  const meId = useAuthStore((s) => s.user?.id)
  const myGame = useActivity(meId)
  const muted = useCallStore((s) => s.muted)
  const deafened = useCallStore((s) => s.deafened)
  const canStream = useCallStore((s) => s.canStream)
  const sharing = useCallStore((s) => s.isScreenSharing)
  const cameraOn = useCallStore((s) => s.localCameraStream !== null)
  const toggleCamera = useCallStore((s) => s.toggleCamera)
  const startScreenShare = useCallStore((s) => s.startScreenShare)
  const stopScreenShare = useCallStore((s) => s.stopScreenShare)
  const locked = useCallStore((s) => s.locked)
  const toggleLock = useCallStore((s) => s.toggleLock)
  const endCall = useCallStore((s) => s.endCall)

  const serverName = useServerStore((s) =>
    serverId ? s.servers.find((srv) => srv.id === serverId)?.name : undefined
  )
  const channelName = useCallChannelName(type === 'channel' ? serverId : null, channelId)
  const noiseSuppression = useNoiseSuppressionStore((s) => s.enabled)

  /** Botão do popover de supressão de ruído (null = fechado). */
  const [noiseAnchor, setNoiseAnchor] = useState<HTMLElement | null>(null)
  const closeNoise = useCallback(() => setNoiseAnchor(null), [])
  const [connectionAnchor, setConnectionAnchor] = useState<{
    element: HTMLElement
    callId: string | null
  } | null>(null)
  const closeConnection = useCallback(() => setConnectionAnchor(null), [])
  /** Botão do popover da mesa de áudio (null = fechado). */
  const [soundboardAnchor, setSoundboardAnchor] = useState<HTMLElement | null>(null)
  const closeSoundboard = useCallback(() => setSoundboardAnchor(null), [])
  /** Botão do seletor de atividades (null = fechado). */
  const [activityAnchor, setActivityAnchor] = useState<HTMLElement | null>(null)
  const closeActivities = useCallback(() => setActivityAnchor(null), [])
  const activityRunning = useActivityStore((s) => s.shared !== null || s.local !== null)

  useSoundboardHotkeys()

  if (!showVoicePanel(status)) return null

  const connected = status === 'active'
  const connectionOpen =
    connected && connectionAnchor?.callId === callId && connectionAnchor !== null
  const label = voicePanelLabel({
    type,
    channelName,
    serverName,
    peerName
  })
  const route = voicePanelRoute({
    type,
    serverId,
    channelId,
    participants: peerId ? [{ id: peerId }] : []
  })
  const goTitle = type === 'dm' ? 'Ir para a conversa' : 'Ir para o canal de voz'
  const cameraBlocked = !canStream && !cameraOn
  const screenBlocked = !canStream && !sharing
  const soundboardAvailable = type === 'channel' && connected

  return (
    <div className="shrink-0 border-t border-white/6 bg-[#07080b]/90 px-2 pb-2 pt-1.5">
      {myGame && (
        <p className="mb-1.5 flex items-center gap-2 border-b border-white/6 pb-1.5 text-ds-md font-semibold text-white">
          <GamepadIcon className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="truncate">{myGame.name}</span>
        </p>
      )}
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            disabled={!connected}
            aria-label="Detalhes da conexão de voz"
            aria-haspopup="dialog"
            aria-expanded={connectionOpen}
            onClick={(event) => {
              const element = event.currentTarget
              setConnectionAnchor(connectionOpen ? null : { element, callId })
            }}
            className={`flex max-w-full items-center gap-1.5 rounded text-left text-ds-md font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2] ${connected ? 'cursor-pointer hover:underline' : ''} ${
              connected ? 'text-[#23a55a]' : 'text-[#f0b232]'
            }`}
          >
            <SignalIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{voicePanelHeading(status)}</span>
          </button>
          {route ? (
            <button
              type="button"
              onClick={() => navigate(route)}
              aria-label={`${goTitle}: ${label}`}
              title={`${goTitle}: ${label}`}
              className="block w-full cursor-pointer truncate text-left text-ds-xs text-gray-400 hover:text-gray-200 hover:underline"
            >
              {label}
            </button>
          ) : (
            <p className="truncate text-ds-xs text-gray-400" title={label}>
              {label}
            </p>
          )}
        </div>
        {type === 'channel' && status === 'active' && (
          <button
            type="button"
            onClick={toggleLock}
            aria-label={locked ? 'Destrancar sala' : 'Trancar sala'}
            title={locked ? 'Destrancar sala' : 'Trancar sala (pedir permissão para entrar)'}
            className={`${ICON_BUTTON} ${
              locked
                ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                : 'text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {locked ? (
              <LockIcon className="h-5 w-5 text-amber-400" />
            ) : (
              <LockOpenIcon className="h-5 w-5" />
            )}
          </button>
        )}
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
          <HangUpIcon className="h-5 w-5" />
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
          tone={cameraOn ? 'on' : 'idle'}
          disabled={!connected || cameraBlocked}
          onClick={() => void toggleCamera()}
        >
          {cameraOn ? <CameraIcon className="h-5 w-5" /> : <CameraOffIcon className="h-5 w-5" />}
        </RowButton>
        <ScreenQualityPopover className="min-w-0 flex-1" align="start" disabled={!connected}>
          <RowButton
            label={sharing ? 'Parar de compartilhar tela' : 'Compartilhar tela'}
            title={
              screenBlocked
                ? 'Você não pode transmitir neste canal'
                : sharing
                  ? undefined
                  : 'Compartilhar tela'
            }
            tone={sharing ? 'on' : 'idle'}
            disabled={!connected || screenBlocked}
            onClick={() => (sharing ? stopScreenShare() : void startScreenShare())}
          >
            <MonitorIcon className="h-5 w-5" />
          </RowButton>
        </ScreenQualityPopover>
        <RowButton
          label="Atividades"
          title="Atividades"
          tone={activityAnchor ? 'open' : activityRunning ? 'running' : 'idle'}
          expanded={connected ? activityAnchor !== null : undefined}
          disabled={!connected}
          onClick={(e) => {
            const button = e.currentTarget
            setActivityAnchor((open) => (open ? null : button))
          }}
        >
          <ActivityIcon className="h-5 w-5" />
        </RowButton>
        <RowButton
          label="Mesa de Áudio"
          title={
            type === 'channel' ? 'Mesa de Áudio' : 'A mesa de áudio é só em canais de servidor'
          }
          tone={soundboardAnchor ? 'open' : 'idle'}
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
      {connectionOpen && connectionAnchor && (
        <ConnectionStatsPopover
          key={callId}
          anchor={connectionAnchor.element}
          onClose={closeConnection}
        />
      )}
      {noiseAnchor && <NoiseSuppressionPopover anchor={noiseAnchor} onClose={closeNoise} />}
      {soundboardAnchor && soundboardAvailable && (
        <SoundboardPopover anchor={soundboardAnchor} onClose={closeSoundboard} />
      )}
      {activityAnchor && connected && (
        <ActivityPickerPopover anchor={activityAnchor} onClose={closeActivities} />
      )}
    </div>
  )
}

export default VoiceConnectedPanel
