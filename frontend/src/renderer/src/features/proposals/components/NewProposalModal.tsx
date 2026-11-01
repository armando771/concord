import { useRef, useState } from 'react'
import { ApiError } from '../../../shared/api/client'
import type { Proposal } from '../api/proposals'
import {
  IMAGE_ACCEPT,
  MAX_DESCRIPTION,
  MAX_IMAGES,
  MAX_OPEN_PER_USER,
  MAX_TITLE
} from '../lib/proposals'
import { useProposalStore } from '../store/proposalStore'
import { showToast } from '../../../shared/store/toastStore'
import Button from '../../../shared/ui/Button'
import Input from '../../../shared/ui/Input'
import Modal from '../../../shared/ui/Modal'
import ProposalImageStrip from './ProposalImageStrip'
import { useProposalImages } from '../hooks/useProposalImages'

interface NewProposalModalProps {
  open: boolean
  onClose: () => void
  /** Presente: edita esta proposta em vez de criar uma nova. */
  proposal?: Proposal
}

function errorMessage(err: unknown, editing: boolean): string {
  if (err instanceof ApiError) {
    if (err.code === 'too_many_open') {
      return `Você já tem ${MAX_OPEN_PER_USER} propostas em votação. Espere uma terminar para criar outra.`
    }
    if (err.code === 'email_not_verified') {
      return 'Confirme seu e-mail para propor melhorias.'
    }
    if (err.status === 403) return 'Você não pode editar esta proposta.'
  }
  if (err instanceof Error && err.message) return err.message
  return editing ? 'Não foi possível salvar a proposta.' : 'Não foi possível criar a proposta.'
}

function ProposalForm({
  onClose,
  proposal
}: {
  onClose: () => void
  proposal?: Proposal
}): React.JSX.Element {
  const create = useProposalStore((s) => s.create)
  const update = useProposalStore((s) => s.update)
  const editing = proposal != null
  const [title, setTitle] = useState(proposal?.title ?? '')
  const [description, setDescription] = useState(proposal?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const images = useProposalImages(proposal?.images)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (title.trim().length < 3 || images.uploading) return
    setSaving(true)
    try {
      if (proposal) {
        await update(proposal.id, title.trim(), description.trim(), images.ids)
        showToast.success('Proposta atualizada.')
      } else {
        await create(title.trim(), description.trim(), images.ids)
        showToast.success('Proposta criada! A votação dura 7 dias.')
      }
      onClose()
    } catch (err) {
      showToast.error(errorMessage(err, editing))
    } finally {
      setSaving(false)
    }
  }

  const hasFiles = (e: React.DragEvent): boolean => e.dataTransfer.types.includes('Files')

  return (
    <form
      onSubmit={submit}
      className="relative flex flex-col gap-4"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault()
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        images.add([...e.dataTransfer.files])
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-violet-400 bg-black/60 text-sm font-medium text-violet-200 on-media">
          Solte as imagens aqui
        </div>
      )}
      {!editing && (
        <p className="text-xs text-gray-400">
          Todo mundo vota por 7 dias. Se tiver mais sim do que não, a ideia vai para o time tech e
          vira uma issue no GitHub.
        </p>
      )}
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
          className="glass-input w-full resize-none rounded-lg px-3 py-2 text-ds-sm text-strong"
          onChange={(e) => setDescription(e.target.value)}
          onPaste={(e) => {
            const files = [...e.clipboardData.files]
            if (files.length === 0) return
            e.preventDefault()
            images.add(files)
          }}
        />
        <span className="self-end text-[11px] text-gray-500">
          {description.length}/{MAX_DESCRIPTION}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-ds-sm font-medium text-gray-300">
            Imagens (opcional, até {MAX_IMAGES})
          </span>
          <Button
            type="button"
            variant="ghost"
            className="px-3 py-1 text-xs"
            disabled={images.drafts.length >= MAX_IMAGES}
            onClick={() => fileInput.current?.click()}
          >
            Adicionar imagem
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              images.add([...(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
        </div>
        <ProposalImageStrip drafts={images.drafts} onRemove={images.remove} />
        {images.drafts.length === 0 && (
          <p className="text-[11px] text-gray-500">
            Escolha, cole (Ctrl+V) ou arraste PNG, JPG, WebP ou GIF de até 8 MB.
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving || images.uploading || title.trim().length < 3}>
          {saving
            ? editing
              ? 'Salvando...'
              : 'Criando...'
            : images.uploading
              ? 'Enviando imagens...'
              : editing
                ? 'Salvar'
                : 'Criar proposta'}
        </Button>
      </div>
    </form>
  )
}

function NewProposalModal({
  open,
  onClose,
  proposal
}: NewProposalModalProps): React.JSX.Element | null {
  // O formulário só existe com o modal aberto: cada abertura começa do zero (ou
  // da proposta editada) e fechar cancela os envios em andamento.
  return (
    <Modal
      open={open}
      title={proposal ? 'Editar proposta' : 'Propor uma melhoria'}
      onClose={onClose}
    >
      <ProposalForm onClose={onClose} proposal={proposal} />
    </Modal>
  )
}

export default NewProposalModal
