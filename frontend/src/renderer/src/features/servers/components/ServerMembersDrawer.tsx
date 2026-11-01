import Drawer from '../../../shared/ui/Drawer'
import { useMobileNavStore } from '../../navigation/store/mobileNavStore'
import type { Server } from '../api/servers'
import { ServerMemberGroups } from './ServerMemberList'

/**
 * Membros do servidor numa gaveta pela direita, onde a coluna de membros não
 * cabe (abaixo do lg). Abre pelo botão do cabeçalho (MembersDrawerButton).
 */
function ServerMembersDrawer({ server }: { server: Server }): React.JSX.Element {
  const open = useMobileNavStore((s) => s.membersOpen)
  const setOpen = useMobileNavStore((s) => s.setMembersOpen)
  return (
    <Drawer open={open} onClose={() => setOpen(false)} label="Membros" className="lg:hidden">
      <div className="space-y-6 p-4">
        <ServerMemberGroups server={server} />
      </div>
    </Drawer>
  )
}

export default ServerMembersDrawer
