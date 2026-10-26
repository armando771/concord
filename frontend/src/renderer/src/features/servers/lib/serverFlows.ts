import type { MediaChange } from '../../profile/lib/profileValidation'
import { parseInviteInput } from './inviteLink'

/** O que os fluxos de criar/entrar em servidor usam de fora (store, API e avisos). */
export interface ServerFlowDeps {
  addServer: (name: string) => Promise<{ id: string; name: string }>
  setServerIcon: (serverId: string, icon: { file: Blob; staticFrame?: Blob }) => Promise<void>
  joinServerByCode: (code: string) => Promise<{ id: string; name: string }>
  fetchServers: () => Promise<unknown>
  success: (message: string) => void
  error: (message: string) => void
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

async function uploadIcon(deps: ServerFlowDeps, serverId: string, icon: MediaChange): Promise<void> {
  if (icon.kind !== 'set') return
  try {
    await deps.setServerIcon(serverId, { file: icon.file, staticFrame: icon.staticFrame })
  } catch (err) {
    // O servidor já existe: o ícone pode ser tentado de novo nas configurações.
    deps.error(errorMessage(err, 'Servidor criado, mas o ícone não foi enviado.'))
  }
}

/** Cria o servidor (com ícone, se escolhido). Devolve o id, ou null se falhou (já avisou). */
export async function runCreateServer(
  deps: ServerFlowDeps,
  name: string,
  icon: MediaChange
): Promise<string | null> {
  try {
    const server = await deps.addServer(name)
    await uploadIcon(deps, server.id, icon)
    deps.success(`Servidor "${server.name}" criado com sucesso!`)
    return server.id
  } catch (err) {
    deps.error(errorMessage(err, 'Falha ao criar servidor.'))
    return null
  }
}

/** Entra por código ou link de convite. Devolve o id, ou null se falhou (já avisou). */
export async function runJoinServer(deps: ServerFlowDeps, input: string): Promise<string | null> {
  // Aceita o código ou o link de convite colado inteiro.
  const code = parseInviteInput(input)
  if (!code) {
    deps.error('Link ou código de convite inválido.')
    return null
  }
  try {
    const server = await deps.joinServerByCode(code)
    await deps.fetchServers()
    deps.success(`Você entrou em "${server.name}"!`)
    return server.id
  } catch (err) {
    deps.error(errorMessage(err, 'Código de convite inválido.'))
    return null
  }
}
