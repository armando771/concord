import { serverDisplayName } from './serverNames'

// Quem reagiu a uma mensagem/comentário: as reações trazem só os IDs, então os
// nomes e avatares saem das fontes que o app já tem carregadas. Ids sem fonte
// nenhuma voltam em `missing` para o tooltip buscar o perfil sob demanda.

interface PersonFields {
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
}

export interface ReactionPerson {
  id: string
  name: string
  username?: string
  avatarUrl: string | null
}

export interface ReactionPersonSource extends PersonFields {
  id: string
}

export interface ReactionMemberSource extends PersonFields {
  user_id: string
}

export interface ReactionPeopleSources {
  /** Perfis públicos já vistos (nome/avatar mais novos, via user:update). */
  profiles?: Record<string, PersonFields>
  /** Membros do servidor aberto (para apelido e avatar). */
  members?: ReactionMemberSource[]
  /** Apelidos do servidor aberto (userId -> apelido). */
  nicknames?: Record<string, string>
  friends?: ReactionPersonSource[]
  /** Participantes das DMs/grupos já listados. */
  conversationMembers?: ReactionPersonSource[]
  me?: ReactionPersonSource | null
}

export interface ResolvedReactionPeople {
  people: ReactionPerson[]
  /** IDs sem fonte conhecida: valem um GET /users/:id/profile ao abrir. */
  missing: string[]
}

const filled = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Resolve os IDs de uma reação em pessoas, na ordem em que reagiram.
 * Prioridade: perfil público → membro do servidor → você → amigos →
 * participantes de conversas. Sem nenhuma fonte, o nome fica "Usuário" e o
 * id entra em `missing`.
 */
export function resolveReactionPeople(
  userIds: string[],
  {
    profiles = {},
    members = [],
    nicknames = {},
    friends = [],
    conversationMembers = [],
    me = null
  }: ReactionPeopleSources = {}
): ResolvedReactionPeople {
  const memberById = new Map(members.map((member) => [member.user_id, member]))
  const friendById = new Map(friends.map((friend) => [friend.id, friend]))
  const conversationById = new Map(conversationMembers.map((member) => [member.id, member]))

  const people: ReactionPerson[] = []
  const missing: string[] = []

  for (const id of new Set(userIds)) {
    const profile = profiles[id]
    const member = memberById.get(id)
    const friend = friendById.get(id)
    const conversation = conversationById.get(id)
    const self = me?.id === id ? me : undefined

    if (!profile && !member && !friend && !conversation && !self) {
      missing.push(id)
    }

    const displayName =
      filled(profile?.display_name) ??
      filled(member?.display_name) ??
      filled(self?.display_name) ??
      filled(friend?.display_name) ??
      filled(conversation?.display_name)
    const username =
      filled(profile?.username) ??
      filled(member?.username) ??
      filled(self?.username) ??
      filled(friend?.username) ??
      filled(conversation?.username)

    people.push({
      id,
      name: serverDisplayName({ nickname: nicknames[id] }, { display_name: displayName, username }),
      username,
      // O perfil é a fonte mais nova: se ele diz que não há avatar, não cai
      // para um avatar antigo de membro/amigo.
      avatarUrl: profile
        ? (profile.avatar_url ?? null)
        : (member?.avatar_url ??
          self?.avatar_url ??
          friend?.avatar_url ??
          conversation?.avatar_url ??
          null)
    })
  }

  return { people, missing }
}
