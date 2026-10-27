import { useMemo } from 'react'
import { useThemeStore } from '../../settings/store/themeStore'
import { readOverlayTheme, rgbToHex, type OverlayTheme } from '../lib/overlayTheme'

let canvas: CanvasRenderingContext2D | null | undefined

/**
 * Qualquer cor do CSS (hex, rgb, oklch…) → "#rrggbb", pintando um pixel: o
 * navegador converte do jeito que pinta a tela. Sem canvas, null.
 */
function cssColorToHex(cssColor: string): string | null {
  if (canvas === undefined) {
    canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  }
  if (!canvas) return null
  canvas.clearRect(0, 0, 1, 1)
  canvas.fillStyle = '#000'
  canvas.fillStyle = cssColor
  canvas.fillRect(0, 0, 1, 1)
  const [r, g, b] = canvas.getImageData(0, 0, 1, 1).data
  return rgbToHex(r, g, b)
}

/** Cores do tema em vigor para o overlay nativo; recalcula só ao trocar de tema. */
export function useOverlayTheme(): Partial<OverlayTheme> | null {
  const theme = useThemeStore((s) => s.theme)
  return useMemo(() => {
    if (typeof document === 'undefined' || !theme) return null
    const style = getComputedStyle(document.documentElement)
    return readOverlayTheme((name) => style.getPropertyValue(name), cssColorToHex)
  }, [theme])
}
