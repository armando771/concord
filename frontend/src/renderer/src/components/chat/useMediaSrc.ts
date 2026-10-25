import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL } from '../../lib/config'
import { mediaFileUrl } from '../../lib/attachments'
import { ensureMediaToken, invalidateMediaToken } from '../../store/mediaToken'

/**
 * URL autenticada de um anexo, montada só quando active vira true. A URL é
 * fixada na primeira vez: renovar o token não troca a de quem já carregou
 * (senão baixaria de novo). Se o arquivo falhar (ex.: token vencido), tenta
 * uma vez com token novo; na segunda falha, failed = true.
 */
export function useMediaSrc(
  attachmentId: string,
  active: boolean
): { src: string | null; onError: () => void; failed: boolean } {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [retried, setRetried] = useState(false)

  useEffect(() => {
    if (!active || src || failed) return
    let cancelled = false
    ensureMediaToken()
      .then((token) => {
        if (!cancelled) setSrc(mediaFileUrl(API_BASE_URL, attachmentId, token))
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [active, src, failed, attachmentId])

  const onError = useCallback(() => {
    if (retried) {
      setFailed(true)
      return
    }
    setRetried(true)
    invalidateMediaToken()
    setSrc(null)
  }, [retried])

  return { src, onError, failed }
}
