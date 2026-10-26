import type { Modifier } from '@dnd-kit/core'

/** Deslocamento que põe o centro de um retângulo sobre o ponto (x, y). */
export function centerOnPoint(
  point: { x: number; y: number },
  rect: { left: number; top: number; width: number; height: number }
): { x: number; y: number } {
  return {
    x: point.x - rect.left - rect.width / 2,
    y: point.y - rect.top - rect.height / 2
  }
}

/**
 * Modificador do DragOverlay: o card arrastado fica centralizado no cursor em
 * vez de manter o ponto em que foi pego.
 */
export const snapCenterToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!draggingNodeRect || !(activatorEvent instanceof MouseEvent)) return transform
  const shift = centerOnPoint(
    { x: activatorEvent.clientX, y: activatorEvent.clientY },
    draggingNodeRect
  )
  return { ...transform, x: transform.x + shift.x, y: transform.y + shift.y }
}
