// Contas do "Editar imagem" (recorte do avatar/banner antes de enviar). A
// imagem cobre o quadro com zoom 1; o arrasto (offset, em pixels do quadro)
// nunca deixa aparecer área vazia.

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export const MIN_ZOOM = 1
export const MAX_ZOOM = 3

/** Saídas: avatar 512×512 e banner 680×240 (a proporção do Discord). */
export const AVATAR_OUTPUT: Size = { width: 512, height: 512 }
export const BANNER_OUTPUT: Size = { width: 680, height: 240 }

/** Menor escala que faz a imagem cobrir o quadro inteiro. */
export function coverScale(image: Size, frame: Size): number {
  return Math.max(frame.width / image.width, frame.height / image.height)
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/** Arrasto permitido para o zoom atual (a imagem sempre cobre o quadro). */
export function clampOffset(image: Size, frame: Size, zoom: number, offset: Point): Point {
  const scale = coverScale(image, frame) * clampZoom(zoom)
  const maxX = Math.max(0, (image.width * scale - frame.width) / 2)
  const maxY = Math.max(0, (image.height * scale - frame.height) / 2)
  const clamp = (v: number, max: number): number => Math.min(max, Math.max(-max, v)) || 0
  return { x: clamp(offset.x, maxX), y: clamp(offset.y, maxY) }
}

/** Pedaço da imagem original (em pixels dela) que aparece no quadro. */
export function sourceRect(
  image: Size,
  frame: Size,
  zoom: number,
  offset: Point
): { sx: number; sy: number; sw: number; sh: number } {
  const scale = coverScale(image, frame) * clampZoom(zoom)
  const { x, y } = clampOffset(image, frame, zoom, offset)
  const sw = frame.width / scale
  const sh = frame.height / scale
  const sx = (image.width * scale - frame.width) / 2 / scale - x / scale
  const sy = (image.height * scale - frame.height) / 2 / scale - y / scale
  return { sx, sy, sw, sh }
}
