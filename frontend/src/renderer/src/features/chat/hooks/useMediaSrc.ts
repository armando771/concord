import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL } from '../../../shared/lib/config'
import { mediaFileUrl } from '../lib/attachments'
import { profileMediaSrc } from '../../profile/lib/profileMedia'
import { ensureMediaToken, invalidateMediaToken } from '../store/mediaToken'

/**
 * URL autenticada de um anexo, montada só quando active vira true. A URL é
 * fixada na primeira vez: renovar o token não troca a de quem já carregou
 * (senão baixaria de novo). Se o arquivo falhar (ex.: token vencido), tenta
 * uma vez com token novo; na segunda falha, failed = true.
 */
export function useMediaSrc(
  attachmentId: string,
  active: boolean,
  /** Anexo de comentário de proposta: arquivo público, sem token. */
  directUrl?: string | null
): { src: string | null; onError: () => void; failed: boolean } {
  const [src, setSrc] = useState<string | null>(null)
  const [usedToken, setUsedToken] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [retried, setRetried] = useState(false)
  const [directFailed, setDirectFailed] = useState(false)

  useEffect(() => {
    if (directUrl || !active || src || failed) return
    let cancelled = false
    ensureMediaToken()
      .then((token) => {
        if (cancelled) return
        setUsedToken(token)
        setSrc(mediaFileUrl(API_BASE_URL, attachmentId, token))
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [directUrl, active, src, failed, attachmentId])

  const onError = useCallback(() => {
    if (retried) {
      setFailed(true)
      return
    }
    setRetried(true)
    invalidateMediaToken(usedToken ?? undefined)
    setSrc(null)
  }, [retried, usedToken])

  if (directUrl) {
    return {
      src: active && !directFailed ? profileMediaSrc(directUrl, API_BASE_URL) : null,
      onError: () => setDirectFailed(true),
      failed: directFailed
    }
  }
  return { src, onError, failed }
}
