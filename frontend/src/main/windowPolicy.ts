import { win32 } from 'path'

// Regras do modo segundo plano (estilo Discord). Puras para poder testar.

/** No Windows, fechar a janela esconde na bandeja — a não ser no "Sair". */
export function shouldHideOnClose(platform: NodeJS.Platform, quitting: boolean): boolean {
  return platform === 'win32' && !quitting
}

/**
 * Args do atalho de login do "Iniciar com o Windows" (abre escondido). No
 * Windows o openAtLogin de getLoginItemSettings só bate se a leitura passar os
 * mesmos args da gravação: toda leitura e escrita usa esta lista.
 */
export const LOGIN_ITEM_ARGS = ['--hidden']

/** Aberto pelo "Iniciar com o Windows": começa escondido na bandeja. */
export function launchedHidden(argv: string[]): boolean {
  return LOGIN_ITEM_ARGS.every((arg) => argv.includes(arg))
}

/**
 * Um aviso pedido pelo renderer: o que mostrar dada a janela. Com a janela
 * fora de vista (escondida, minimizada ou sem foco), tudo. Com ela em foco,
 * só o toast e só se o renderer disse que a conversa não está na tela
 * (`elsewhere`: a pessoa está em outro chat); piscar e selo ficam de fora,
 * porque o selo só é limpo quando a janela ganha foco.
 */
export function notifyPlan(
  window: { visible: boolean; focused: boolean },
  request: { elsewhere?: boolean } = {}
): { toast: boolean; taskbar: boolean } {
  const away = !window.visible || !window.focused
  return { toast: away || request.elsewhere === true, taskbar: away }
}

/**
 * O app se chamava Concord: o atalho de login de quem já tinha "Iniciar com o
 * Windows" ligado aponta para o Concord.exe, que a atualização trocou pelo
 * Salinha.exe na mesma pasta. Acha esse atalho para regravá-lo no .exe atual.
 */
export function staleLoginItem<T extends { path: string }>(
  items: T[],
  execPath: string
): T | undefined {
  const dir = (p: string): string => win32.dirname(p).toLowerCase()
  const current = execPath.toLowerCase()
  return items.find(
    (item) => item.path.toLowerCase() !== current && dir(item.path) === dir(execPath)
  )
}

/** Altura da barra de título (a faixa de arrastar e os botões nativos). */
export const TITLE_BAR_HEIGHT = 32

/** Mesmo preto do fundo do app (body), para a barra não destoar. */
export const TITLE_BAR_COLOR = '#050508'

/**
 * No Windows (e Linux) a moldura nativa segue o tema do sistema e fica clara.
 * Escondemos a moldura e pintamos os botões nativos (minimizar, maximizar,
 * fechar) com a cor do app; o renderer desenha a faixa de arrastar. No macOS
 * a barra nativa já combina, então fica como está.
 */
export function titleBarOptions(platform: NodeJS.Platform): {
  titleBarStyle?: 'hidden'
  titleBarOverlay?: { color: string; symbolColor: string; height: number }
} {
  if (platform === 'darwin') return {}
  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: TITLE_BAR_COLOR, symbolColor: '#e5e7eb', height: TITLE_BAR_HEIGHT }
  }
}
