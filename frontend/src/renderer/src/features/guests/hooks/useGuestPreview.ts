import { useEffect, useState } from 'react'
import { getGuestPreview, type GuestPreview } from '../api/guestInvites'
import { guestErrorMessage } from '../lib/guestErrors'
import { GUEST_COPY } from '../lib/guestCopy'

export type GuestPreviewState =
  | { status: 'loading' }
  | { status: 'ready'; preview: GuestPreview }
  | { status: 'error'; message: string }

type Loaded = { token: string; state: GuestPreviewState }

/** A prévia do link de visitante (pública). */
export function useGuestPreview(token: string): GuestPreviewState {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  useEffect(() => {
    let cancelled = false
    const keep = (state: GuestPreviewState): void => {
      if (!cancelled) setLoaded({ token, state })
    }
    getGuestPreview(token)
      .then((preview) => keep({ status: 'ready', preview }))
      .catch((err: unknown) =>
        keep({ status: 'error', message: guestErrorMessage(err, GUEST_COPY.unavailable) })
      )
    return () => {
      cancelled = true
    }
  }, [token])
  // Trocou de link: carregando até a prévia nova chegar.
  return loaded?.token === token ? loaded.state : { status: 'loading' }
}
