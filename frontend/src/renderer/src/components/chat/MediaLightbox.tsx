import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/** Imagem em tamanho grande; fecha com Esc ou clique fora dela. */
function MediaLightbox({
  src,
  alt,
  onClose
}: {
  src: string
  alt: string
  onClose: () => void
}): React.JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-label={alt}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[90vw] rounded-md object-contain shadow-2xl"
      />
    </div>,
    document.body
  )
}

export default MediaLightbox
