import Modal from '../../../shared/ui/Modal'
import { useServerLevelModalStore } from '../store/serverLevelModalStore'
import ServerLevelDetails from './ServerLevelDetails'

/** "Nível do servidor": o detalhamento para qualquer membro (aberto pelo menu). */
function ServerLevelModal(): React.JSX.Element | null {
  const serverId = useServerLevelModalStore((s) => s.serverId)
  const close = useServerLevelModalStore((s) => s.close)
  return (
    <Modal open={serverId !== null} title="Nível do servidor" onClose={close}>
      {serverId && <ServerLevelDetails serverId={serverId} />}
    </Modal>
  )
}

export default ServerLevelModal
