import { app, ipcMain, net } from 'electron'
import { appendLog } from '../app/appLog'
import type { ServerDiagnostics, ServerProbe } from '../../shared/serverConnection'
import { chooseServer, probeServer, type ServerChoice } from './serverChoice'

// Liga a escolha do servidor (serverChoice.ts) ao Electron: testa com o
// net.fetch (mesma rede, proxy, DNS e certificados do renderer), registra em
// %APPDATA%\Concord\logs\conexao.log e responde o "Detalhes" do aviso de
// conexão.

const LOG = 'conexao.log'

const probe = (url: string): Promise<ServerProbe> =>
  probeServer(url, (input, init) => net.fetch(input, init))

function logProbes(server: string, probes: ServerProbe[]): void {
  const lines = probes.map((p) => `${p.url}: ${p.ok ? 'ok' : 'falhou'} (${p.detail}, ${p.ms} ms)`)
  appendLog(LOG, `versão ${app.getVersion()}, usando ${server}; ${lines.join('; ')}`)
}

/** Começa a testar os endereços do build; null = build sem endereço (dev). */
export async function startServerChoice(candidates: string[]): Promise<ServerChoice | null> {
  if (candidates.length === 0) return null
  const choice = await chooseServer(candidates, probe)
  void choice.probes.then((probes) => logProbes(choice.url, probes))
  return choice
}

/** Testa todos de novo agora ("Testar de novo" nos detalhes). */
async function retestAll(server: string, candidates: string[]): Promise<ServerProbe[]> {
  const probes = await Promise.all(candidates.map(probe))
  logProbes(server, probes)
  return probes
}

async function readDiagnostics(
  choice: Promise<ServerChoice | null>,
  candidates: string[],
  retest: boolean
): Promise<ServerDiagnostics | null> {
  const chosen = await choice
  if (!chosen) return null
  const probes = retest ? await retestAll(chosen.url, candidates) : await chosen.probes
  return { version: app.getVersion(), server: chosen.url, primary: candidates[0], probes }
}

/**
 * "Detalhes" do aviso de conexão: versão, endereço em uso e o resultado dos
 * testes (os da abertura, ou novos com `retest`). null no dev.
 */
export function registerServerDiagnostics(
  choice: Promise<ServerChoice | null>,
  candidates: string[]
): void {
  ipcMain.handle('server:diagnostics', (_event, retest: unknown) =>
    readDiagnostics(choice, candidates, retest === true)
  )
}
