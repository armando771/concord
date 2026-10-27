import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuthStore, type User } from '../../auth/store/authStore'
import { commitMe } from '../../auth/store/accountActions'
import { useSettingsStore } from '../store/settingsStore'
import { showToast } from '../../../shared/store/toastStore'
import { deleteProfileImage, updateProfile, uploadProfileImage } from '../../profile/api/users'
import {
  draftFromProfile,
  hasErrors,
  imageFileError,
  isDirty,
  profileErrors,
  type MediaChange,
  type ProfileDraft,
  type ProfileErrors
} from '../../profile/lib/profileValidation'
import { saveProfileAndNotify } from '../lib/saveProfile'
import type { ImageKind } from '../components/ImageCropModal'

export interface Cropping {
  file: File
  src: string
  kind: ImageKind
}

export interface ProfileEditor {
  user: User | null
  draft: ProfileDraft
  errors: ProfileErrors
  dirty: boolean
  invalid: boolean
  saving: boolean
  progress: number | null
  shaking: boolean
  cropping: Cropping | null
  set: <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => void
  setMedia: (kind: ImageKind, change: MediaChange) => void
  pickFile: (kind: ImageKind, file: File | undefined) => void
  closeCrop: (change?: MediaChange) => void
  reset: () => void
  save: () => Promise<void>
}

const revoke = (change: MediaChange): void => {
  if (change.kind === 'set') URL.revokeObjectURL(change.previewUrl)
}

/** Avisa o resto das configurações e treme a barra ao tentar sair. */
function useDirtyGuard(dirty: boolean): boolean {
  const setDirty = useSettingsStore((s) => s.setDirty)
  const blockedAt = useSettingsStore((s) => s.blockedAt)
  const [shaking, setShaking] = useState(false)

  useEffect(() => {
    setDirty(dirty)
  }, [dirty, setDirty])
  useEffect(() => () => setDirty(false), [setDirty])

  // Tentou sair com alterações: a barra treme e fica vermelha por um instante.
  const firstBlock = useRef(blockedAt)
  useEffect(() => {
    if (blockedAt === firstBlock.current) return
    setShaking(true)
    const t = setTimeout(() => setShaking(false), 900)
    return () => clearTimeout(t)
  }, [blockedAt])
  return shaking
}

/**
 * Estado do editor de Configurações → Perfis: o rascunho, os erros, o recorte
 * de imagem e o "Salvar alterações". Nada vai para o servidor antes de salvar.
 */
export function useProfileEditor(): ProfileEditor {
  const user = useAuthStore((s) => s.user)
  const saved = useMemo(() => draftFromProfile(user ?? {}), [user])
  const [draft, setDraft] = useState<ProfileDraft>(saved)
  const [cropping, setCropping] = useState<Cropping | null>(null)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)

  const dirty = isDirty(draft, saved)
  const errors = profileErrors(draft)
  const invalid = hasErrors(errors)
  const shaking = useDirtyGuard(dirty)

  // Prévias locais (blob:) vivem enquanto o rascunho existir.
  const draftRef = useRef(draft)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])
  useEffect(
    () => () => {
      revoke(draftRef.current.avatar)
      revoke(draftRef.current.banner)
    },
    []
  )

  const set: ProfileEditor['set'] = (key, value) => setDraft((d) => ({ ...d, [key]: value }))

  const setMedia = (kind: ImageKind, change: MediaChange): void =>
    setDraft((d) => {
      revoke(d[kind])
      return { ...d, [kind]: change }
    })

  const pickFile = (kind: ImageKind, file: File | undefined): void => {
    if (!file) return
    const error = imageFileError(file)
    if (error) {
      showToast.error(error)
      return
    }
    setCropping({ file, kind, src: URL.createObjectURL(file) })
  }

  const closeCrop = (change?: MediaChange): void => {
    if (!cropping) return
    URL.revokeObjectURL(cropping.src)
    if (change) setMedia(cropping.kind, change)
    setCropping(null)
  }

  const reset = (): void => {
    revoke(draft.avatar)
    revoke(draft.banner)
    setDraft(saved)
  }

  const save = async (): Promise<void> => {
    if (invalid || saving) return
    setSaving(true)
    await saveProfileAndNotify(
      {
        draft: () => draftRef.current,
        savedUser: () => useAuthStore.getState().user,
        upload: uploadProfileImage,
        remove: deleteProfileImage,
        update: updateProfile,
        commit: commitMe,
        keepMedia: (kind) => {
          draftRef.current = { ...draftRef.current, [kind]: { kind: 'keep' } }
          setMedia(kind, { kind: 'keep' })
        },
        setProgress,
        setDraft: (next) => {
          draftRef.current = next
          setDraft(next)
        }
      },
      showToast
    )
    setSaving(false)
  }

  return {
    user,
    draft,
    errors,
    dirty,
    invalid,
    saving,
    progress,
    shaking,
    cropping,
    set,
    setMedia,
    pickFile,
    closeCrop,
    reset,
    save
  }
}
