// Quem assiste a live de quem usa o overlay: o olho no canto da lista e o olho
// ao lado de cada espectador. Puro (o overlay não tem WS próprio: o estado vem
// do renderer principal, que já recebe `call:screen_watchers`).

export interface MyLiveInput {
  /** Estou transmitindo a tela agora. */
  live: boolean
  /** Preferência "Mostrar quem assiste a minha live". */
  show: boolean
  meId: string
  /** `screenWatchers[meId]` do callStore. */
  watchers: ReadonlyArray<{ id: string }>
}

export interface MyLiveWatchers {
  /** Quantos assistem; null = não mostra nada (sem live ou opção desligada). */
  viewers: number | null
  /** Ids de quem assiste (cada um ganha um olho na lista). */
  ids: string[]
}

export function myLiveWatchers(input: MyLiveInput): MyLiveWatchers {
  if (!input.live || !input.show) return { viewers: null, ids: [] }
  const ids = Array.from(new Set(input.watchers.map((w) => w.id))).filter((id) => id !== input.meId)
  return { viewers: ids.length, ids }
}
