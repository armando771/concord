import { execFile } from 'child_process'
import { readFile } from 'fs/promises'
import { join } from 'path'

// Jogos da Steam fora do catálogo: a Steam grava o appid do jogo aberto no
// registro e o nome fica no manifest local. Nada sai do PC além do título.

const STEAM_KEY = 'HKCU\\Software\\Valve\\Steam'

/** Saída de `reg query ... /v RunningAppID` → appid (0 = nenhum jogo). */
export function parseRunningAppId(output: string): number {
  const match = /RunningAppID\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(output)
  return match ? parseInt(match[1], 16) : 0
}

/** Saída de `reg query ... /v SteamPath` → pasta da Steam. */
export function parseSteamPath(output: string): string | undefined {
  const match = /SteamPath\s+REG_SZ\s+(.+?)\r?$/im.exec(output)
  return match?.[1].trim()
}

/** Pastas de biblioteca do `libraryfolders.vdf` (as barras duplas viram simples). */
export function parseLibraryFolders(vdf: string): string[] {
  const folders: string[] = []
  for (const match of vdf.matchAll(/"path"\s+"([^"]+)"/g)) {
    folders.push(match[1].replace(/\\\\/g, '\\'))
  }
  return folders
}

/** Título do jogo no `appmanifest_<appid>.acf`. */
export function parseAppManifestName(acf: string): string | undefined {
  return /"name"\s+"([^"]+)"/.exec(acf)?.[1].trim() || undefined
}

function regQuery(value: string): Promise<string> {
  return new Promise((resolve) => {
    execFile('reg', ['query', STEAM_KEY, '/v', value], { windowsHide: true }, (error, stdout) =>
      resolve(error ? '' : stdout)
    )
  })
}

const names = new Map<number, string>()

async function resolveName(appId: number): Promise<string | undefined> {
  const cached = names.get(appId)
  if (cached) return cached

  const steamPath = parseSteamPath(await regQuery('SteamPath'))
  if (!steamPath) return undefined

  let libraries = [steamPath]
  try {
    const vdf = await readFile(join(steamPath, 'steamapps', 'libraryfolders.vdf'), 'utf8')
    libraries = [steamPath, ...parseLibraryFolders(vdf)]
  } catch {
    // sem libraryfolders.vdf: só a biblioteca padrão
  }

  for (const library of libraries) {
    try {
      const acf = await readFile(join(library, 'steamapps', `appmanifest_${appId}.acf`), 'utf8')
      const name = parseAppManifestName(acf)
      if (name) {
        names.set(appId, name)
        return name
      }
    } catch {
      // o jogo está em outra biblioteca
    }
  }
  return undefined
}

/** Nome do jogo da Steam em andamento, ou null (sem jogo / fora da Steam). */
export async function detectSteamGame(): Promise<string | null> {
  const appId = parseRunningAppId(await regQuery('RunningAppID'))
  if (!appId) return null
  return (await resolveName(appId)) ?? null
}
