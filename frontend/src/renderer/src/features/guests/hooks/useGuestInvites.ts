import { useCallback, useEffect, useState } from 'react'
import {
  createGuestInvite,
  listGuestInvites,
  removeGuest,
  revokeGuestInvite,
  type CreateGuestInviteInput,
  type GuestInviteSummary
} from '../api/guestInvites'
import { guestErrorMessage } from '../lib/guestErrors'
import { guestLink } from '../lib/guestLink'
import { showToast } from '../../../shared/store/toastStore'
import { IS_WEB } from '../../../shared/lib/config'

export interface GuestInvitesState {
  invites: GuestInviteSummary[]
  /** Link recém-gerado (o token só aparece na resposta de criar). */
  link: string | null
  creating: boolean
  create: (input: Omit<CreateGuestInviteInput, 'channel_id'>) => Promise<void>
  revoke: (id: string) => Promise<void>
  remove: (serverId: string, userId: string) => Promise<void>
  clearLink: () => void
}

/** No app web o link usa a própria origem (servidor de teste, sslip.io...). */
function linkFor(token: string): string {
  return IS_WEB ? guestLink(token, location.origin) : guestLink(token)
}

/** Os links de visitante do canal: gerar, listar, revogar e expulsar. */
export function useGuestInvites(channelId: string, open: boolean): GuestInvitesState {
  const [invites, setInvites] = useState<GuestInviteSummary[]>([])
  const [link, setLink] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const reload = useCallback(async () => {
    try {
      setInvites(await listGuestInvites(channelId))
    } catch {
      setInvites([])
    }
  }, [channelId])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    listGuestInvites(channelId)
      .then((list) => !cancelled && setInvites(list))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, channelId])

  const create = async (input: Omit<CreateGuestInviteInput, 'channel_id'>): Promise<void> => {
    setCreating(true)
    try {
      const created = await createGuestInvite({ ...input, channel_id: channelId })
      setLink(linkFor(created.token))
      await reload()
    } catch (err) {
      showToast.error(guestErrorMessage(err, 'Não foi possível gerar o link.'))
    } finally {
      setCreating(false)
    }
  }

  const act = (run: () => Promise<void>, failure: string) => async (): Promise<void> => {
    try {
      await run()
    } catch (err) {
      showToast.error(guestErrorMessage(err, failure))
    }
    await reload()
  }

  return {
    invites,
    link,
    creating,
    create,
    revoke: (id) => act(() => revokeGuestInvite(id), 'Não foi possível revogar o link.')(),
    remove: (serverId, userId) =>
      act(() => removeGuest(serverId, userId), 'Não foi possível expulsar o visitante.')(),
    clearLink: () => setLink(null)
  }
}
