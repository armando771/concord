import type { User } from '../../auth/store/authStore'
import {
  draftFromProfile,
  type MediaChange,
  type ProfileDraft
} from '../../profile/lib/profileValidation'
import type { DraftPatch } from './draftPatch'
import { saveErrorMessage, saveProfile, type SaveProfileDeps } from './saveProfile'

// Configurações → Perfis salva cada mudança na hora, como o "Aplicar" de cada
// modal do Discord: o perfil salvo + a mudança vão pelo mesmo caminho do
// saveProfile (imagens primeiro, depois os campos), sem rascunho pendente.

/** O que um modal (ou o recorte de imagem) muda no perfil. */
export interface ProfileChange {
  fields?: DraftPatch
  avatar?: MediaChange
  banner?: MediaChange
}

/** Quem fala com o servidor e com a sessão (o rascunho fica aqui dentro). */
export type ApplyDeps = Omit<SaveProfileDeps, 'draft' | 'keepMedia' | 'setDraft'>

const KEEP: MediaChange = { kind: 'keep' }

/** O perfil salvo com a mudança por cima (também serve de prévia). */
export function draftWithChange(user: User | null, change: ProfileChange): ProfileDraft {
  return {
    ...draftFromProfile(user ?? {}),
    ...change.fields,
    avatar: change.avatar ?? KEEP,
    banner: change.banner ?? KEEP
  }
}

/** Salva a mudança e avisa com um toast; devolve se deu certo (o modal fecha). */
export async function applyProfileChange(
  change: ProfileChange,
  deps: ApplyDeps,
  notify: { success: (msg: string) => void; error: (msg: string) => void }
): Promise<boolean> {
  let draft = draftWithChange(deps.savedUser(), change)
  try {
    await saveProfile({
      ...deps,
      draft: () => draft,
      keepMedia: (kind) => {
        draft = { ...draft, [kind]: KEEP }
      },
      setDraft: (next) => {
        draft = next
      }
    })
    notify.success('Perfil salvo!')
    return true
  } catch (err) {
    notify.error(saveErrorMessage(err))
    return false
  }
}
