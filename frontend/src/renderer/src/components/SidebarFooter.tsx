import VoiceConnectedPanel from './call/VoiceConnectedPanel'
import UserBar from './UserBar'

/**
 * Rodapé da coluna da esquerda, igual em todas as telas (servidor, DMs,
 * amigos): o painel "Voz conectada" durante a chamada e a barra do usuário.
 * min-w-0: acompanha a largura redimensionável da sidebar sem vazar.
 */
function SidebarFooter(): React.JSX.Element {
  return (
    <div className="min-w-0 shrink-0">
      <VoiceConnectedPanel />
      <UserBar />
    </div>
  )
}

export default SidebarFooter
