import type { User } from '../../../auth/store/authStore'
import { usernameLock } from '../../../auth/lib/accountChange'
import type { BirthdayState } from '../../../profile/hooks/useBirthday'
import { draftFromProfile } from '../../../profile/lib/profileValidation'
import { saveMyProfileFields } from '../../../profile/store/myProfileActions'
import { useSaveAndClose } from '../../hooks/useSaveAndClose'
import NameStyleModal from '../profile/modals/NameStyleModal'
import BirthdayEditModal from './BirthdayEditModal'
import CredentialModal from './CredentialModal'

export type AccountModal = 'name' | 'username' | 'email' | 'birthday'

/** O mesmo modal do nome de Perfis, mas "Aplicar" já salva no servidor. */
function AccountNameModal({ user, onClose }: { user: User; onClose: () => void }): React.JSX.Element {
  const { busy, run } = useSaveAndClose(onClose, 'Nome salvo!')
  return (
    <NameStyleModal
      base={{ user, avatarUrl: user.avatar_url ?? null, bannerUrl: user.banner_url ?? null }}
      draft={draftFromProfile(user)}
      busy={busy}
      onClose={onClose}
      onApply={(patch) => void run(() => saveMyProfileFields(patch))}
    />
  )
}

/** O modal aberto em Minha conta (um por vez). */
export default function AccountModals({
  modal,
  user,
  birthday,
  onClose
}: {
  modal: AccountModal | null
  user: User
  birthday: BirthdayState
  onClose: () => void
}): React.JSX.Element | null {
  if (modal === 'name') return <AccountNameModal user={user} onClose={onClose} />
  if (modal === 'username' || modal === 'email') {
    return (
      <CredentialModal
        key={modal}
        kind={modal}
        current={user[modal]}
        locked={modal === 'username' ? usernameLock(user.username_change_available_at) : null}
        onClose={onClose}
      />
    )
  }
  if (modal === 'birthday' && birthday.birthday) {
    return <BirthdayEditModal initial={birthday.birthday} onSave={birthday.save} onClose={onClose} />
  }
  return null
}
