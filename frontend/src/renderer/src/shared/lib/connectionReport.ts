// Texto do "Detalhes" do aviso de conexão: o que o usuário copia e manda para
// quem cuida do servidor. Puro: o main manda o teste de rede (ver
// main/server) e quem chama passa o resto.
import type { ServerDiagnostics, ServerProbe } from '../../../../shared/serverConnection'

export interface ReportContext {
  /** Endereço do WebSocket do chat (sem o token). */
  wsUrl: string
  online: boolean
  now: Date
}

/** Erros do Chromium mais comuns e o que costumam querer dizer. */
const HINTS: [RegExp, string][] = [
  [/NAME_NOT_RESOLVED|NAME_RESOLUTION/, 'o nome do servidor não foi encontrado (DNS, antivírus ou filtro da rede)'],
  [/CERT|SSL/, 'certificado recusado (relógio do PC errado ou antivírus inspecionando HTTPS)'],
  [/PROXY|TUNNEL/, 'falha no proxy configurado no sistema'],
  [/INTERNET_DISCONNECTED|NETWORK_CHANGED/, 'sem internet no momento do teste'],
  [/TIMED_OUT|sem resposta/, 'sem resposta (firewall, antivírus ou rede)'],
  [/REFUSED|RESET|CLOSED|ABORTED|BLOCKED/, 'conexão recusada ou cortada (firewall, antivírus ou rede)']
]

export function probeHint(detail: string): string | null {
  return HINTS.find(([pattern]) => pattern.test(detail))?.[1] ?? null
}

function probeLine(probe: ServerProbe): string {
  const host = new URL(probe.url).host
  if (probe.ok) return `- ${host}: ok (${probe.detail}, ${probe.ms} ms)`
  const hint = probeHint(probe.detail)
  return `- ${host}: falhou (${probe.detail}, ${probe.ms} ms)${hint ? ` — ${hint}` : ''}`
}

function appLines(diag: ServerDiagnostics | null): string[] {
  if (!diag) return []
  const alt = diag.server !== diag.primary ? ' (alternativo)' : ''
  return [`Salinha ${diag.version}`, `Servidor: ${diag.server}${alt}`]
}

export function connectionReport(diag: ServerDiagnostics | null, ctx: ReportContext): string[] {
  const probes = diag?.probes ?? []
  return [
    ...appLines(diag),
    `Chat: ${ctx.wsUrl}`,
    `Internet do sistema: ${ctx.online ? 'ligada' : 'desligada'}`,
    `Horário do PC: ${ctx.now.toISOString()}`,
    ...(probes.length > 0 ? ['Teste de rede:', ...probes.map(probeLine)] : [])
  ]
}

/** Texto do painel: espera o primeiro teste; depois, o relatório (atualiza ao testar de novo). */
export function detailsText(
  diag: ServerDiagnostics | null,
  testing: boolean,
  ctx: ReportContext
): string {
  if (testing && !diag) return 'Testando a conexão…'
  return connectionReport(diag, ctx).join('\n')
}
