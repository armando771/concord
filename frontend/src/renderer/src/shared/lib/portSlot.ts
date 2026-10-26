// Guarda a porta do som da janela até o compartilhamento pegá-la. A porta vem
// por um canal (IPC) e o vídeo por outro (getDisplayMedia), sem ordem
// garantida — por isso dá para esperar um pouco.

export class PortSlot {
  private port: MessagePort | null = null
  private waiter: ((port: MessagePort) => void) | null = null

  offer(port: MessagePort): void {
    if (this.waiter) {
      const resolve = this.waiter
      this.waiter = null
      resolve(port)
      return
    }
    this.port?.close()
    this.port = port
  }

  /** A porta (já recebida ou que chegue em até `waitMs`), ou null. */
  take(waitMs: number): Promise<MessagePort | null> {
    const ready = this.port
    this.port = null
    if (ready || waitMs <= 0) return Promise.resolve(ready)
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiter = null
        resolve(null)
      }, waitMs)
      this.waiter = (port) => {
        clearTimeout(timer)
        resolve(port)
      }
    })
  }

  discard(): void {
    this.port?.close()
    this.port = null
  }
}
