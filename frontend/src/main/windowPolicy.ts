// Regras do modo segundo plano (estilo Discord). Puras para poder testar.

/** No Windows, fechar a janela esconde na bandeja — a não ser no "Sair". */
export function shouldHideOnClose(platform: NodeJS.Platform, quitting: boolean): boolean {
  return platform === 'win32' && !quitting
}

/** Aberto pelo "Iniciar com o Windows": começa escondido na bandeja. */
export function launchedHidden(argv: string[]): boolean {
  return argv.includes('--hidden')
}

/** Notificação nativa só faz sentido se o usuário não está olhando a janela. */
export function shouldNotify(window: { visible: boolean; focused: boolean }): boolean {
  return !window.visible || !window.focused
}
