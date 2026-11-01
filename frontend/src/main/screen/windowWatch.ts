// Janela minimizada some da lista de janelas e o Windows para de gerar imagem
// dela: quem assiste vê a live congelar. Avisa quem compartilha, uma vez por
// minimização.

export class WindowWatch {
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly listWindowIds: () => Promise<string[]>,
    private readonly onHidden: () => void,
    private readonly intervalMs = 2000
  ) {}

  watch(sourceId: string): void {
    this.stop()
    let hidden = false
    this.timer = setInterval(async () => {
      try {
        const missing = !(await this.listWindowIds()).includes(sourceId)
        if (missing && !hidden) this.onHidden()
        hidden = missing
      } catch {
        /* próxima volta tenta de novo */
      }
    }, this.intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
