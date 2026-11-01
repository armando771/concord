import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useServerStore } from '../store/serverStore'
import { showToast } from '../../../shared/store/toastStore'
import Modal from '../../../shared/ui/Modal'
import Button from '../../../shared/ui/Button'
import Input from '../../../shared/ui/Input'
import ServerIconPicker from './ServerIconPicker'
import type { MediaChange } from '../../profile/lib/profileValidation'
import { joinServerByCode } from '../api/servers'
import { runCreateServer, runJoinServer, type ServerFlowDeps } from '../lib/serverFlows'

function useServerFlowDeps(): ServerFlowDeps {
  const fetchServers = useServerStore((s) => s.fetchServers)
  const addServer = useServerStore((s) => s.addServer)
  const setServerIcon = useServerStore((s) => s.setServerIcon)
  return {
    addServer,
    setServerIcon,
    joinServerByCode,
    fetchServers,
    success: showToast.success,
    error: showToast.error
  }
}

function CreateServerForm({
  onDone,
  onCancel
}: {
  onDone: (serverId: string) => void
  onCancel: () => void
}): React.JSX.Element {
  const deps = useServerFlowDeps()
  const [serverName, setServerName] = useState('')
  const [icon, setIcon] = useState<MediaChange>({ kind: 'keep' })
  const [creating, setCreating] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!serverName.trim()) return
    setCreating(true)
    const id = await runCreateServer(deps, serverName.trim(), icon)
    setCreating(false)
    if (!id) return
    setServerName('')
    setIcon({ kind: 'keep' })
    onDone(id)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-xs text-gray-400">
        Dê um nome e uma personalidade ao seu novo servidor. Você poderá alterar isso a qualquer
        momento.
      </p>

      <Input
        label="Nome do servidor"
        placeholder="Ex: Servidor dos Brothers"
        value={serverName}
        onChange={(e) => setServerName(e.target.value)}
        autoFocus
      />

      <ServerIconPicker name={serverName} value={icon} onChange={setIcon} />

      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={creating || !serverName.trim()}>
          {creating ? 'Criando...' : 'Criar servidor'}
        </Button>
      </div>
    </form>
  )
}

/** Entrar em um servidor existente com o código ou o link de convite. */
function JoinServerForm({ onDone }: { onDone: (serverId: string) => void }): React.JSX.Element {
  const deps = useServerFlowDeps()
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)
    const id = await runJoinServer(deps, joinCode)
    setJoining(false)
    if (!id) return
    setJoinCode('')
    onDone(id)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-5 flex flex-col gap-3 border-t border-subtle pt-5"
    >
      <p className="text-sm font-semibold text-strong">Entrar com código</p>
      <p className="-mt-1 text-xs text-gray-400">Cole o link de convite ou digite o código.</p>
      <div className="flex gap-2">
        <Input
          placeholder="Ex: K7P2QX9M ou https://app-salinha.bhrx.com.br/convite/K7P2QX9M"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          aria-label="Código ou link de convite"
          className="font-mono"
        />
        <Button type="submit" variant="success" disabled={joining || !joinCode.trim()}>
          {joining ? 'Entrando...' : 'Entrar'}
        </Button>
      </div>
    </form>
  )
}

/** Modal "Criar ou entrar em um servidor". */
function CreateServerModal({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const handleDone = (serverId: string): void => {
    onClose()
    navigate(`/servers/${serverId}`)
  }

  return (
    <Modal open={open} title="Criar ou entrar em um servidor" onClose={onClose}>
      <CreateServerForm onDone={handleDone} onCancel={onClose} />
      <JoinServerForm onDone={handleDone} />
    </Modal>
  )
}

export default CreateServerModal
