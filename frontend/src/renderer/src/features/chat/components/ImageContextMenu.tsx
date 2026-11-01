import { useEffect, useRef } from 'react'
import { copyImage } from '../lib/imageClipboard'
import { useImageMenuStore } from '../store/imageMenuStore'
import { showToast } from '../../../shared/store/toastStore'

const MENU_WIDTH = 176

const itemClass = 'cursor-pointer rounded px-2 py-1.5 text-left hover:bg-fg/5 disabled:opacity-50'

/** Botão direito numa imagem de chat (ver imageMenuHandler). */
function ImageContextMenu(): React.JSX.Element | null {
  const target = useImageMenuStore((s) => s.target)
  const close = useImageMenuStore((s) => s.close)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!target) return
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [target, close])

  if (!target) return null

  const left = Math.min(target.x, window.innerWidth - MENU_WIDTH - 8)
  const top = Math.min(target.y, window.innerHeight - 56)

  const copy = (): void => {
    close()
    copyImage(target.attachmentId, target.contentType).then(
      () => showToast.success('Imagem copiada.'),
      () => showToast.error('Não deu para copiar a imagem.')
    )
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Opções da imagem"
      style={{ left, top, width: MENU_WIDTH }}
      className="fixed z-[80] flex flex-col gap-1 rounded-lg border border-subtle bg-floating p-2 text-sm text-gray-200 shadow-2xl"
    >
      <button role="menuitem" onClick={copy} className={itemClass}>
        Copiar imagem
      </button>
    </div>
  )
}

export default ImageContextMenu
