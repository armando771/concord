import type { ReactNode } from 'react'
import type { PresenceStatus } from '../../friends/lib/presenceStatus'
import { ProfileActivities } from '../../activity/components/ProfileActivities'
import { ProfileAvatar, ProfileBanner, ProfileNote } from './ProfileCardTop'
import { MaestroHowto, ProfileBio, ProfileLinks, ProfileNames } from './ProfileCardDetails'
import type { NameStyle } from '../lib/nameStyle'
import { CARD_BG, type ProfileTheme } from '../lib/profileTheme'

/** Fundo do cartão sem tema: recorta o avatar e a bolinha de status. */
export { CARD_BG }

export interface CardProfile {
  id?: string
  display_name: string
  name_style?: NameStyle
  /** Apelido no servidor aberto: aparece em destaque, com o nome de verdade embaixo. */
  nickname?: string | null
  username?: string
  avatar_url?: string | null
  banner_url?: string | null
  banner_color?: string | null
  pronouns?: string
  bio?: string
  status_text?: string
  links?: string[]
  /** Bot (Maestro, Salinha Bot): selo BOT; o Maestro tem banner animado próprio. */
  is_bot?: boolean
  /** Borda, fundo e efeito do cartão (quem desenha é o ProfileCardFrame). */
  profile_theme?: ProfileTheme
}

export interface ProfileCardBodyProps {
  profile: CardProfile
  status?: PresenceStatus | null
  isMe?: boolean
  /** Banner sem imagem nem cor escolhida (o gradiente de cargo/nível). */
  fallbackBanner: string
  avatarFallbackClassName?: string
  /** Canto direito, na altura do avatar (selo de nível). */
  badge?: ReactNode
  /** Fileira de badges ao lado do username. */
  badges?: ReactNode
  /** Só no próprio perfil: avatar e nota vazia levam ao editor. */
  onEditProfile?: () => void
  /** Prévia do editor: o avatar não usa o profileStore (mostra o rascunho). */
  preview?: boolean
  /**
   * O perfil completo (banner, nota, Sobre mim) ainda não chegou: o cartão já
   * mostra o que se sabe (nome, @usuário) e o resto aparece em skeleton.
   */
  loading?: boolean
  /** Cor do fundo logo abaixo do banner (tema): anel do avatar e recorte do status. */
  surface?: string
  /** Prévia do editor: passar o mouse mostra o lápis e o clique já abre o arquivo. */
  onEditAvatar?: () => void
  onEditBanner?: () => void
  children?: ReactNode
}

/**
 * Corpo do cartão de perfil (banner, avatar, nota, nome, Sobre mim e links),
 * igual no cartão que abre ao clicar e na prévia do editor de perfil.
 */
function ProfileCardBody({
  profile,
  status,
  isMe = false,
  fallbackBanner,
  avatarFallbackClassName,
  badge,
  badges,
  onEditProfile,
  preview = false,
  loading = false,
  surface = CARD_BG,
  onEditAvatar,
  onEditBanner,
  children
}: ProfileCardBodyProps): React.JSX.Element {
  return (
    <div>
      <ProfileBanner
        profile={profile}
        fallbackBanner={fallbackBanner}
        loading={loading}
        surface={surface}
        onEditBanner={onEditBanner}
      />

      <div className="px-4 pb-4">
        {/* A faixa que sobe por cima do banner não pega o mouse (o lápis do banner
            aparece nela também); só o avatar, a nota e o selo pegam. */}
        <div className="pointer-events-none relative -mt-[46px] flex items-start justify-between">
          <div className="flex min-w-0 items-start gap-2">
            <ProfileAvatar
              profile={profile}
              status={status}
              preview={preview}
              surface={surface}
              avatarFallbackClassName={avatarFallbackClassName}
              onEditProfile={onEditProfile}
              onEditAvatar={onEditAvatar}
            />
            <ProfileNote
              note={profile.status_text?.trim()}
              isMe={isMe}
              onEditProfile={onEditProfile}
            />
          </div>
          {badge && <div className="pointer-events-auto mt-[52px] shrink-0">{badge}</div>}
        </div>

        <ProfileNames profile={profile} isMe={isMe} preview={preview} badges={badges} />
        <ProfileActivities userId={preview ? undefined : profile.id} />
        <ProfileBio bio={profile.bio?.trim()} loading={loading} />
        <MaestroHowto profile={profile} />
        <ProfileLinks links={profile.links} />

        {children}
      </div>
    </div>
  )
}

export default ProfileCardBody
