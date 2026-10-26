/** Maior lado da imagem de fundo guardada (a câmera é processada em ~960x540). */
export const BG_MAX_W = 1280
export const BG_MAX_H = 720
/** Teto do arquivo escolhido, antes de reduzir. */
export const BG_MAX_FILE_BYTES = 15 * 1024 * 1024

/** Reduz (w, h) para caber em (maxW, maxH) sem ampliar nem distorcer. */
export function fitWithin(
  w: number,
  h: number,
  maxW = BG_MAX_W,
  maxH = BG_MAX_H
): { width: number; height: number } {
  if (!(w > 0) || !(h > 0)) return { width: 0, height: 0 }
  const k = Math.min(1, maxW / w, maxH / h)
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) }
}

/** Lê uma imagem escolhida pelo usuário e devolve um JPEG reduzido como data URL. */
export async function imageFileToBackground(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.')
  if (file.size > BG_MAX_FILE_BYTES) throw new Error('A imagem é grande demais (máx. 15 MB).')
  const bitmap = await createImageBitmap(file)
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível ler a imagem.')
    ctx.drawImage(bitmap, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    bitmap.close()
  }
}
