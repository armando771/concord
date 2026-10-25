import { API_BASE_URL } from '../lib/config'
import { useAuthStore } from '../store/authStore'
import { ApiError, refreshTokens, request } from './client'
import { roomPath, type Attachment } from './messages'

export interface UploadMeta {
  filename: string
  width?: number
  height?: number
  duration_ms?: number
}

interface UploadOptions {
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

/**
 * Sobe um arquivo para a sala (fica "pendente" até a mensagem ser criada com o
 * id dele). Usa XMLHttpRequest porque o fetch não dá progresso de envio, e sem
 * o limite de 15 s do rawRequest (25 MB numa conexão lenta demora).
 */
export async function uploadAttachment(
  room: string,
  file: Blob,
  meta: UploadMeta,
  opts: UploadOptions = {}
): Promise<Attachment> {
  const token = useAuthStore.getState().accessToken
  try {
    return await sendUpload(room, file, meta, opts, token)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && token && (await refreshTokens())) {
      return sendUpload(room, file, meta, opts, useAuthStore.getState().accessToken)
    }
    throw err
  }
}

function sendUpload(
  room: string,
  file: Blob,
  meta: UploadMeta,
  { onProgress, signal }: UploadOptions,
  token: string | null
): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError(0, 'aborted'))
      return
    }

    const form = new FormData()
    // Campos antes do arquivo; o backend aceita em qualquer ordem.
    if (meta.width !== undefined) form.append('width', String(meta.width))
    if (meta.height !== undefined) form.append('height', String(meta.height))
    if (meta.duration_ms !== undefined) form.append('duration_ms', String(meta.duration_ms))
    form.append('file', file, meta.filename)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}${roomPath(room)}/attachments`)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    const onAbort = (): void => xhr.abort()
    signal?.addEventListener('abort', onAbort)
    const done = (): void => signal?.removeEventListener('abort', onAbort)

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total)
    })
    xhr.onload = () => {
      done()
      let body: unknown = {}
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        // corpo vazio ou não-JSON
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as Attachment)
      } else {
        reject(new ApiError(xhr.status, (body as { error?: string }).error ?? 'Upload failed'))
      }
    }
    xhr.onerror = () => {
      done()
      reject(new ApiError(0, 'Network error'))
    }
    xhr.onabort = () => {
      done()
      reject(new ApiError(0, 'aborted'))
    }
    xhr.send(form)
  })
}

/** Token curto (1 h) que vai na URL de <img>/<video>/<audio>. */
export function fetchMediaToken(): Promise<{ token: string; expires_at: string }> {
  return request<{ token: string; expires_at: string }>('/media/token')
}
