import { useAnnotationStore } from '../store/annotationStore'
import { EyeIcon, EyeOffIcon, PencilIcon } from '../../../shared/ui/icons'

/** `bar`: barra escura do tile (junto do volume). `overlay`: barra da tela cheia. */
const VARIANTS = {
  bar: {
    idle: 'h-6 w-6 rounded-md text-gray-100 hover:bg-fg/10',
    hidden: 'h-6 w-6 rounded-md bg-fg/20 text-white'
  },
  overlay: {
    idle: 'h-8 w-8 rounded-lg bg-black/60 text-gray-100 hover:bg-white/15 on-media',
    hidden: 'h-8 w-8 rounded-lg bg-white/25 text-white ring-1 ring-fg/30 on-media'
  }
} as const

/**
 * Esconde/mostra, só para mim, os desenhos dessa transmissão (os outros
 * continuam desenhando e vendo). `aria-pressed` = desenhos ocultos.
 */
export function AnnotationVisibilityButton({
  sharerId,
  variant = 'bar'
}: {
  sharerId: string
  variant?: keyof typeof VARIANTS
}): React.JSX.Element {
  const hidden = useAnnotationStore((s) => Boolean(s.hiddenSharers[sharerId]))
  const toggleHidden = useAnnotationStore((s) => s.toggleHidden)
  const Icon = hidden ? EyeOffIcon : EyeIcon

  return (
    <button
      type="button"
      onClick={() => toggleHidden(sharerId)}
      aria-pressed={hidden}
      aria-label="Ocultar desenhos"
      title={hidden ? 'Mostrar desenhos' : 'Ocultar desenhos (só para você)'}
      className={`flex shrink-0 cursor-pointer items-center justify-center transition-colors ${
        VARIANTS[variant][hidden ? 'hidden' : 'idle']
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

/** Anotar (Epic Pen) + ocultar desenhos, lado a lado na barra da tela cheia. */
export function FullscreenAnnotationButtons({ sharerId }: { sharerId: string }): React.JSX.Element {
  const isDrawing = useAnnotationStore((s) => Boolean(s.drawingActive[sharerId]))
  const toggleDrawing = useAnnotationStore((s) => s.toggleDrawing)

  return (
    <>
      <button
        type="button"
        onClick={() => toggleDrawing(sharerId)}
        aria-label="Anotações na transmissão"
        title={isDrawing ? 'Fechar anotações' : 'Anotar / Desenhar na transmissão (Epic Pen)'}
        className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors ${
          isDrawing
            ? 'bg-success-strong text-white shadow-md ring-1 ring-fg/30'
            : 'bg-black/60 text-gray-100 hover:bg-white/15 on-media'
        }`}
      >
        <PencilIcon className="h-4 w-4" />
      </button>
      <AnnotationVisibilityButton sharerId={sharerId} variant="overlay" />
    </>
  )
}
