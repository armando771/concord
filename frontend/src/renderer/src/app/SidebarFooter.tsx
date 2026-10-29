import VoiceConnectedPanel from '../features/call/components/VoiceConnectedPanel'
import UpdateBar from '../features/updates/components/UpdateBar'
import UserBar from './UserBar'

/**
 * Rodapé da coluna da esquerda, igual em todas as telas (servidor, DMs,
 * amigos): a barra de atualização (quando há versão nova), o painel "Voz
 * conectada" durante a chamada e a barra do usuário.
 * min-w-0: acompanha a largura redimensionável da sidebar sem vazar; o
 * @container deixa o painel e a barra se ajustarem à largura dela.
 */
function SidebarFooter(): React.JSX.Element {
  return (
    <div className="@container min-w-0 shrink-0">
      <UpdateBar />
      <VoiceConnectedPanel />
      <UserBar />
    </div>
  )
}

export default SidebarFooter
