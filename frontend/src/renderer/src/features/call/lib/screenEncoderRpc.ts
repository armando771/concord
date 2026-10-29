import { parseEncoderInfo, type ScreenEncoderInfo } from './screenEncoderInfo'

// O codificador de quem transmite vai para quem assiste por RPC do LiveKit
// (dados entre participantes, sem backend novo): quem assiste só pergunta com
// o painel "Recebendo" aberto, no máximo a cada REFRESH_MS. Atributos do
// participante exigiriam liberar canUpdateOwnMetadata no token (nome e
// metadados editáveis pelo cliente). Ver docs/adr/0020.

export const SCREEN_ENCODER_RPC = 'salinha.screen-encoder'

const REFRESH_MS = 5000
const TIMEOUT_MS = 3000

interface RpcServer {
  registerRpcMethod(method: string, handler: () => Promise<string>): void
  unregisterRpcMethod(method: string): void
}

interface RpcClient {
  localParticipant: {
    performRpc(params: {
      destinationIdentity: string
      method: string
      payload: string
      responseTimeout?: number
    }): Promise<string>
  }
}

/** Quem transmite: responde o próprio codificador (null = sem live). Devolve o "desligar". */
export function serveScreenEncoder(
  room: RpcServer,
  read: () => Promise<ScreenEncoderInfo | null>
): () => void {
  room.registerRpcMethod(SCREEN_ENCODER_RPC, async () => JSON.stringify(await read()))
  return () => room.unregisterRpcMethod(SCREEN_ENCODER_RPC)
}

interface Entry {
  at: number
  info: ScreenEncoderInfo | null
  pending: boolean
}

/** Quem assiste: o último codificador conhecido de cada pessoa, renovado em segundo plano. */
export class RemoteEncoders {
  private entries = new Map<string, Entry>()

  constructor(
    private readonly room: RpcClient,
    private readonly now: () => number = Date.now
  ) {}

  get(userId: string): ScreenEncoderInfo | null {
    const entry = this.entries.get(userId)
    if (!entry || (!entry.pending && this.now() - entry.at >= REFRESH_MS)) this.ask(userId, entry)
    return entry?.info ?? null
  }

  private ask(userId: string, previous: Entry | undefined): void {
    const entry: Entry = { at: this.now(), info: previous?.info ?? null, pending: true }
    this.entries.set(userId, entry)
    this.room.localParticipant
      .performRpc({
        destinationIdentity: userId,
        method: SCREEN_ENCODER_RPC,
        payload: '',
        responseTimeout: TIMEOUT_MS
      })
      .then(parseEncoderInfo, () => null)
      .then((info) => {
        entry.info = info
        entry.pending = false
        entry.at = this.now()
      })
  }
}
