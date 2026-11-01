import { useState } from 'react'
import { useServerStore } from '../store/serverStore'
import { showToast } from '../../../shared/store/toastStore'
import { actionErrorMessage } from '../lib/permissionErrors'
import type { MediaChange } from '../../profile/lib/profileValidation'
import Button from '../../../shared/ui/Button'
import Input from '../../../shared/ui/Input'
import ServerIconPicker from './ServerIconPicker'

/** Nome e ícone do servidor (antes era o modal "Editar servidor"). */
function OverviewSection(): React.JSX.Element {
  const server = useServerStore((s) => s.currentServer)
  const updateServer = useServerStore((s) => s.updateServer)
  const setServerIcon = useServerStore((s) => s.setServerIcon)
  const [name, setName] = useState(server?.name ?? '')
  // Mesmo fluxo do avatar: escolher, recortar, ver a prévia e só enviar ao salvar.
  const [icon, setIcon] = useState<MediaChange>({ kind: 'keep' })
  const [saving, setSaving] = useState(false)
  if (!server) return <p className="text-sm text-gray-400">Abra um servidor primeiro.</p>

  const dirty = name.trim() !== server.name || icon.kind !== 'keep'

  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      if (name.trim() !== server.name) await updateServer(server.id, name.trim())
      if (icon.kind === 'set') {
        await setServerIcon(server.id, { file: icon.file, staticFrame: icon.staticFrame })
      } else if (icon.kind === 'remove') {
        await setServerIcon(server.id, null)
      }
      setIcon({ kind: 'keep' })
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
      <ServerIconPicker
        name={name || server.name}
        currentUrl={server.icon_url}
        value={icon}
        onChange={setIcon}
      />
      <Button type="submit" variant="primary" disabled={saving || !dirty || !name.trim()}>
        {saving ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  )
}

export default OverviewSection
