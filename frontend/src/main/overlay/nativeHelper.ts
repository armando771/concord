import { app, net } from 'electron'
import { spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { helperPath, logAudio } from '../screen/screenAudio'
import { createAvatarStore, fetchAvatarBytes, type AvatarStore } from './overlayAvatars'

// Ligações do overlay nativo com o Electron e o disco: o helper e onde os
// avatares baixados ficam.

export function nativeHelperExists(): boolean {
  return existsSync(helperPath())
}

/** stdin em pipe: é por ele que o estado vai (e, fechado, o helper sai). */
export function startNativeHelper(): ChildProcess {
  return spawn(helperPath(), ['overlay'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
}

let store: AvatarStore | null = null

/** Avatares em %TEMP%\salinha-overlay-avatars (um por URL, reaproveitados entre sessões). */
export function overlayAvatarStore(): AvatarStore {
  store ??= createAvatarStore({
    dir: join(app.getPath('temp'), 'salinha-overlay-avatars'),
    download: (url) => fetchAvatarBytes((u) => net.fetch(u), url),
    save: async (file, bytes) => {
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, bytes)
    },
    exists: existsSync,
    log: logAudio
  })
  return store
}
