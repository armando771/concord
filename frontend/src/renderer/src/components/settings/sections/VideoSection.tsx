import { useState } from 'react'
import { useCallStore } from '../../../store/callStore'
import { useVideoSettingsStore } from '../../../store/videoSettingsStore'
import { deviceOptions } from '../../../lib/audioDevices'
import { resolveBackgroundEffect } from '../../../lib/videoBackground'
import { useAudioDevices } from '../../useAudioDevices'
import Switch from '../../Switch'
import BackgroundPicker from '../../video/BackgroundPicker'
import VideoPreview from '../../video/VideoPreview'
import { useBackgroundUpload } from '../../video/useBackgroundUpload'
import { useVideoPreview } from '../../video/useVideoPreview'

/** Configurações → Vídeo: câmera, prévia ao vivo e fundo (como no Discord). */
export function VideoSection(): React.JSX.Element {
  const cameraId = useVideoSettingsStore((s) => s.cameraId)
  const background = useVideoSettingsStore((s) => s.background)
  const customs = useVideoSettingsStore((s) => s.customs)
  const alwaysPreview = useVideoSettingsStore((s) => s.alwaysPreview)
  const setAlwaysPreview = useVideoSettingsStore((s) => s.setAlwaysPreview)
  const setBackground = useVideoSettingsStore((s) => s.setBackground)
  const addCustom = useVideoSettingsStore((s) => s.addCustom)
  const addCustomGif = useVideoSettingsStore((s) => s.addCustomGif)
  const removeCustom = useVideoSettingsStore((s) => s.removeCustom)
  const setCameraDevice = useCallStore((s) => s.setCameraDevice)

  const [testing, setTesting] = useState(false)
  const effect = resolveBackgroundEffect(background, customs)
  const { stream, error, effectFailed } = useVideoPreview(testing, cameraId, effect)
  // Os nomes das câmeras só aparecem depois da permissão: relista quando a prévia abre.
  const devices = useAudioDevices({ probe: false, refreshKey: stream !== null })
  const cameras = deviceOptions(devices, 'videoinput')
  const checkedId = cameras.some((c) => c.id === cameraId) ? cameraId : ''
  const { upload, error: uploadError } = useBackgroundUpload(
    (dataUrl) => addCustom(dataUrl),
    (blob) => addCustomGif(blob)
  )

  return (
    <div className="space-y-4 rounded-xl border border-subtle bg-fg/5 p-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-ds-sm font-medium text-gray-400">Câmera</span>
        <select
          value={checkedId}
          onChange={(e) => void setCameraDevice(e.target.value)}
          className="glass-input !py-2 text-sm"
        >
          {cameras.map((c) => (
            <option key={c.id} value={c.id} className="bg-floating">
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-2">
        <VideoPreview
          stream={stream}
          loading={testing && !error}
          error={error}
          idle="Clique em “Testar vídeo” para ver como você aparece."
        />
        {effectFailed && (
          <p className="text-xs text-warning">
            Não foi possível aplicar o fundo neste computador. O vídeo segue normal.
          </p>
        )}
        <button
          type="button"
          onClick={() => setTesting((v) => !v)}
          className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-ds-sm font-medium text-white transition-colors hover:bg-brand-hover"
        >
          {testing ? 'Parar teste' : 'Testar vídeo'}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-subtle pt-4">
        <div>
          <p className="text-ds-sm font-medium text-strong">Sempre ver prévia do vídeo</p>
          <p className="text-xs text-gray-400">
            Mostra a prévia antes de ligar a câmera em uma chamada.
          </p>
        </div>
        <Switch
          checked={alwaysPreview}
          onChange={setAlwaysPreview}
          label="Sempre ver prévia do vídeo"
        />
      </div>

      <div className="space-y-2 border-t border-subtle pt-4">
        <p className="text-ds-xs font-bold uppercase tracking-[0.02em] text-gray-400">
          Fundo do vídeo
        </p>
        <BackgroundPicker
          value={background}
          customs={customs}
          error={uploadError}
          onChange={setBackground}
          onUpload={upload}
          onRemoveCustom={removeCustom}
        />
        <p className="text-xs text-gray-400">
          A separação do fundo roda no seu computador: o vídeo original não sai dele.
        </p>
      </div>
    </div>
  )
}
