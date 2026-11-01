import { useState } from 'react'
import { UserPlusIcon } from '../../../shared/ui/icons'
import InviteFriendsModal from '../../call/components/InviteFriendsModal'
import { INVITE_COPY } from '../../call/lib/callInviteCopy'

/**
 * Mesmo toque do balão: o alvo cresce na vertical e um pouco para os lados
 * (entre o balão e este botão sobram só 8 px).
 */
const TOUCH_AREA =
  "before:absolute before:inset-0 before:content-[''] pointer-coarse:before:-inset-y-2.5 pointer-coarse:before:-inset-x-1"

/**
 * "Convidar amigos" na linha do canal de voz em que estou conectado, entre o
 * balão do chat e o "•••". Abre a janela de escolha; o convite vai para a
 * conversa privada de cada amigo. Na tela estreita (toque) fica sempre
 * visível; do sm em diante, no hover ou no foco do teclado.
 */
function VoiceInviteButton({
  callId,
  besideMenu
}: {
  callId: string
  /** O "•••" ocupa a ponta direita: balão e convite ficam à esquerda dele. */
  besideMenu: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        aria-label={INVITE_COPY.buttonLabel}
        aria-haspopup="dialog"
        title={INVITE_COPY.buttonLabel}
        className={`absolute top-1.5 z-20 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-[color,background-color,opacity] hover:bg-fg/10 hover:text-strong focus-visible:opacity-100 sm:opacity-0 sm:group-hover/voicech:opacity-100 ${TOUCH_AREA} ${
          besideMenu ? 'right-14' : 'right-[34px]'
        }`}
      >
        <UserPlusIcon className="h-4 w-4" />
      </button>
      <InviteFriendsModal open={open} callId={callId} onClose={() => setOpen(false)} />
    </>
  )
}

export default VoiceInviteButton
