import { win32 } from 'path'

// Regras do modo segundo plano (estilo Discord). Puras para poder testar.

/**
 * Fechar a janela esconde na bandeja? No Windows, sempre (menos no "Sair").
 * No Linux só com a bandeja funcionando (um host StatusNotifier no D-Bus) e a
 * opção "Minimizar para a bandeja ao fechar" ligada: sem bandeja o ícone não
 * aparece e a Salinha ficaria invisível, sem como reabrir. Em dúvida, fecha.
 */
export function shouldHideOnClose(
  platform: NodeJS.Platform,
  quitting: boolean,
  tray: { trayWorks: boolean; enabled: boolean } = { trayWorks: false, enabled: true }
): boolean {
  if (quitting) return false
  if (platform === 'win32') return true
  return platform === 'linux' && tray.trayWorks && tray.enabled
}

/** "Minimizar para a bandeja ao fechar": ligada, a não ser que a pessoa desligue. */
export function closeToTrayEnabled(pref: unknown): boolean {
  return pref !== false
}

/**
 * Resposta do D-Bus (dbus-send, gdbus ou busctl) para a propriedade
 * IsStatusNotifierHostRegistered do org.kde.StatusNotifierWatcher: há alguém
 * (Waybar, KDE, extensão do GNOME…) desenhando os ícones da bandeja?
 */
export function trayHostRegistered(output: string): boolean {
  return /\btrue\b/.test(output)
}

/** Dica do ícone da bandeja: em chamada e/ou mensagens não lidas. */
export function trayTooltip(inCall: boolean, unseen: number): string {
  const parts: string[] = []
  if (inCall) parts.push('em chamada')
  if (unseen > 0) {
    const count = unseen > 99 ? '99+' : String(unseen)
    parts.push(`${count} ${unseen === 1 ? 'não lida' : 'não lidas'}`)
  }
  return parts.length ? `Salinha — ${parts.join(' · ')}` : 'Salinha'
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

/**
 * Fundo e ícones da barra no tema padrão (Discord Escuro: --bg-app e
 * --interactive-normal de assets/theme.css). Trocando o tema, o renderer manda
 * as cores novas (ver parseTitleBarColors).
 */
export const TITLE_BAR_COLOR = '#121214'
export const TITLE_BAR_SYMBOL_COLOR = '#96979e'

const HEX6 = /^#[0-9a-f]{6}$/i

/** Cores da barra vindas do renderer → só hex opaco de 6 dígitos; o resto, null. */
export function parseTitleBarColors(raw: unknown): { color: string; symbolColor: string } | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { color, symbolColor } = raw as Record<string, unknown>
  if (typeof color !== 'string' || typeof symbolColor !== 'string') return null
  if (!HEX6.test(color) || !HEX6.test(symbolColor)) return null
  return { color: color.toLowerCase(), symbolColor: symbolColor.toLowerCase() }
}

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
    titleBarOverlay: {
      color: TITLE_BAR_COLOR,
      symbolColor: TITLE_BAR_SYMBOL_COLOR,
      height: TITLE_BAR_HEIGHT
    }
  }
}
