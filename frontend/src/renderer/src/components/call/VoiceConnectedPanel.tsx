import { useCallback, useState } from 'react'
import { useCallStore } from '../../store/callStore'
import { useServerStore } from '../../store/serverStore'
import { useNoiseSuppressionStore } from '../../store/noiseSuppressionStore'
import {
  HeadsetIcon,
  HeadsetOffIcon,
  MicIcon,
  MicOffIcon,
  NoiseSuppressionIcon,
  PhoneOffIcon,
  SoundboardIcon
} from '../icons'
import NoiseSuppressionPopover from './NoiseSuppressionPopover'
import SoundboardPopover from './SoundboardPopover'
import { useSoundboardHotkeys } from './useSoundboardHotkeys'
import VoiceXPBar from '../level/VoiceXPBar'

/**
 * Painel "Voz conectada" (estilo Discord) exibido acima do card do usuário
 * nas sidebars enquanto houver chamada ativa — canal de voz ou DM.
 */
function VoiceConnectedPanel(): React.JSX.Element | null {
  const status = useCallStore((s) => s.status)
  const type = useCallStore((s) => s.type)
  const channelId = useCallStore((s) => s.channelId)
  const peer = useCallStore((s) => s.participants[0] ?? null)
  const muted = useCallStore((s) => s.muted)
  const deafened = useCallStore((s) => s.deafened)
  const toggleMute = useCallStore((s) => s.toggleMute)
  const toggleDeafen = useCallStore((s) => s.toggleDeafen)
  const endCall = useCallStore((s) => s.endCall)

  const channels = useServerStore((s) => s.channels)
  const noiseSuppression = useNoiseSuppressionStore((s) => s.enabled)
  /** Botão do popover de supressão de ruído (null = fechado). */
  const [noiseAnchor, setNoiseAnchor] = useState<HTMLElement | null>(null)
  const noiseOpen = noiseAnchor !== null
  const closeNoise = useCallback(() => setNoiseAnchor(null), [])

  /** Botão do popover da mesa de áudio (null = fechado). */
  const [soundboardAnchor, setSoundboardAnchor] = useState<HTMLElement | null>(null)
  const soundboardOpen = soundboardAnchor !== null
  const closeSoundboard = useCallback(() => setSoundboardAnchor(null), [])

  useSoundboardHotkeys()

  if (status === 'idle') return null

  const title =
    type === 'channel'
      ? `#${channels.find((c) => c.id === channelId)?.name ?? 'canal'}`
      : (peer?.display_name ?? 'Chamada')

  return (
    <div className="shrink-0 border-t border-white/6 bg-[#07080b]/90 px-2 py-2">
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#23a55a]" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xs font-bold text-[#23a55a]">{title}</p>
            <p className="text-[10px] text-gray-400">Voz conectada</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {type === 'channel' && status === 'active' && (
            <button
              onClick={(e) => {
                const button = e.currentTarget
                setSoundboardAnchor((open) => (open ? null : button))
              }}
              aria-label="Mesa de Áudio"
              aria-expanded={soundboardOpen}
              title="Mesa de Áudio"
              className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors ${
                soundboardOpen
                  ? 'bg-[#5865f2] text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <SoundboardIcon className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              const button = e.currentTarget
              setNoiseAnchor((open) => (open ? null : button))
            }}
            aria-label="Supressão de ruído"
            aria-expanded={noiseOpen}
            title={
              noiseSuppression
                ? 'Supressão de ruído fornecida por RNNoise'
                : 'Supressão de ruído desativada'
            }
            className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors ${
              noiseOpen ? 'bg-white/15 text-white' : 'bg-white/5 hover:bg-white/10 hover:text-white'
            } ${noiseSuppression ? 'text-gray-300' : 'text-gray-500'}`}
          >
            <NoiseSuppressionIcon className="h-4 w-4" off={!noiseSuppression} />
          </button>
          <button
            onClick={toggleMute}
            aria-label={muted ? 'Ativar Microfone' : 'Silenciar Microfone'}
            title={muted ? 'Ativar Microfone' : 'Silenciar Microfone'}
            className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors ${
              muted
                ? 'bg-white text-[#07080b]'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {muted ? <MicOffIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
          </button>
          <button
            onClick={toggleDeafen}
            aria-label={deafened ? 'Ativar Audio' : 'Silenciar Audio'}
            title={deafened ? 'Ativar Audio' : 'Silenciar Audio'}
            className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors ${
              deafened
                ? 'bg-white text-[#07080b]'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {deafened ? (
              <HeadsetOffIcon className="h-4 w-4" />
            ) : (
              <HeadsetIcon className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={endCall}
            aria-label="Desconectar da voz"
            title="Desconectar"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#f23f43] text-white transition-colors hover:bg-[#d83a3e]"
          >
            <PhoneOffIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      <VoiceXPBar paused={muted || deafened} />
      {noiseAnchor && <NoiseSuppressionPopover anchor={noiseAnchor} onClose={closeNoise} />}
      {soundboardAnchor && <SoundboardPopover anchor={soundboardAnchor} onClose={closeSoundboard} />}
    </div>
  )
}

export default VoiceConnectedPanel
