import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../../../shared/ui/Button'
import Input from '../../../shared/ui/Input'
import { InviteSpinner } from '../../servers/components/InviteServerInfo'
import { GUEST_COPY, joinButtonLabel } from '../lib/guestCopy'
import { useGuestPreview } from '../hooks/useGuestPreview'
import { useGuestJoin } from '../hooks/useGuestJoin'
import type { GuestPreview } from '../api/guestInvites'
import GuestCard from './GuestCard'

function JoinError({ message }: { message: string | null }): React.JSX.Element | null {
  if (!message) return null
  return (
    <p role="alert" className="text-ds-sm text-red-300">
      {message}
    </p>
  )
}

function JoinForm({ token, preview }: { token: string; preview: GuestPreview }): React.JSX.Element {
  const join = useGuestJoin(token)
  const [name, setName] = useState('')
  return (
    <>
      <h1 className="text-ds-lg font-bold text-strong">
        {GUEST_COPY.landingTitle(preview.inviter_name)}
      </h1>
      <p className="mt-1 break-words text-ds-md font-semibold text-gray-200">
        {GUEST_COPY.landingPlace(preview.channel_name, preview.server_name)}
      </p>
      <p className="mt-3 text-ds-sm text-gray-300">{GUEST_COPY.landingRules}</p>
      <p className="mt-1 text-ds-sm text-gray-300">
        {GUEST_COPY.landingPerms(preview.can_speak, preview.can_stream)}
      </p>
      <form
        className="mt-6 flex flex-col gap-3 text-left"
        onSubmit={(e) => {
          e.preventDefault()
          void join.join(name)
        }}
      >
        {!join.withAccount && (
          <Input
            label={GUEST_COPY.nameLabel}
            placeholder={GUEST_COPY.namePlaceholder}
            value={name}
            maxLength={32}
            autoComplete="nickname"
            autoFocus
            onChange={(e) => setName(e.target.value)}
            error={join.error}
          />
        )}
        {join.withAccount && <JoinError message={join.error} />}
        <Button type="submit" className="min-h-10 w-full" disabled={join.joining}>
          {joinButtonLabel(join.joining, join.withAccount ? join.accountName : null)}
        </Button>
        {!join.withAccount && <p className="text-ds-xs text-gray-400">{GUEST_COPY.nameHint}</p>}
      </form>
    </>
  )
}

/** A página do link: quem convidou, para onde e o botão de entrar. */
function GuestJoinCard({ token }: { token: string }): React.JSX.Element {
  const state = useGuestPreview(token)
  return (
    <GuestCard>
      {state.status === 'loading' && (
        <div role="status" className="flex justify-center py-6">
          <InviteSpinner />
        </div>
      )}
      {state.status === 'error' && (
        <>
          <h1 className="text-ds-lg font-bold text-strong">{GUEST_COPY.unavailableTitle}</h1>
          <p className="mt-2 text-ds-sm text-gray-300">{state.message}</p>
          <Link
            to="/"
            className="mt-6 flex min-h-10 w-full items-center justify-center rounded-lg bg-fg/10 px-4 text-ds-sm font-semibold text-strong transition-colors hover:bg-fg/15"
          >
            {GUEST_COPY.goHome}
          </Link>
        </>
      )}
      {state.status === 'ready' && <JoinForm token={token} preview={state.preview} />}
    </GuestCard>
  )
}

export default GuestJoinCard
