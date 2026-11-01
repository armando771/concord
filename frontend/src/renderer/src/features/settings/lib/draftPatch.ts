import {
  profileErrors,
  type ProfileDraft,
  type ProfileErrors,
  type ProfileFields
} from '../../profile/lib/profileValidation'

// Os modais de edição do cartão (nome, pronomes, nota...) mexem numa cópia do
// rascunho e só passam para ele em "Aplicar".

export type DraftPatch = Partial<ProfileFields>

/** O rascunho com a mudança do modal por cima (para a prévia). */
export const patchedDraft = (draft: ProfileDraft, patch: DraftPatch): ProfileDraft => ({
  ...draft,
  ...patch
})

/** Os erros só dos campos que o modal edita (um nome inválido não trava os pronomes). */
export function patchErrors(draft: ProfileDraft, keys: readonly (keyof ProfileFields)[]): ProfileErrors {
  const all = profileErrors(draft)
  const errors: ProfileErrors = {}
  for (const key of keys) if (all[key]) errors[key] = all[key]
  if (keys.includes('links') && all.linkErrors) errors.linkErrors = all.linkErrors
  return errors
}
