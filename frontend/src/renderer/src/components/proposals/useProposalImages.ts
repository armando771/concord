import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import type { ProposalImage } from '../../api/proposals'
import { uploadProposalImage } from '../../api/proposals'
import { pickImageFiles, proposalImageSrc } from '../../lib/proposals'
import { showToast } from '../../store/toastStore'

/** Imagem do formulário: já salva na proposta, enviada (pendente) ou subindo. */
export interface ImageDraft {
  key: string
  /** Id no servidor; nulo enquanto sobe ou se o envio falhou. */
  id: string | null
  previewUrl: string
  /** 0..1 enquanto sobe. */
  progress: number
  error?: string
}

function uploadError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 413) return 'A imagem tem mais de 8 MB.'
    if (err.status === 415) return 'Tipo de imagem não suportado.'
    if (err.code === 'email_not_verified') return 'Confirme seu e-mail para enviar imagens.'
  }
  return 'Não foi possível enviar a imagem.'
}

/**
 * Imagens de uma proposta em edição: sobe cada arquivo assim que é escolhido
 * (fica pendente no servidor até salvar) e guarda a ordem. `initial` são as
 * imagens que o card já tem.
 */
export function useProposalImages(initial: ProposalImage[] = []): {
  drafts: ImageDraft[]
  uploading: boolean
  /** Ids prontos, na ordem de exibição. */
  ids: string[]
  add: (files: File[]) => void
  remove: (key: string) => void
} {
  const [drafts, setDrafts] = useState<ImageDraft[]>(() =>
    initial.map((img) => ({
      key: img.id,
      id: img.id,
      previewUrl: proposalImageSrc(img.url),
      progress: 1
    }))
  )
  const draftsRef = useRef(drafts)
  const controllers = useRef(new Map<string, AbortController>())
  const blobs = useRef(new Set<string>())

  useEffect(() => {
    draftsRef.current = drafts
  }, [drafts])

  // Ao fechar: cancela o que ainda sobe e solta as prévias locais.
  useEffect(() => {
    const live = controllers.current
    const urls = blobs.current
    return () => {
      live.forEach((c) => c.abort())
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])

  const patch = useCallback((key: string, change: Partial<ImageDraft>) => {
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...change } : d)))
  }, [])

  const add = useCallback(
    (files: File[]) => {
      const { accepted, errors } = pickImageFiles(draftsRef.current.length, files)
      errors.forEach((e) => showToast.error(e))
      if (accepted.length === 0) return

      const fresh = accepted.map((file) => {
        const previewUrl = URL.createObjectURL(file)
        blobs.current.add(previewUrl)
        return { file, draft: { key: crypto.randomUUID(), id: null, previewUrl, progress: 0 } }
      })
      setDrafts((list) => [...list, ...fresh.map((f) => f.draft)])

      for (const { file, draft } of fresh) {
        const controller = new AbortController()
        controllers.current.set(draft.key, controller)
        uploadProposalImage(file, file.name, {
          signal: controller.signal,
          onProgress: (progress) => patch(draft.key, { progress })
        })
          .then((img) => patch(draft.key, { id: img.id, progress: 1 }))
          .catch((err) => {
            if (controller.signal.aborted) return
            patch(draft.key, { error: uploadError(err) })
          })
          .finally(() => controllers.current.delete(draft.key))
      }
    },
    [patch]
  )

  const remove = useCallback((key: string) => {
    controllers.current.get(key)?.abort()
    setDrafts((list) => list.filter((d) => d.key !== key))
  }, [])

  return {
    drafts,
    uploading: drafts.some((d) => d.id == null && !d.error),
    ids: drafts.flatMap((d) => (d.id ? [d.id] : [])),
    add,
    remove
  }
}
