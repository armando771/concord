import { useDraggable } from '@dnd-kit/core'
import ProposalCard from './ProposalCard'

type DraggableProposalCardProps = React.ComponentProps<typeof ProposalCard>

/**
 * Card que o time tech arrasta para outra coluna. O arrasto só começa depois de
 * alguns pixels (veja o sensor em Proposals), então o clique que abre o modal e
 * os botões de dentro do card continuam funcionando. Só `listeners` vão no
 * invólucro: os atributos de acessibilidade do dnd-kit trariam um segundo
 * role="button" por cima do card; quem não usa mouse move pelo "Mover para…".
 */
function DraggableProposalCard({
  draggable,
  ...card
}: DraggableProposalCardProps & { draggable: boolean }): React.JSX.Element {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: card.proposal.id,
    disabled: !draggable
  })

  return (
    <div
      ref={setNodeRef}
      {...(draggable ? listeners : undefined)}
      className={isDragging ? 'opacity-40' : undefined}
    >
      <ProposalCard {...card} />
    </div>
  )
}

export default DraggableProposalCard
