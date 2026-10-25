import { useState } from 'react'
import { useServerStore } from '../../store/serverStore'
import { showToast } from '../../store/toastStore'
import { actionErrorMessage } from '../../lib/permissionErrors'
import Button from '../Button'
import Input from '../Input'

/** Nome e ícone do servidor (antes era o modal "Editar servidor"). */
function OverviewSection(): React.JSX.Element {
  const server = useServerStore((s) => s.currentServer)
  const updateServer = useServerStore((s) => s.updateServer)
  const [name, setName] = useState(server?.name ?? '')
  const [icon, setIcon] = useState(server?.icon_url ?? '')
  const [saving, setSaving] = useState(false)

  if (!server) return <p className="text-sm text-gray-400">Abra um servidor primeiro.</p>

  const dirty = name.trim() !== server.name || icon.trim() !== (server.icon_url ?? '')

  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await updateServer(server.id, name.trim(), icon.trim())
      showToast.success('Servidor atualizado!')
    } catch (err) {
      showToast.error(actionErrorMessage(err, 'Falha ao salvar servidor.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} className="max-w-md space-y-4">
      <Input
        label="Nome do servidor"
        placeholder="ex.: Meu Servidor"
        value={name}
        maxLength={32}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        label="URL do ícone (opcional)"
        placeholder="https://..."
        value={icon}
        maxLength={500}
        onChange={(e) => setIcon(e.target.value)}
      />
      <Button type="submit" variant="primary" disabled={saving || !dirty || !name.trim()}>
        {saving ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  )
}

export default OverviewSection
