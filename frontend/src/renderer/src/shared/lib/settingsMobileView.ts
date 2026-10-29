// Configurações no celular: lista de seções → detalhe da seção (com voltar),
// como no Discord mobile. No desktop as duas colunas aparecem sempre.

export type SettingsMobileState = { view: 'list' | 'detail'; key: string | undefined }

export type SettingsMobileEvent =
  /** A seção atual (prop da tela) mudou ou foi lida de novo no render. */
  | { type: 'section'; key: string | undefined }
  /** Tocou na seção que já estava marcada na lista. */
  | { type: 'pickCurrent' }
  | { type: 'back' }

export function settingsMobileStart(key: string | undefined): SettingsMobileState {
  return { view: 'list', key }
}

export function settingsMobileView(
  state: SettingsMobileState,
  event: SettingsMobileEvent
): SettingsMobileState {
  switch (event.type) {
    case 'section':
      return event.key === state.key ? state : { view: 'detail', key: event.key }
    case 'pickCurrent':
      return { ...state, view: 'detail' }
    case 'back':
      return { ...state, view: 'list' }
  }
}

/** Classes das duas colunas: abaixo do md só uma aparece (a lista ou a seção). */
export function settingsShellClasses(view: SettingsMobileState['view']): {
  nav: string
  main: string
} {
  return view === 'detail'
    ? { nav: 'max-md:hidden', main: '' }
    : { nav: 'max-md:min-h-0 max-md:flex-1', main: 'max-md:hidden' }
}

/** O toque na lista foi na seção que já está marcada (aria-current)? */
export function tappedCurrentSection(target: EventTarget | null): boolean {
  return Boolean((target as Element | null)?.closest?.('[aria-current="page"]'))
}
