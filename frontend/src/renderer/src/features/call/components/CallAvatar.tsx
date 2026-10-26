import Avatar from '../../../shared/ui/Avatar'

/**
 * Avatar de quem está numa chamada (tile, lista do canal de voz, espectadores):
 * o GIF anima o tempo todo, sem esperar o mouse em cima como nas listas comuns.
 */
function CallAvatar(props: Omit<React.ComponentProps<typeof Avatar>, 'animate'>): React.JSX.Element {
  return <Avatar {...props} animate="always" />
}

export default CallAvatar
