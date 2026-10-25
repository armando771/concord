import { useState } from 'react'
import { ApiError } from '../../api/client'
import { useProposalStore } from '../../store/proposalStore'
import { showToast } from '../../store/toastStore'
import Button from '../Button'
import Input from '../Input'
import Modal from '../Modal'

const MAX_TITLE = 120
const MAX_DESCRIPTION = 2000

interface NewProposalModalProps {
  open: boolean
  onClose: () => void
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'too_many_open') {
      return 'Você já tem 3 propostas em votação. Espere uma terminar para criar outra.'
    }
    if (err.code === 'email_not_verified') {
      return 'Confirme seu e-mail para propor melhorias.'
    }
  }
  return err instanceof Error ? err.message : 'Não foi possível criar a proposta.'
}

function NewProposalModal({ open, onClose }: NewProposalModalProps): React.JSX.Element | null {
  const create = useProposalStore((s) => s.create)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const close = (): void => {
    if (saving) return
    setTitle('')
    setDescription('')
    onClose()
  }

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (title.trim().length < 3) return
    setSaving(true)
    try {
      await create(title.trim(), description.trim())
      showToast.success('Proposta criada! A votação dura 7 dias.')
      setTitle('')
      setDescription('')
      onClose()
    } catch (err) {
      showToast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title="Propor uma melhoria" onClose={close}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-xs text-gray-400">
          Todo mundo vota por 7 dias. Se tiver mais sim do que não, a ideia vai para o time tech e
          vira uma issue no GitHub.
        </p>
        <Input
          label="Título"
          value={title}
          maxLength={MAX_TITLE}
          placeholder="Ex.: Modo claro para o app"
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="proposal-description" className="text-ds-sm font-medium text-gray-300">
            Descrição (opcional)
          </label>
          <textarea
            id="proposal-description"
            value={description}
            maxLength={MAX_DESCRIPTION}
            rows={5}
            placeholder="Explique o problema e como você imagina a solução."
            className="glass-input w-full resize-none rounded-lg px-3 py-2 text-ds-sm text-white"
            onChange={(e) => setDescription(e.target.value)}
          />
          <span className="self-end text-[11px] text-gray-500">
            {description.length}/{MAX_DESCRIPTION}
          </span>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || title.trim().length < 3}>
            {saving ? 'Criando...' : 'Criar proposta'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default NewProposalModal
