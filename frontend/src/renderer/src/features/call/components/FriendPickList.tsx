import { INVITE_COPY } from '../lib/callInviteCopy'
import { emptyListText, toggleSelected, type InvitableFriend } from '../lib/inviteFriendsList'
import InviteFriendRow from './InviteFriendRow'

/** Lista rolável de amigos com checkbox (carregando, vazia ou com gente). */
function FriendPickList({
  loaded,
  visible,
  total,
  available,
  selected,
  disabled,
  onChange
}: {
  loaded: boolean
  visible: InvitableFriend[]
  total: number
  available: number
  selected: string[]
  disabled: boolean
  onChange: (next: string[]) => void
}): React.JSX.Element {
  let body: React.JSX.Element
  if (!loaded) {
    body = (
      <p role="status" className="p-3 text-sm text-gray-400">
        {INVITE_COPY.loadingFriends}
      </p>
    )
  } else if (visible.length === 0) {
    body = <p className="p-3 text-sm text-gray-400">{emptyListText(total, available)}</p>
  } else {
    body = (
      <ul className="flex flex-col gap-0.5" aria-label={INVITE_COPY.modalTitle}>
        {visible.map((f) => (
          <InviteFriendRow
            key={f.id}
            friend={f}
            selected={selected.includes(f.id)}
            disabled={disabled}
            onToggle={() => onChange(toggleSelected(selected, f.id))}
          />
        ))}
      </ul>
    )
  }
  return <div className="max-h-[50vh] min-h-24 overflow-y-auto overscroll-contain">{body}</div>
}

export default FriendPickList
