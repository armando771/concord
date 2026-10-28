import { useRef } from 'react'
import { useSoundboardStore } from '../store/soundboardStore'
import { VolumeIcon, VolumeOffIcon } from '../../../shared/ui/icons'

/** Volume da mesa de áudio (só para quem ouve), com botão de silenciar. */
export default function SoundboardVolumeBar(): React.JSX.Element {
  const volume = useSoundboardStore((s) => s.volume)
  const setVolume = useSoundboardStore((s) => s.setVolume)
  const lastNonZeroVolume = useRef(volume > 0 ? volume : 0.8)

  const toggleVolumeMute = (): void => {
    if (volume > 0) {
      lastNonZeroVolume.current = volume
      setVolume(0)
    } else {
      setVolume(lastNonZeroVolume.current || 0.8)
    }
  }

  return (
    <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-fg/[0.04] px-3 py-2">
      <button
        type="button"
        onClick={toggleVolumeMute}
        aria-label={volume === 0 ? 'Ativar som da mesa' : 'Silenciar mesa de áudio'}
        title={volume === 0 ? 'Ativar som da mesa' : 'Silenciar mesa de áudio'}
        className="cursor-pointer text-gray-300 transition-colors hover:text-strong"
      >
        {volume === 0 ? (
          <VolumeOffIcon className="h-4 w-4 text-danger" />
        ) : (
          <VolumeIcon className="h-4 w-4" />
        )}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(e) => {
          const next = Number(e.target.value) / 100
          if (next > 0) lastNonZeroVolume.current = next
          setVolume(next)
        }}
        aria-label="Volume da mesa de áudio"
        className="h-1.5 flex-1 cursor-pointer accent-brand"
      />
      <span className="w-9 text-right text-[11px] font-semibold text-gray-300">
        {Math.round(volume * 100)}%
      </span>
    </div>
  )
}
