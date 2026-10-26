import { ensureMediaToken, invalidateMediaToken } from '../store/mediaToken'
import { baseMime, mediaFileUrl } from './attachments'
import { API_BASE_URL } from './config'

async function requestFile(attachmentId: string): Promise<Response> {
  const token = await ensureMediaToken()
  // no-store: sem isso, o cache do <img> (resposta sem CORS) faz o fetch falhar.
  const res = await fetch(mediaFileUrl(API_BASE_URL, attachmentId, token), { cache: 'no-store' })
  if (!res.ok) invalidateMediaToken(token)
  return res
}

/** Token vencido ou recusado: pede outro e tenta uma vez mais (como o useMediaSrc). */
async function fetchImage(attachmentId: string): Promise<Blob> {
  let res = await requestFile(attachmentId)
  if (!res.ok) res = await requestFile(attachmentId)
  if (!res.ok) throw new Error(`Falha ao baixar a imagem (${res.status})`)
  return res.blob()
}

async function toPng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas indisponível')
    ctx.drawImage(bitmap, 0, 0)
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!png) throw new Error('Falha ao converter a imagem')
    return png
  } finally {
    bitmap.close()
  }
}

/**
 * Copia a imagem do anexo. O ClipboardItem recebe a promessa do PNG, não o blob
 * pronto: a escrita no clipboard começa já no clique, dentro do gesto do usuário.
 */
export function copyImage(attachmentId: string, contentType: string): Promise<void> {
  const png = fetchImage(attachmentId).then((blob) =>
    baseMime(contentType) === 'image/png' ? blob : toPng(blob)
  )
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}
