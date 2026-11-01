// Layout da tela do servidor, como no Discord: a barra do canal em cima e uma
// coluna à direita. Grade de 2 colunas (conteúdo | coluna da direita) e 2
// linhas (barra | resto). A coluna da direita mostra os membros, os resultados
// da busca ou o chat da call.

export type RightColumn = 'members' | 'search' | 'voiceChat'

/**
 * O que ocupa a coluna da direita. A busca aberta ganha (a pessoa acabou de
 * pedir); o chat da call só vira coluna em tela larga (na estreita ele é uma
 * sobreposição em tela cheia e a coluna continua a de membros).
 */
export function rightColumnFor(s: {
  searchOpen: boolean
  voiceChatOpen: boolean
  wide: boolean
}): RightColumn {
  if (s.searchOpen) return 'search'
  return s.voiceChatOpen && s.wide ? 'voiceChat' : 'members'
}

export interface ServerLayoutClasses {
  /** A barra de cima (título e ações + busca). */
  header: string
  /** Onde fica a busca, no canto direito da barra. */
  search: string
  /** O canal: chat, chamada ou boas-vindas. */
  content: string
  /** A coluna da direita. */
  right: string
}

// A barra atravessa as duas colunas e herda a grade (subgrid): a busca cai
// em cima da coluna da direita, com a largura dela (inclusive no arrasto da
// alça). contain-inline-size: a busca não alarga a coluna, só a preenche; a
// caixa (largura fixa no MessageSearchBar) estica junto.
// relative: a busca do celular abre por cima da barra inteira (CollapsibleSearch).
const SPAN_HEADER = 'col-span-2 row-start-1 grid grid-cols-subgrid border-b border-subtle relative'
// Classes por extenso: o Tailwind só gera o que acha escrito literalmente.
const FILL_BOX = '[&_div:has(>input[role=combobox])]:w-full'
const LG_FILL_BOX = 'lg:[&_div:has(>input[role=combobox])]:w-full'
const CONTENT = 'row-start-2 flex min-h-0 min-w-0 flex-col overflow-hidden'

const LAYOUTS: Record<RightColumn, ServerLayoutClasses> = {
  // Os membros só aparecem do lg em diante; antes disso a busca fica no fim
  // da barra, do tamanho dela, e o conteúdo usa as duas colunas.
  members: {
    header: SPAN_HEADER,
    search: `grid min-w-0 items-center pr-4 lg:px-2 lg:contain-inline-size ${LG_FILL_BOX}`,
    content: `col-span-2 ${CONTENT} lg:col-span-1`,
    right: 'col-start-2 row-start-2 hidden min-h-0 lg:flex'
  },
  // Os resultados aparecem em qualquer largura: a busca fica em cima deles.
  // No celular eles tomam a tela (o canal volta ao fechar a busca).
  search: {
    header: SPAN_HEADER,
    search: `grid min-w-0 items-center px-2 contain-inline-size ${FILL_BOX}`,
    content: `col-start-1 ${CONTENT} max-md:hidden`,
    right: 'relative col-start-2 row-start-2 flex min-h-0 max-md:col-span-2 max-md:col-start-1'
  },
  // O chat da call vai de cima a baixo; a barra (com a busca no fim) fica só
  // sobre a chamada.
  voiceChat: {
    header: 'col-start-1 row-start-1 flex min-w-0 border-b border-subtle relative',
    search: 'grid shrink-0 items-center pr-4',
    content: `col-start-1 ${CONTENT}`,
    right: 'col-start-2 row-span-2 row-start-1 flex min-h-0'
  }
}

export function serverLayoutClasses(right: RightColumn): ServerLayoutClasses {
  return LAYOUTS[right]
}
