import { useAuthStore } from '../../auth/store/authStore'
import { commitMe } from '../../auth/store/accountActions'
import { updateProfile } from '../api/users'
import { draftFromProfile, profilePayload, type ProfileFields } from '../lib/profileValidation'

/**
 * Salva na hora só uma parte do perfil (ex.: o nome em Minha conta), com o
 * resto como está salvo.
 */
export async function saveMyProfileFields(patch: Partial<ProfileFields>): Promise<void> {
  const user = useAuthStore.getState().user
  if (!user) return
  commitMe(await updateProfile(profilePayload({ ...draftFromProfile(user), ...patch })))
}
