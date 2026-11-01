// Endereço do servidor escolhido pelo main ao abrir o app (ver
// main/server/serverChoice.ts) e o que o aviso de conexão mostra em
// "Detalhes". Usado pelo main, pelo preload e pelo renderer.

export interface ServerProbe {
  url: string
  /** A rede chegou ao servidor (qualquer resposta HTTP). */
  ok: boolean
  /** "HTTP 200", a mensagem do erro de rede ou "sem resposta em N s". */
  detail: string
  ms: number
}

export interface ServerDiagnostics {
  /** Versão do app instalado. */
  version: string
  /** Endereço em uso nesta abertura. */
  server: string
  /** Endereço principal do build (o servidor em uso pode ser um alternativo). */
  primary: string
  probes: ServerProbe[]
}

const SERVER_ARG = '--salinha-server='

/** Argumento da janela principal com o endereço escolhido (additionalArguments). */
export function serverArgs(url: string | undefined): string[] {
  return url ? [`${SERVER_ARG}${url}`] : []
}

function httpOrigin(raw: string): string | null {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
  } catch {
    return null
  }
}

/** Endereço escolhido pelo main, lido no preload; null = usa o do build. */
export function serverFromArgv(argv: readonly string[]): string | null {
  const raw = argv.find((a) => a.startsWith(SERVER_ARG))?.slice(SERVER_ARG.length)
  return raw ? httpOrigin(raw) : null
}
