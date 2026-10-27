import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCallStore } from '../store/callStore'
import { useAuthStore } from '../../auth/store/authStore'
import { useActivity } from '../../activity/store/presenceActivityStore'
import { useServerStore } from '../../servers/store/serverStore'
import { useNoiseSuppressionStore } from '../store/noiseSuppressionStore'
import { useActivityStore } from '../../activity/store/activityStore'
import { useVoiceModStore } from '../store/voiceModStore'
import { isVoiceModActive } from '../lib/voiceModPresets'
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
} from '../../../shared/ui/icons'
import GameIcon from '../../activity/components/GameIcon'
import GameBroadcastButton from '../../activity/components/GameBroadcastButton'
import { canBroadcastGame } from '../../activity/lib/gameBroadcast'
import ActivityPickerPopover from './ActivityPickerPopover'
import NoiseSuppressionPopover from './NoiseSuppressionPopover'
import ConnectionStatsPopover from './ConnectionStatsPopover'
import SoundboardPopover from './SoundboardPopover'
import ScreenQualityPopover from './ScreenQualityPopover'
import { useSoundboardHotkeys } from '../hooks/useSoundboardHotkeys'
import { useCallChannelName } from '../hooks/useCallChannelName'
import { showVoicePanel, voicePanelHeading, voicePanelLabel, voicePanelRoute } from '../lib/voicePanel'
import VoiceXPBar from '../../levels/components/VoiceXPBar'
import { QualityBarsIcon } from './ConnectionQualityBars'
import { useCallConnectionView } from '../hooks/useCallConnectionView'
import { qualityTooltip } from '../lib/connectionQuality'

// @max-[239px]: sidebar no mínimo (o @container é o SidebarFooter).
const ICON_BUTTON =
  'flex h-8 w-8 @max-[239px]:w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors'

/**
 * Cor do botão: 'on' = câmera/tela ligada (verde); 'open' = popover aberto e
 * 'running' = atividade rodando (roxo, como no palco).
 */
type RowTone = 'idle' | 'on' | 'open' | 'running'

const ROW_TONE: Record<RowTone, string> = {
  idle: 'bg-fg/6 text-gray-200 hover:bg-fg/12 hover:text-strong',
  on: 'bg-success-strong text-white hover:bg-success-strong-hover',
  open: 'bg-brand text-white',
  running: 'bg-brand/25 text-strong hover:bg-brand/40'
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
        disabled ? 'cursor-not-allowed bg-fg/5 text-gray-600' : `cursor-pointer ${ROW_TONE[tone]}`
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
  const retryConnection = useCallStore((s) => s.retryConnection)
  const myQuality = useCallStore((s) => (meId ? s.connectionQuality[meId] : undefined))
  const myDetails = useCallStore((s) => (meId ? s.qualityDetails[meId] : undefined))
  const connectionView = useCallConnectionView()

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
  const voiceModActive = useVoiceModStore(isVoiceModActive)

  useSoundboardHotkeys()

  if (!showVoicePanel(status)) return null

  const connected = status === 'active'
  const outgoing = status === 'outgoing'
  const heading = voicePanelHeading(status, connectionView.heading)
  const headingTone = outgoing
    ? 'text-warning'
    : connectionView.tone === 'ok'
      ? 'text-success'
      : connectionView.tone === 'error'
        ? 'text-danger'
        : 'text-warning'
  const showBars = !outgoing && connectionView.tone === 'ok' && myQuality && myQuality !== 'unknown'
  const qualityTitle = showBars ? qualityTooltip(myQuality, null, myDetails) : undefined
  const showConnectionNotice =
    !outgoing && (connectionView.detail !== null || connectionView.offerRetry)
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
    <div className="shrink-0 border-t border-subtle bg-primary px-2 pb-2 pt-1.5">
      {myGame && (
        <p className="mb-1.5 flex items-center gap-2 border-b border-subtle pb-1.5 text-ds-md font-semibold text-strong">
          <GameIcon
            name={myGame.name}
            appId={myGame.app_id}
            iconHash={myGame.icon_hash}
            className="h-4 w-4 shrink-0"
          />
          <span className="truncate">{myGame.name}</span>
          {canBroadcastGame(window) && (
            <div className="ml-auto">
              <GameBroadcastButton game={myGame.name} />
            </div>
          )}
        </p>
      )}
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            disabled={!connected}
            aria-label={`Detalhes da conexão de voz: ${heading}${qualityTitle ? `. ${qualityTitle}` : ''}`}
            aria-haspopup="dialog"
            aria-expanded={connectionOpen}
            title={qualityTitle}
            onClick={(event) => {
              const element = event.currentTarget
              setConnectionAnchor(connectionOpen ? null : { element, callId })
            }}
            className={`flex max-w-full items-center gap-1.5 rounded text-left text-ds-md font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand ${connected ? 'cursor-pointer hover:underline' : ''} ${headingTone}`}
          >
            {showBars ? (
              <QualityBarsIcon quality={myQuality} className="h-4 w-4 shrink-0" />
            ) : (
              <SignalIcon
                className={`h-4 w-4 shrink-0 ${connectionView.tone === 'pending' || outgoing ? 'animate-pulse' : ''}`}
              />
            )}
            <span className="truncate" aria-live="polite" data-testid="voice-panel-heading">
              {heading}
            </span>
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
                : 'text-gray-300 hover:bg-fg/10 hover:text-strong'
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
            noiseAnchor ? 'bg-fg/15 text-strong' : 'hover:bg-fg/10 hover:text-strong'
          } ${noiseSuppression ? 'text-gray-300' : 'text-gray-500'}`}
        >
          <NoiseSuppressionIcon className="h-5 w-5" off={!noiseSuppression} />
        </button>
        <button
          type="button"
          onClick={endCall}
          aria-label="Desconectar da voz"
          title="Desconectar"
          className={`${ICON_BUTTON} text-gray-300 hover:bg-danger/15 hover:text-danger`}
        >
          <HangUpIcon className="h-5 w-5" />
        </button>
      </div>

      {showConnectionNotice && (
        <div
          role={connectionView.tone === 'error' ? 'alert' : 'status'}
          className={`mt-1.5 rounded-md px-2 py-1.5 text-ds-xs ${
            connectionView.tone === 'error'
              ? 'bg-danger/12 text-normal'
              : 'bg-warning/10 text-normal'
          }`}
        >
          {connectionView.detail && <p>{connectionView.detail}</p>}
          {connectionView.offerRetry && (
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                onClick={retryConnection}
                className="cursor-pointer rounded bg-fg/10 px-2 py-1 font-semibold text-strong outline-none hover:bg-fg/20 focus-visible:ring-2 focus-visible:ring-brand"
              >
                Tentar de novo
              </button>
              <button
                type="button"
                onClick={endCall}
                className="cursor-pointer rounded px-2 py-1 font-semibold text-secondary outline-none hover:bg-hover hover:text-strong focus-visible:ring-2 focus-visible:ring-brand"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      )}

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
          <span className="relative">
            <SoundboardIcon className="h-5 w-5" />
            {voiceModActive && (
              <span
                aria-hidden="true"
                className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-success-strong"
              />
            )}
          </span>
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
