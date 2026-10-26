import { useState } from 'react'
import { useFriendStore } from '../store/friendStore'
import { showToast } from '../../../shared/store/toastStore'
import { errorMessage } from '../../../shared/lib/errorMessage'
import type { PendingRequest } from '../api/friends'

/** Aceitar / recusar / cancelar um pedido, ignorando cliques enquanto um está em andamento. */
export function usePendingActions(request: PendingRequest): {
  incoming: boolean
  accept: () => void
  deny: () => void
} {
  const accept = useFriendStore((s) => s.accept)
  const decline = useFriendStore((s) => s.decline)
  const cancel = useFriendStore((s) => s.cancel)
  const [busy, setBusy] = useState(false)
  const incoming = request.direction === 'incoming'

  const run = async (action: (username: string) => Promise<void>): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await action(request.username)
    } catch (err) {
      showToast.error(errorMessage(err, 'Falha na operação.'))
    } finally {
      setBusy(false)
    }
  }

  return {
    incoming,
    accept: () => void run(accept),
    deny: () => void run(incoming ? decline : cancel)
  }
}
