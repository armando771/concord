import { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../../../shared/ui/Button'
import { useFriendStore } from '../../friends/store/friendStore'
import { useChatStore } from '../../chat/store/chatStore'
import { useCallStore } from '../store/callStore'
import { useCallInviteStore, type SendPhase } from '../store/callInviteStore'
import { INVITE_COPY } from '../lib/callInviteCopy'
import { invitableFriends } from '../lib/inviteFriendsList'
import FriendPickList from './FriendPickList'

function sendLabel(phase: SendPhase): string {
  if (phase === 'loading') return INVITE_COPY.sending
  return phase === 'error' ? INVITE_COPY.retry : INVITE_COPY.send
}

/** Busca + multisseleção de amigos e o envio de todos os convites numa ação. */
function InviteFriendsForm({ callId }: { callId: string }): React.JSX.Element {
  const friends = useFriendStore((s) => s.friends)
  const loaded = useFriendStore((s) => s.loaded)
  const presence = useChatStore((s) => s.presence)
  const participants = useCallStore((s) => s.participants)
  const phase = useCallInviteStore((s) => s.phase)
  const error = useCallInviteStore((s) => s.error)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const inCallIds = useMemo(() => participants.map((p) => p.id), [participants])
  const visible = useMemo(
    () => invitableFriends(friends, inCallIds, query, (id) => Boolean(presence[id])),
    [friends, inCallIds, query, presence]
  )
  const available = useMemo(
    () => invitableFriends(friends, inCallIds, '', () => true).length,
    [friends, inCallIds]
  )
  const sending = phase === 'loading'
  const searchRef = useRef<HTMLInputElement>(null)
  // Foco na busca ao abrir (a janela monta o formulário só quando abre).
  useEffect(() => searchRef.current?.focus(), [])

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={searchRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={INVITE_COPY.searchLabel}
        placeholder={INVITE_COPY.searchPlaceholder}
        autoComplete="off"
        spellCheck={false}
        className="min-h-10 w-full rounded-lg border border-subtle bg-fg/5 px-3 text-sm text-strong placeholder:text-gray-500 focus-visible:outline-2 focus-visible:outline-violet-400"
      />
      <FriendPickList
        loaded={loaded}
        visible={visible}
        total={friends.length}
        available={available}
        selected={selected}
        disabled={sending}
        onChange={setSelected}
      />
      {phase === 'error' && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error ?? INVITE_COPY.requestFailed}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-gray-400" aria-live="polite">
          {INVITE_COPY.selectedCount(selected.length)}
        </span>
        <Button
          className="min-h-10"
          disabled={selected.length === 0 || sending}
          onClick={() => void useCallInviteStore.getState().send(callId, selected)}
        >
          {sendLabel(phase)}
        </Button>
      </div>
    </div>
  )
}

export default InviteFriendsForm
