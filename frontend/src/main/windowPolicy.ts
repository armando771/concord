import { win32 } from 'path'

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
