import { useDroppable } from '@dnd-kit/core'

/**
 * Faixa "Solte aqui para recusar", fixa na parte de baixo do quadro enquanto um
 * card é arrastado. A coluna "Recusada" fica atrás de um filtro e, ao abrir no
 * fim do quadro, quase sempre estaria fora da tela; a faixa não empurra nenhuma
 * coluna, então o que estava embaixo do mouse continua lá.
 */
function RejectDropZone(): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: 'rejected' })
  return (
    <div
      ref={setNodeRef}
      data-dropzone="rejected"
      className={`pointer-events-auto absolute inset-x-6 bottom-4 z-10 flex h-16 items-center justify-center rounded-2xl border-2 border-dashed text-sm font-semibold backdrop-blur-sm transition-colors ${
        isOver
          ? 'border-red-400 bg-red-500/25 text-red-100'
          : 'border-red-400/40 bg-surface text-red-200/80'
      }`}
    >
      Solte aqui para recusar
    </div>
  )
}

export default RejectDropZone
