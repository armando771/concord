import { useEffect, useMemo, useRef, useState } from 'react'
import type { SoundboardItem } from '../api/soundboard'
import { useAuthStore } from '../../auth/store/authStore'
import { useCallStore } from '../store/callStore'
import { useServerStore } from '../../servers/store/serverStore'
import { useServerAccess } from '../../servers/hooks/useServerAccess'
import { Perm } from '../../servers/lib/permissions'
import { useSoundboardStore } from '../store/soundboardStore'
import { showToast } from '../../../shared/store/toastStore'
import {
  PlusIcon,
  SearchIcon,
  FavoriteStarIcon,
  TrashIcon,
  VolumeIcon,
  VolumeOffIcon
} from '../../../shared/ui/icons'
import SoundboardUploadModal from './SoundboardUploadModal'
import { formatKeyboardShortcut } from '../hooks/useSoundboardHotkeys'
import { SoundboardSkeleton } from '../../../shared/ui/skeleton/layouts'

const EMPTY_SOUNDS: SoundboardItem[] = []

function SoundPad({
  sound,
  isFavorite,
  keybind,
  recordingKey,
  canDelete,
  isPlaying,
  onTrigger,
  onToggleFavorite,
  onStartRecordKey,
  onDelete
}: {
  sound: SoundboardItem
  isFavorite: boolean
  keybind?: string
  recordingKey: boolean
  canDelete: boolean
  isPlaying: boolean
  onTrigger: () => void
  onToggleFavorite: () => void
  onStartRecordKey: () => void
  onDelete: () => void
}): React.JSX.Element {
  return (
    <div
      className={`group relative flex flex-col justify-between rounded-xl border p-2.5 transition-all ${
        isPlaying
          ? 'border-success bg-success/15 shadow-[0_0_16px_rgba(35,165,90,0.25)]'
          : 'border-subtle bg-fg/[0.04] hover:border-normal hover:bg-fg/[0.08]'
      }`}
    >
      <button
        type="button"
        onClick={onTrigger}
        className="flex w-full cursor-pointer items-center gap-2.5 text-left"
        title={`Tocar "${sound.name}" para todos na chamada`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-input text-lg">
          {sound.emoji || '🔊'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-strong">{sound.name}</p>
          <p className="truncate text-[10px] text-gray-400">
            {(sound.duration_ms / 1000).toFixed(1)}s
            {sound.uploader_name ? ` • ${sound.uploader_name}` : ''}
          </p>
        </div>
      </button>

      <div className="mt-2 flex items-center justify-between gap-1 border-t border-subtle pt-1.5">
        <button
          type="button"
          onClick={onStartRecordKey}
          title="Definir atalho de teclado (ex.: F1, Alt+1). Clique e pressione a combinação ou Backspace para limpar."
          className={`cursor-pointer truncate rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
            recordingKey
              ? 'animate-pulse bg-brand text-white'
              : keybind
                ? 'bg-fg/15 text-gray-200 hover:bg-fg/25'
                : 'bg-fg/5 text-gray-400 hover:bg-fg/10 hover:text-gray-200'
          }`}
        >
          {recordingKey ? 'Tecla…' : keybind || 'Atalho'}
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={isFavorite ? 'Remover dos favoritos' : 'Favoritar som'}
            title={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
            className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded transition-colors ${
              isFavorite
                ? 'text-warning hover:bg-fg/10'
                : 'text-gray-400 hover:bg-fg/10 hover:text-gray-200'
            }`}
          >
            <FavoriteStarIcon className="h-3.5 w-3.5" filled={isFavorite} />
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Excluir som ${sound.name}`}
              title="Excluir som"
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-gray-400 transition-colors hover:bg-danger/20 hover:text-danger"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function SoundboardSoundsPanel({
  serverId,
  onBusyChange
}: {
  serverId: string
  /** Avisa o contêiner quando há modal ou gravação de atalho aberta (não fechar por fora). */
  onBusyChange: (busy: boolean) => void
}): React.JSX.Element {
  const meId = useAuthStore((s) => s.user?.id ?? '')
  const callChannelId = useCallStore((s) => s.channelId)
  // Só dá para conferir cargos do servidor aberto; em outro, o servidor decide.
  const viewingCallServer = useServerStore((s) => s.currentServer?.id === serverId)
  const access = useServerAccess()

  const sounds = useSoundboardStore((s) => s.soundsByServer[serverId] ?? EMPTY_SOUNDS)
  const loading = useSoundboardStore((s) => Boolean(s.loadingByServer[serverId]))
  // Já buscou este servidor alguma vez: reabrir mostra os sons na hora.
  const soundsLoaded = useSoundboardStore((s) => s.soundsByServer[serverId] !== undefined)
  const volume = useSoundboardStore((s) => s.volume)
  const favorites = useSoundboardStore((s) => s.favorites)
  const keybinds = useSoundboardStore((s) => s.keybinds)
  const activePlays = useSoundboardStore((s) => s.activePlays)
  const setVolume = useSoundboardStore((s) => s.setVolume)
  const toggleFavorite = useSoundboardStore((s) => s.toggleFavorite)
  const setKeybind = useSoundboardStore((s) => s.setKeybind)
  const loadServerSounds = useSoundboardStore((s) => s.loadServerSounds)
  const deleteSound = useSoundboardStore((s) => s.deleteSound)
  const triggerSound = useSoundboardStore((s) => s.triggerSound)

  const [query, setQuery] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [recordingSoundId, setRecordingSoundId] = useState<string | null>(null)
  const lastNonZeroVolume = useRef(volume > 0 ? volume : 0.8)

  useEffect(() => {
    void loadServerSounds(serverId)
  }, [serverId, loadServerSounds])

  useEffect(() => {
    onBusyChange(uploadOpen || recordingSoundId !== null)
    return () => onBusyChange(false)
  }, [uploadOpen, recordingSoundId, onBusyChange])

  useEffect(() => {
    if (!recordingSoundId) return
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRecordingSoundId(null)
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        setKeybind(recordingSoundId, null)
        setRecordingSoundId(null)
        return
      }
      const shortcut = formatKeyboardShortcut(e)
      if (!shortcut) {
        showToast.info('Use F1–F12 ou uma combinação com Alt / Ctrl (ex.: Alt+1).')
        return
      }
      setKeybind(recordingSoundId, shortcut)
      setRecordingSoundId(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recordingSoundId, setKeybind])

  // Apagar áudio de outras pessoas: MANAGE_EXPRESSIONS (dono e administrador incluídos).
  const isModeratorOrOwner = viewingCallServer && access.can(Perm.MANAGE_EXPRESSIONS)
  // Tocar e enviar áudios: USE_SOUNDBOARD no canal de voz da chamada.
  const canUseSoundboard =
    !viewingCallServer || !callChannelId || access.canInChannel(callChannelId, Perm.USE_SOUNDBOARD)

  const playingSoundIds = useMemo(
    () => new Set(Object.values(activePlays).map((p) => p.soundId)),
    [activePlays]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sounds
    return sounds.filter((s) => s.name.toLowerCase().includes(q))
  }, [sounds, query])

  const favoriteSounds = useMemo(
    () => filtered.filter((s) => favorites.includes(s.id)),
    [filtered, favorites]
  )
  const otherSounds = useMemo(
    () => filtered.filter((s) => !favorites.includes(s.id)),
    [filtered, favorites]
  )

  const handleDelete = async (sound: SoundboardItem): Promise<void> => {
    try {
      await deleteSound(serverId, sound.id)
      showToast.info(`Som "${sound.name}" removido.`)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Não foi possível excluir o som.')
    }
  }

  const toggleVolumeMute = (): void => {
    if (volume > 0) {
      lastNonZeroVolume.current = volume
      setVolume(0)
    } else {
      setVolume(lastNonZeroVolume.current || 0.8)
    }
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        {canUseSoundboard && (
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="flex cursor-pointer items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Adicionar som
            </button>
          </div>
        )}

        {/* Controle de volume dedicado da mesa de áudio */}
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

        {/* Busca */}
        <div className="relative mb-3">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar som na mesa…"
            className="w-full rounded-xl border border-subtle bg-input py-1.5 pl-8 pr-3 text-xs text-strong placeholder-gray-500 focus:border-brand focus:outline-none"
          />
        </div>

        {/* Lista de sons */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {loading && !soundsLoaded ? (
            <SoundboardSkeleton />
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-subtle py-8 text-center">
              <p className="text-xs font-medium text-gray-300">
                {sounds.length === 0
                  ? 'Nenhum som neste servidor ainda.'
                  : 'Nenhum som encontrado para essa busca.'}
              </p>
              {sounds.length === 0 && (
                <p className="mt-1 text-[11px] text-gray-500">
                  Clique em &ldquo;Adicionar som&rdquo; para enviar um áudio de até 15s (5 MB).
                </p>
              )}
            </div>
          ) : (
            <>
              {favoriteSounds.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    ★ Favoritos
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {favoriteSounds.map((snd) => (
                      <SoundPad
                        key={snd.id}
                        sound={snd}
                        isFavorite
                        keybind={keybinds[snd.id]}
                        recordingKey={recordingSoundId === snd.id}
                        canDelete={snd.uploader_id === meId || isModeratorOrOwner}
                        isPlaying={playingSoundIds.has(snd.id)}
                        onTrigger={() => triggerSound(snd.id)}
                        onToggleFavorite={() => toggleFavorite(snd.id)}
                        onStartRecordKey={() =>
                          setRecordingSoundId((cur) => (cur === snd.id ? null : snd.id))
                        }
                        onDelete={() => void handleDelete(snd)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {otherSounds.length > 0 && (
                <div>
                  {favoriteSounds.length > 0 && (
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Sons do Servidor
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {otherSounds.map((snd) => (
                      <SoundPad
                        key={snd.id}
                        sound={snd}
                        isFavorite={false}
                        keybind={keybinds[snd.id]}
                        recordingKey={recordingSoundId === snd.id}
                        canDelete={snd.uploader_id === meId || isModeratorOrOwner}
                        isPlaying={playingSoundIds.has(snd.id)}
                        onTrigger={() => triggerSound(snd.id)}
                        onToggleFavorite={() => toggleFavorite(snd.id)}
                        onStartRecordKey={() =>
                          setRecordingSoundId((cur) => (cur === snd.id ? null : snd.id))
                        }
                        onDelete={() => void handleDelete(snd)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <SoundboardUploadModal
        open={uploadOpen}
        serverId={serverId}
        onClose={() => setUploadOpen(false)}
      />
    </>
  )
}

export default SoundboardSoundsPanel
