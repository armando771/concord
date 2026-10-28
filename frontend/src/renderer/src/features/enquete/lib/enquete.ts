import { VOTE_NAME } from '../../levels/lib/badges'
import type { Enquete, EnqueteOpcao } from '../api/enquete'

/** Pergunta (escolher a opção) e confirmação ("não dá para mudar depois"). */
export type Etapa = 'pergunta' | 'confirmacao'

/** O que mostrar depois de responder: celebração do badge ou aviso neutro. */
export type Reacao = { tipo: 'celebracao'; badge: string; rotulo: string } | { tipo: 'neutra' }

export type Fase = 'oculto' | Etapa | Reacao['tipo']

export interface EntradaFase {
  pendentes: Enquete[]
  etapa: Etapa
  reacao: Reacao | null
}

/** Quanto cada reação fica na tela se ninguém fechar. */
export const CELEBRACAO_MS = 6_000
export const NEUTRA_MS = 4_500

/** A reação ao responder vem primeiro; depois, a próxima pendente, se houver. */
export function faseAtual({ pendentes, etapa, reacao }: EntradaFase): Fase {
  if (reacao) return reacao.tipo
  return pendentes.length > 0 ? etapa : 'oculto'
}

/** Os badges de enquete são todos Épicos (internal/badge/catalog_base.go). */
export const RARIDADE_BADGE = 'epico'

/** A celebração diz o nome do badge ("Votou Nulo"), não o rótulo curto da opção ("Nulo"). */
export function reacaoDe(opcao: EnqueteOpcao): Reacao {
  return opcao.badge
    ? { tipo: 'celebracao', badge: opcao.badge, rotulo: VOTE_NAME[opcao.badge] ?? opcao.rotulo }
    : { tipo: 'neutra' }
}

export function achaOpcao(enquete: Enquete | undefined, id: string): EnqueteOpcao | undefined {
  return enquete?.opcoes.find((o) => o.id === id)
}
