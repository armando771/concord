/** O que o registro precisa do aparelho. A implementação real (expo-notifications) fica em expoPush.ts. */
export interface PushPlatform {
  ensureChannel(): Promise<void>
  requestPermission(): Promise<boolean>
  /** Token nativo do FCM; null quando o app foi montado sem Firebase (google-services.json). */
  getToken(): Promise<string | null>
  onTokenChange(cb: (token: string) => void): () => void
}

export interface PushApi {
  register(token: string): Promise<void>
  unregister(token: string): Promise<void>
}

/** Registra o aparelho no servidor depois do login. Qualquer falha é silenciosa: push é um extra. */
export function createPushRegistration(platform: PushPlatform, api: PushApi) {
  let current: string | null = null
  let stopListening: (() => void) | null = null

  async function send(token: string): Promise<void> {
    try {
      await api.register(token)
      current = token
    } catch {
      // sem rede agora: o próximo login ou a renovação do token tenta de novo
    }
  }

  async function start(): Promise<void> {
    try {
      await platform.ensureChannel()
      if (!(await platform.requestPermission())) return
      const token = await platform.getToken()
      if (!token) return
      stopListening = platform.onTokenChange((t) => void send(t))
      await send(token)
    } catch {
      // Firebase ausente ou permissão indisponível: segue sem push
    }
  }

  function stop(): void {
    stopListening?.()
    stopListening = null
  }

  /** No logout, ainda com a sessão válida: o aparelho deixa de receber push desta conta. */
  async function forget(): Promise<void> {
    stop()
    const token = current
    current = null
    if (token) await api.unregister(token).catch(() => {})
  }

  return { start, stop, forget }
}
