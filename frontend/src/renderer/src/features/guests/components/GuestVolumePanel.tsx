import Modal from '../../../shared/ui/Modal'
import VolumeSlider from '../../call/components/VolumeSlider'
import { useCallStore } from '../../call/store/callStore'
import { useUserAudioStore } from '../../call/store/userAudioStore'
import { useIsGuest } from '../store/guestRosterStore'
import { GUEST_COPY } from '../lib/guestCopy'
import GuestBadge from './GuestBadge'

function PersonVolume({ id, name }: { id: string; name: string }): React.JSX.Element {
  const volume = useUserAudioStore((s) => s.settings[id]?.volume ?? 1)
  const guest = useIsGuest(id)
  return (
    <li className="flex flex-col gap-1">
      {guest && <GuestBadge className="self-start" />}
      <VolumeSlider
        label={GUEST_COPY.volumeOf(name)}
        value={volume}
        onChange={(v) => useUserAudioStore.getState().setVolume(id, v)}
      />
    </li>
  )
}

/** Volume de cada pessoa na call (só para o visitante; ninguém mais ouve a mudança). */
function GuestVolumePanel({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const people = useCallStore((s) => s.participants)
  return (
    <Modal open={open} title={GUEST_COPY.volumes} onClose={onClose}>
      {people.length === 0 ? (
        <p className="text-ds-sm text-gray-400">{GUEST_COPY.nobodyElse}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {people.map((p) => (
            <PersonVolume key={p.id} id={p.id} name={p.display_name || p.username} />
          ))}
        </ul>
      )}
    </Modal>
  )
}

export default GuestVolumePanel
