import { useRef } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { previewJoinSound } from '../../call/lib/entranceSoundStart'
import { ENTRANCE_SOUND_ACCEPT, entranceSoundStatus } from '../lib/entranceSoundFile'
import { useEntranceSoundStore } from '../store/entranceSoundStore'

const primary =
  'min-h-10 cursor-pointer rounded-md bg-brand px-4 py-2 text-ds-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50'
const secondary =
  'min-h-10 cursor-pointer rounded-md bg-fg/10 px-4 py-2 text-ds-sm font-medium text-strong transition-colors hover:bg-fg/15 disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Configurações → Perfis → Som de entrada (no modal dele): o som que toca
 * para quem já está na call quando você entra. Cada botão já salva.
 */
function EntranceSoundSettings(): React.JSX.Element {
  const url = useAuthStore((s) => s.user?.entrance_sound_url ?? null)
  const busy = useEntranceSoundStore((s) => s.busy)
  const error = useEntranceSoundStore((s) => s.error)
  const pick = useEntranceSoundStore((s) => s.pick)
  const remove = useEntranceSoundStore((s) => s.remove)
  const input = useRef<HTMLInputElement>(null)
  const status = entranceSoundStatus(busy, url)

  return (
    <div>
      <p className="text-ds-sm text-gray-400">
        Toca para quem já está na call quando você entra. Um áudio de até 5 segundos (MP3, WAV, OGG,
        M4A ou WebM, até 2 MB).
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={primary}
          disabled={busy !== null}
          onClick={() => input.current?.click()}
        >
          {url ? 'Trocar som' : 'Escolher som'}
        </button>
        <button type="button" className={secondary} onClick={() => previewJoinSound(url)}>
          Ouvir
        </button>
        {url && (
          <button
            type="button"
            className={secondary}
            disabled={busy !== null}
            onClick={() => void remove()}
          >
            Usar o som padrão
          </button>
        )}
      </div>
      <p className="mt-2 text-ds-xs text-gray-500" aria-live="polite">
        {status}
      </p>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      <input
        ref={input}
        type="file"
        accept={ENTRANCE_SOUND_ACCEPT}
        className="hidden"
        aria-label="Arquivo do som de entrada"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void pick(file)
        }}
      />
    </div>
  )
}

export default EntranceSoundSettings
