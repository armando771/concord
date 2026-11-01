import { useRef } from 'react'
import { dragOffset, imagePlacement, type Drag } from '../../profile/lib/cropView'
import type { Point, Size } from '../../profile/lib/imageCrop'

/** Quadro do recorte: a imagem (GIF anima) que se arrasta por baixo da moldura. */
function CropViewport({
  round,
  frame,
  src,
  natural,
  zoom,
  offset,
  imgRef,
  onNatural,
  onOffset,
  onImageError
}: {
  /** Avatar é redondo; banner, retangular. */
  round: boolean
  frame: Size
  src: string
  natural: Size | null
  zoom: number
  offset: Point
  imgRef: React.RefObject<HTMLImageElement | null>
  onNatural: (size: Size) => void
  onOffset: (offset: Point) => void
  onImageError: () => void
}): React.JSX.Element {
  const drag = useRef<Drag | null>(null)

  const start = (e: React.PointerEvent): void => {
    if (!natural) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { start: { x: e.clientX, y: e.clientY }, from: offset }
  }
  const move = (e: React.PointerEvent): void => {
    if (!drag.current || !natural) return
    onOffset(dragOffset(natural, frame, zoom, drag.current, { x: e.clientX, y: e.clientY }))
  }
  const end = (): void => {
    drag.current = null
  }

  return (
    <div className="mt-4 flex justify-center bg-black/40 py-6">
      <div
        className={`relative max-w-full cursor-grab overflow-hidden active:cursor-grabbing ${
          round ? 'rounded-full' : 'rounded-lg'
        }`}
        style={{ width: frame.width, height: frame.height, touchAction: 'none' }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) =>
            onNatural({
              width: e.currentTarget.naturalWidth,
              height: e.currentTarget.naturalHeight
            })
          }
          onError={onImageError}
          className="absolute max-w-none select-none"
          style={natural ? imagePlacement(natural, frame, zoom, offset) : undefined}
        />
      </div>
    </div>
  )
}

export default CropViewport
