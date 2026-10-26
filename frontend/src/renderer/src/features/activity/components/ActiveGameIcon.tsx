import { canBroadcastGame } from '../lib/gameBroadcast'
import GameBroadcastButton from './GameBroadcastButton'
import GameIcon from './GameIcon'

/**
 * Ícone do jogo em andamento no painel de voz. No desktop vira o botão de
 * transmitir a janela do jogo na call; fora dele (ou sem como achar a janela),
 * é só o ícone do jogo. Mesmas props do GameIcon.
 */
function ActiveGameIcon(props: React.ComponentProps<typeof GameIcon>): React.JSX.Element {
  if (!canBroadcastGame(window)) return <GameIcon {...props} />
  return <GameBroadcastButton game={props.name} />
}

export default ActiveGameIcon
