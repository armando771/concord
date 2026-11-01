import type { Message } from '../api/messages'
import { compareTimestamps } from './messageOrder'
import { isNearBottom, distanceFromBottom, type ScrollMetrics } from './stickToBottom'

/**
 * Botão "voltar às mensagens recentes": quando ele aparece, quantas mensagens
 * novas chegaram enquanto a pessoa estava rolada para cima e como rolar de
 * volta. Só contas; o scroll em si fica no hook useJumpToPresent.
 */

const MIN_THRESHOLD_PX = 300
const MAX_THRESHOLD_PX = 600

/**
 * Distância a partir da qual o botão aparece: uma tela da lista (rolou uma
 * tela inteira para cima, o fim já saiu de vista), limitada entre 300 e 600 px
 * para não aparecer cedo demais no celular nem tarde demais num monitor alto.
 */
export function jumpThreshold(clientHeight: number): number {
  return Math.min(MAX_THRESHOLD_PX, Math.max(MIN_THRESHOLD_PX, clientHeight))
}

export function isFarFromBottom(m: ScrollMetrics): boolean {
  return distanceFromBottom(m) > jumpThreshold(m.clientHeight)
}

/**
 * "Longe" depois de um evento de scroll. Só acende rolando para cima: se o
 * scrollTop aumentou e ainda não estava longe, quem afastou o fim foi o
 * conteúdo (mensagem alta chegando e a lista descendo sozinha), não a pessoa.
 */
export function nextFar(prevFar: boolean, m: ScrollMetrics, prevScrollTop: number): boolean {
  if (!isFarFromBottom(m)) return false
  return prevFar || m.scrollTop < prevScrollTop
}

/**
 * Marca do ponto em que a pessoa saiu do fim: o created_at da última mensagem
 * naquele momento. null: está no fim (ou não há mensagens). Uma vez fora, a
 * marca não anda, para o que chegar depois contar como novo.
 */
export function nextLeftAt(
  prev: string | null,
  near: boolean,
  latestCreatedAt: string | null
): string | null {
  if (near) return null
  return prev ?? latestCreatedAt
}

/**
 * Mensagens de outras pessoas depois da marca. Vale o created_at, não a
 * posição: página antiga entrando em cima ou mensagem apagada não mexe na conta.
 */
export function countNewSince(
  messages: ReadonlyArray<Pick<Message, 'created_at' | 'author_id'>>,
  leftAt: string | null,
  selfId: string | undefined
): number {
  if (leftAt === null) return 0
  let count = 0
  // A lista é ordenada: de trás para frente, para na primeira que já era velha.
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (compareTimestamps(m.created_at, leftAt) <= 0) break
    if (m.author_id !== selfId) count++
  }
  return count
}

export interface JumpState {
  /** Passou do limiar: o botão aparece mesmo sem novas. */
  far: boolean
  /** Marca de saída do fim (ver nextLeftAt). */
  leftAt: string | null
}

export const JUMP_INITIAL: JumpState = { far: false, leftAt: null }

/** Estado depois de um evento de scroll; o mesmo objeto se nada mudou. */
export function advanceJump(
  prev: JumpState,
  m: ScrollMetrics,
  prevScrollTop: number,
  latestCreatedAt: string | null
): JumpState {
  const far = nextFar(prev.far, m, prevScrollTop)
  const leftAt = nextLeftAt(prev.leftAt, isNearBottom(m), latestCreatedAt)
  return far === prev.far && leftAt === prev.leftAt ? prev : { far, leftAt }
}

/** Estado do botão guardado junto da sala a que ele pertence. */
export interface RoomJump {
  room: string
  jump: JumpState
}

/** Estado da sala atual; o guardado de outra sala não vale. */
export function jumpOf(state: RoomJump, room: string): JumpState {
  return state.room === room ? state.jump : JUMP_INITIAL
}

/** advanceJump por sala: trocar de sala zera o que veio da anterior. */
export function advanceRoomJump(
  prev: RoomJump,
  room: string,
  m: ScrollMetrics,
  prevScrollTop: number,
  latestCreatedAt: string | null
): RoomJump {
  const current = jumpOf(prev, room)
  const next = advanceJump(current, m, prevScrollTop, latestCreatedAt)
  return next === current && prev.room === room ? prev : { room, jump: next }
}

/** Longe do fim, ou com mensagem nova esperando embaixo (mesmo perto do limiar). */
export function showJump(far: boolean, newCount: number): boolean {
  return far || newCount > 0
}

const MAX_BADGE = 99

/** Selo do botão: vazio sem novas, o número, ou 99+. */
export function newCountText(count: number): string {
  if (count <= 0) return ''
  return count > MAX_BADGE ? `${MAX_BADGE}+` : String(count)
}

/** Nome acessível do botão (e o que o leitor de tela anuncia). */
export function jumpLabel(count: number): string {
  const base = 'Voltar às mensagens recentes'
  if (count <= 0) return base
  if (count > MAX_BADGE) return `${base}, mais de ${MAX_BADGE} novas`
  return `${base}, ${count} ${count === 1 ? 'nova' : 'novas'}`
}

/** Rolagem do clique: suave, ou direta com prefers-reduced-motion. */
export function jumpScrollBehavior(reducedMotion: boolean): ScrollBehavior {
  return reducedMotion ? 'auto' : 'smooth'
}
