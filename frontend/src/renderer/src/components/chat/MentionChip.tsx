import { memo } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useServerStore } from '../../store/serverStore'
import { useChatStore } from '../../store/chatStore'
import { useFriendStore } from '../../store/friendStore'
import { useProfileStore } from '../../store/profileStore'
import { useProfileCardStore } from '../../store/profileCardStore'
import { useUserMenuStore } from '../../store/userMenuStore'
import { searchUsers } from '../../api/users'
import { serverDisplayName } from '../../lib/serverNames'

export interface ResolvedMentionUser {
  userId: string
  name: string
  username: string
}

const EVERYONE_TAGS = new Set(['all', 'here', 'everyone'])

export function isEveryoneMention(mention: string | undefined): boolean {
  if (!mention) return false
  return EVERYONE_TAGS.has(mention.toLowerCase())
}

/**
 * Procura os dados do usuário a partir do username (sem o @).
 * Consulta primeiramente os stores síncronos locais:
 * 1. Membros do servidor atual (com apelido/cargos se houver)
 * 2. Próprio usuário logado
 * 3. Autores das mensagens carregadas no chat
 * 4. Lista de amigos
 * 5. Perfis já cacheados
 */
export function findMentionUserSync(username: string): ResolvedMentionUser | null {
  if (!username || isEveryoneMention(username)) return null
  const lower = username.toLowerCase()

  // 1. Membro do servidor atual
  const currentMembers = useServerStore.getState().currentMembers
  const member = currentMembers.find((m) => m.username?.toLowerCase() === lower)
  if (member) {
    return {
      userId: member.user_id,
      name: serverDisplayName({ nickname: member.nickname }, member),
      username: member.username || username
    }
  }

  // 2. Próprio usuário logado
  const me = useAuthStore.getState().user
  if (me && me.username?.toLowerCase() === lower) {
    return {
      userId: me.id,
      name: me.display_name || me.username,
      username: me.username
    }
  }

  // 3. Autores das mensagens da sala ativa
  const activeRoom = useChatStore.getState().activeRoom
  const messages = activeRoom ? useChatStore.getState().messagesByRoom[activeRoom] ?? [] : []
  for (const msg of messages) {
    if (msg.author && msg.author.username?.toLowerCase() === lower) {
      return {
        userId: msg.author.id,
        name: msg.author.display_name || msg.author.username,
        username: msg.author.username
      }
    }
  }

  // 4. Lista de amigos
  const friends = useFriendStore.getState().friends
  const friend = friends.find((f) => f.username?.toLowerCase() === lower)
  if (friend) {
    return {
      userId: friend.id,
      name: friend.display_name || friend.username,
      username: friend.username
    }
  }

  // 5. Perfis já cacheados
  const profiles = useProfileStore.getState().profiles
  for (const p of Object.values(profiles)) {
    if (p && p.username?.toLowerCase() === lower) {
      return {
        userId: p.id,
        name: p.display_name || p.username,
        username: p.username
      }
    }
  }

  return null
}

/**
 * Resolve o usuário de forma síncrona ou buscando na API se ainda não foi carregado.
 */
export async function resolveMentionUser(username: string): Promise<ResolvedMentionUser | null> {
  const sync = findMentionUserSync(username)
  if (sync) return sync

  try {
    const results = await searchUsers(username)
    const match = results.find((u) => u.username?.toLowerCase() === username.toLowerCase())
    if (match) {
      return {
        userId: match.id,
        name: match.display_name || match.username,
        username: match.username
      }
    }
  } catch {
    // Ignora falha de rede
  }

  return null
}

/**
 * Abre o banner do perfil do usuário mencionado ao clicar na menção.
 */
export async function openMentionProfile(
  mention: string,
  targetEl: HTMLElement,
  fallbackName?: string
): Promise<void> {
  if (isEveryoneMention(mention)) return

  const user = await resolveMentionUser(mention)
  if (!user) return

  const current = useProfileCardStore.getState().target
  // Se o cartão dessa pessoa já estiver aberto, alternar (fechar)
  if (current?.userId === user.userId) {
    useProfileCardStore.getState().close()
    return
  }

  const r = targetEl.getBoundingClientRect()
  useProfileCardStore.getState().open({
    userId: user.userId,
    name: user.name || fallbackName || mention,
    username: user.username,
    side: 'right',
    anchor: { top: r.top, left: r.left, right: r.right, bottom: r.bottom },
    anchorEl: targetEl
  })
}

function MentionChip({
  mention,
  displayText
}: {
  mention: string
  displayText: string
}): React.JSX.Element {
  const isEveryone = isEveryoneMention(mention)

  if (isEveryone) {
    return (
      <span className="rounded bg-brand/30 px-0.5 font-medium text-brand">
        {displayText}
      </span>
    )
  }

  const handleClick = (e: React.MouseEvent<HTMLSpanElement>): void => {
    // Se o usuário estava selecionando texto, não dispara o clique de abrir perfil
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && selection.toString().trim()) {
      return
    }
    e.stopPropagation()
    void openMentionProfile(mention, e.currentTarget, displayText.replace(/^@/, ''))
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLSpanElement>): void => {
    const user = findMentionUserSync(mention)
    if (!user) return
    e.preventDefault()
    e.stopPropagation()
    useUserMenuStore.getState().open({
      userId: user.userId,
      name: user.name,
      username: user.username,
      x: e.clientX,
      y: e.clientY
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      void openMentionProfile(mention, e.currentTarget, displayText.replace(/^@/, ''))
    }
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      title={`Ver perfil de ${displayText}`}
      className="cursor-pointer rounded bg-brand/30 px-0.5 font-medium text-brand transition-colors hover:bg-brand hover:text-white"
    >
      {displayText}
    </span>
  )
}

export default memo(MentionChip)
