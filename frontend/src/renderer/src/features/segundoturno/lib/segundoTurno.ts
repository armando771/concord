import type { SegundoTurnoEstado } from '../api/segundoTurno'

/** O que a pessoa acabou de responder: decide a reação na tela. */
export type Reacao = 'sim' | 'nao'

/** O que mostrar: nada, o banner, o botão da barra ou uma das reações. */
export type Fase = 'oculto' | 'banner' | 'botao' | 'celebracao' | 'triste'

export interface EntradaFase {
  estado: SegundoTurnoEstado | null
  /** Fechou o banner sem responder: fica o botão na barra. */
  dispensado: boolean
  reacao: Reacao | null
}

/** Quanto cada reação fica na tela se ninguém fechar. */
export const CELEBRACAO_MS = 6_000
export const TRISTE_MS = 4_500

/**
 * A reação ao responder vem primeiro (o estado já está como respondido);
 * depois, só quem pode responder e ainda não respondeu vê algo.
 */
export function faseAtual({ estado, dispensado, reacao }: EntradaFase): Fase {
  if (reacao) return reacao === 'sim' ? 'celebracao' : 'triste'
  if (!estado?.elegivel || estado.respondeu) return 'oculto'
  return dispensado ? 'botao' : 'banner'
}

type Armazenamento = Pick<Storage, 'getItem' | 'setItem'>

export function chaveDispensa(userId: string): string {
  return `salinha.segundoTurno.dispensado.${userId}`
}

/** localStorage pode faltar ou lançar (janela privada, dados bloqueados). */
function armazenamentoPadrao(): Armazenamento | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function lerDispensa(userId: string, storage = armazenamentoPadrao()): boolean {
  try {
    return storage?.getItem(chaveDispensa(userId)) === '1'
  } catch {
    return false
  }
}

export function gravarDispensa(userId: string, storage = armazenamentoPadrao()): void {
  try {
    storage?.setItem(chaveDispensa(userId), '1')
  } catch {
    // Sem storage a dispensa vale só até fechar o app.
  }
}
