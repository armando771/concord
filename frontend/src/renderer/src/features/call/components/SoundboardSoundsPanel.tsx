import { useEffect, useMemo, useState } from 'react'
import type { SoundboardItem } from '../api/soundboard'
import { useAuthStore } from '../../auth/store/authStore'
import { useServerStore } from '../../servers/store/serverStore'
import { useServerAccess } from '../../servers/hooks/useServerAccess'
import { Perm } from '../../servers/lib/permissions'
import { useSoundboardStore } from '../store/soundboardStore'
import { useSoundFavoritesStore } from '../store/soundFavoritesStore'
import { soundboardSections } from '../lib/soundboardSections'
import { showToast } from '../../../shared/store/toastStore'
import { PlusIcon, SearchIcon } from '../../../shared/ui/icons'
import SoundboardUploadModal from './SoundboardUploadModal'
import SoundPad from './SoundPad'
import SoundSection from './SoundSection'
import SoundboardVolumeBar from './SoundboardVolumeBar'
import SoundboardEmpty from './SoundboardEmpty'
import { formatKeyboardShortcut } from '../hooks/useSoundboardHotkeys'
import { SoundboardSkeleton } from '../../../shared/ui/skeleton/layouts'

const EMPTY_SOUNDS: SoundboardItem[] = []

function SoundboardSoundsPanel({
  serverId,
  onBusyChange
}: {
  serverId: string
  /** Avisa o contêiner quando há modal ou gravação de atalho aberta (não fechar por fora). */
  onBusyChange: (busy: boolean) => void
}): React.JSX.Element {
  const meId = useAuthStore((s) => s.user?.id ?? '')
  // Só dá para conferir cargos do servidor aberto; em outro, o servidor decide.
  const viewingCallServer = useServerStore((s) => s.currentServer?.id === serverId)
  const access = useServerAccess()

  const sounds = useSoundboardStore((s) => s.soundsByServer[serverId] ?? EMPTY_SOUNDS)
  const loading = useSoundboardStore((s) => Boolean(s.loadingByServer[serverId]))
  // Já buscou este servidor alguma vez: reabrir mostra os sons na hora.
  const soundsLoaded = useSoundboardStore((s) => s.soundsByServer[serverId] !== undefined)
  const favorites = useSoundFavoritesStore((s) => s.favorites)
  const loadFavorites = useSoundFavoritesStore((s) => s.load)
  const toggleFavorite = useSoundFavoritesStore((s) => s.toggle)
  const keybinds = useSoundboardStore((s) => s.keybinds)
  const activePlays = useSoundboardStore((s) => s.activePlays)
  const setKeybind = useSoundboardStore((s) => s.setKeybind)
  const loadServerSounds = useSoundboardStore((s) => s.loadServerSounds)
  const deleteSound = useSoundboardStore((s) => s.deleteSound)
  const triggerSound = useSoundboardStore((s) => s.triggerSound)

  const [query, setQuery] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [recordingSoundId, setRecordingSoundId] = useState<string | null>(null)

  useEffect(() => {
    void loadServerSounds(serverId)
    void loadFavorites()
  }, [serverId, loadServerSounds, loadFavorites])

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
  // Enviar som: ADD_SOUNDS no servidor da chamada.
  const canAddSounds = !viewingCallServer || access.can(Perm.ADD_SOUNDS)

  const playingSoundIds = useMemo(
    () => new Set(Object.values(activePlays).map((p) => p.soundId)),
    [activePlays]
  )

  const sections = useMemo(
    () => soundboardSections(sounds, favorites, query),
    [sounds, favorites, query]
  )
  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites])
  const nothingShown = sections.favorites.length === 0 && sections.server.length === 0

  const handleToggleFavorite = (sound: SoundboardItem): void => {
    toggleFavorite(sound.id).catch((err) => {
      showToast.error(err instanceof Error ? err.message : 'Não foi possível favoritar o som.')
    })
  }

  const renderPad = (snd: SoundboardItem & { server_name?: string }): React.JSX.Element => (
    <SoundPad
      key={snd.id}
      sound={snd}
      origin={snd.server_id !== serverId ? snd.server_name : undefined}
      isFavorite={favoriteIds.has(snd.id)}
      keybind={keybinds[snd.id]}
      recordingKey={recordingSoundId === snd.id}
      // Só se apaga aqui o que é deste servidor.
      canDelete={snd.server_id === serverId && (snd.uploader_id === meId || isModeratorOrOwner)}
      isPlaying={playingSoundIds.has(snd.id)}
      onTrigger={() => triggerSound(snd.id)}
      onToggleFavorite={() => handleToggleFavorite(snd)}
      onStartRecordKey={() => setRecordingSoundId((cur) => (cur === snd.id ? null : snd.id))}
      onDelete={() => void handleDelete(snd)}
    />
  )

  const handleDelete = async (sound: SoundboardItem): Promise<void> => {
    try {
      await deleteSound(serverId, sound.id)
      showToast.info(`Som "${sound.name}" removido.`)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Não foi possível excluir o som.')
    }
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        {canAddSounds && (
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

        <SoundboardVolumeBar />

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
          ) : nothingShown ? (
            <SoundboardEmpty
              searching={sounds.length > 0 || favorites.length > 0}
              canAdd={canAddSounds}
            />
          ) : (
            <>
              <SoundSection title="★ Favoritos">{sections.favorites.map(renderPad)}</SoundSection>
              <SoundSection title={sections.favorites.length > 0 ? 'Sons do servidor' : undefined}>
                {sections.server.map(renderPad)}
              </SoundSection>
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
