/** Clique direito no botão abre o mesmo menu da setinha, ancorado no botão. */
export function openOnContextMenu(
  onMenu: (anchor: HTMLElement) => void
): (e: { preventDefault: () => void; currentTarget: HTMLElement }) => void {
  return (e) => {
    e.preventDefault()
    onMenu(e.currentTarget)
  }
}
