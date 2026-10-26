import { charCount, MAX_DISPLAY_NAME } from '../../profile/lib/profileValidation'
import { nameCharsError } from '../../profile/lib/nameChars'

// Nome das pessoas dentro de um servidor. O apelido (server_members.nickname)
// só vale naquele servidor: em DM, amigos e grupos continua o nome de
// exibição. Todo lugar que mostra o nome de alguém num servidor passa por aqui.

/** Mesmo limite do nome de exibição (backend: server.MaxNickname). */
export const MAX_NICKNAME = MAX_DISPLAY_NAME

interface NicknameSource {
  nickname?: string | null
}

interface NameSource {
  display_name?: string | null
  username?: string | null
}

const filled = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Nome de alguém num servidor: apelido, senão nome de exibição, senão o @.
 * `member` é a entrada da pessoa no servidor (sem ela, fora de servidor ou
 * sem apelido, vale o nome de sempre).
 */
export function serverDisplayName(
  member: NicknameSource | null | undefined,
  user: NameSource | null | undefined,
  fallback = 'Usuário'
): string {
  return (
    filled(member?.nickname) ?? filled(user?.display_name) ?? filled(user?.username) ?? fallback
  )
}

/** userId -> apelido de quem tem apelido (a lista de membros do servidor). */
export function nicknameMap(
  members: { user_id: string; nickname?: string | null }[]
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const m of members) {
    const nick = filled(m.nickname)
    if (nick) map[m.user_id] = nick
  }
  return map
}

/** Mapa novo com o apelido trocado (nil/vazio tira); sem mudança, o mesmo mapa. */
export function withNickname(
  map: Record<string, string>,
  userId: string,
  nickname: string | null | undefined
): Record<string, string> {
  const nick = filled(nickname)
  if (map[userId] === nick) return map
  const next = { ...map }
  if (nick) next[userId] = nick
  else delete next[userId]
  return next
}

/**
 * Pessoas da call com o nome do servidor (apelido no lugar do display_name).
 * Sem mapa (call de DM) ou sem ninguém com apelido, devolve a mesma lista.
 */
export function withServerNames<T extends { id: string; username?: string; display_name: string }>(
  people: T[],
  nicknames: Record<string, string> | undefined
): T[] {
  if (!nicknames || !people.some((p) => nicknames[p.id])) return people
  return people.map((p) =>
    nicknames[p.id]
      ? // Apelido de servidor não leva o estilo do nome de exibição.
        { ...p, display_name: serverDisplayName({ nickname: nicknames[p.id] }, p), name_style: null }
      : p
  )
}

export type NicknameCheck = { ok: true; nickname: string | null } | { ok: false; error: string }

/**
 * As regras do backend (as do nome de exibição): sem espaços nas pontas, até
 * 32 caracteres, sem invisíveis, controle ou bidi (lib/nameChars); vazio tira.
 */
export function normalizeNickname(raw: string): NicknameCheck {
  const nickname = raw.trim()
  if (!nickname) return { ok: true, nickname: null }
  if (charCount(nickname) > MAX_NICKNAME) {
    return { ok: false, error: `O apelido pode ter até ${MAX_NICKNAME} caracteres.` }
  }
  if (nameCharsError(nickname)) {
    return { ok: false, error: 'O apelido não pode ter caracteres invisíveis ou de controle.' }
  }
  return { ok: true, nickname }
}

/** Servidor da rota aberta (/servers/:id/...), ou null fora de servidor. */
export function serverIdFromPath(pathname: string): string | null {
  const match = /^\/servers\/([^/]+)/.exec(pathname)
  return match ? decodeURIComponent(match[1]) : null
}
