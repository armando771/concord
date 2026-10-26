import React from 'react'
import { useCallStore } from '../store/callStore'
import { CheckIcon, XIcon, LockIcon } from '../../../shared/ui/icons'

export function JoinRequestsStack(): React.JSX.Element | null {
  const requests = useCallStore((s) => s.joinRequests)
  const respond = useCallStore((s) => s.respondJoinRequest)

  if (requests.length === 0) return null

  return (
    <div className="fixed bottom-20 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {requests.map((user) => {
        const name = user.display_name || user.username || 'Alguém'
        return (
          <div
            key={user.id}
            className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-floating p-3 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={name}
                    className="h-10 w-10 rounded-full object-cover border border-subtle"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
                    {name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-black">
                  <LockIcon className="h-2.5 w-2.5" />
                </div>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-strong">{name}</p>
                <p className="text-xs text-amber-400/90 font-medium">Pediu para entrar na sala</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => respond(user.id, true)}
                title="Permitir entrada"
                aria-label="Permitir entrada"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-success-strong text-white transition-all hover:bg-success-strong-hover active:scale-95 shadow-sm"
              >
                <CheckIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => respond(user.id, false)}
                title="Recusar"
                aria-label="Recusar"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-fg/10 text-gray-300 transition-all hover:bg-danger-strong hover:text-white active:scale-95"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default JoinRequestsStack
