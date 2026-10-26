import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Channel } from '../api/channels'
import type { Server } from '../api/servers'
import { useServerStore } from '../store/serverStore'
import { useChannelSidebarStore } from '../store/channelSidebarStore'
import { useChatStore } from '../../chat/store/chatStore'
import ConfirmModal from '../../friends/components/ConfirmModal'
import { showToast } from '../../../shared/store/toastStore'
import Modal from '../../../shared/ui/Modal'
import Button from '../../../shared/ui/Button'
import { actionErrorMessage } from '../lib/permissionErrors'
import { errorText } from '../lib/channelSidebar'
import ChannelPermissionsModal from './ChannelPermissionsModal'
import ChannelFormModal from './ChannelFormModal'

function DeleteChannelDialog({
  server,
  channel
}: {
  server: Server
  channel: Channel
}): React.JSX.Element {
  const cancelDelete = useChannelSidebarStore((s) => s.cancelDelete)
  const [busy, setBusy] = useState(false)
  const confirm = async (): Promise<void> => {
    setBusy(true)
    try {
      await useServerStore.getState().deleteChannel(server.id, channel.id)
      void useChatStore.getState().fetchChannelsForServers([server.id])
      cancelDelete()
      showToast.success('Canal deletado!')
    } catch (err) {
      showToast.error(errorText(err, 'Falha ao deletar canal.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open title="Deletar canal" onClose={cancelDelete}>
      <p className="text-ds-md text-gray-300">
        Tem certeza que deseja deletar o canal <b className="text-strong">#{channel.name}</b>? Esta
        ação não pode ser desfeita e apagará todas as mensagens do canal.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={cancelDelete}>
          Cancelar
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => void confirm()}>
          {busy ? 'Deletando...' : 'Deletar canal'}
        </Button>
      </div>
    </Modal>
  )
}

function DeleteServerDialog({ server }: { server: Server }): React.JSX.Element {
  const navigate = useNavigate()
  const closeConfirm = useChannelSidebarStore((s) => s.closeConfirm)
  const [busy, setBusy] = useState(false)
  const confirm = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await useServerStore.getState().deleteServer(server.id)
      useChatStore.getState().handleServerDeleted(server.id)
      closeConfirm()
      navigate('/friends')
      showToast.success('Servidor deletado!')
    } catch (err) {
      showToast.error(errorText(err, 'Falha ao deletar servidor.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open title="Deletar servidor" onClose={closeConfirm}>
      <p className="text-ds-md text-gray-300">
        Tem certeza que deseja deletar o servidor <b className="text-strong">{server.name}</b>?
        Todos os canais e mensagens serão apagados e todos os membros serão removidos. Esta ação não
        pode ser desfeita.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={closeConfirm}>
          Cancelar
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => void confirm()}>
          {busy ? 'Deletando...' : 'Deletar servidor'}
        </Button>
      </div>
    </Modal>
  )
}

function LeaveServerDialog({ server }: { server: Server }): React.JSX.Element {
  const navigate = useNavigate()
  const open = useChannelSidebarStore((s) => s.confirm === 'leave')
  const closeConfirm = useChannelSidebarStore((s) => s.closeConfirm)
  const leave = async (): Promise<void> => {
    try {
      await useServerStore.getState().leaveServer(server.id)
      useChatStore.getState().handleServerDeleted(server.id)
      navigate('/friends')
    } catch (err) {
      showToast.error(actionErrorMessage(err, 'Não foi possível sair do servidor.'))
    }
  }
  return (
    <ConfirmModal
      open={open}
      title={`Sair de ${server.name}`}
      confirmLabel="Sair do servidor"
      onClose={closeConfirm}
      onConfirm={leave}
    >
      <p>
        Você sai de <b className="text-strong">{server.name}</b> e só volta com um novo convite.
      </p>
    </ConfirmModal>
  )
}

/** Os diálogos da barra de canais: criar/editar, apagar canal, permissões, sair e apagar servidor. */
function SidebarDialogs({ server }: { server: Server }): React.JSX.Element {
  const deleting = useChannelSidebarStore((s) => s.deleting)
  const permissionsFor = useChannelSidebarStore((s) => s.permissionsFor)
  const deletingServer = useChannelSidebarStore((s) => s.confirm === 'delete-server')
  const closePermissions = useChannelSidebarStore((s) => s.closePermissions)
  return (
    <>
      <ChannelFormModal server={server} />
      {deleting && <DeleteChannelDialog key={deleting.id} server={server} channel={deleting} />}
      {deletingServer && <DeleteServerDialog server={server} />}
      <ChannelPermissionsModal channel={permissionsFor} onClose={closePermissions} />
      <LeaveServerDialog server={server} />
    </>
  )
}

export default SidebarDialogs
