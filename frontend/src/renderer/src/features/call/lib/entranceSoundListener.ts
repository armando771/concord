import { chooseJoinSound, joinedOtherUser, type CallView, type JoinedUser } from './entranceSound'

/** O que o som de entrada lê e toca (injetado: os testes não sobem os stores). */
export interface EntranceDeps {
  call: () => CallView & { deafened: boolean }
  meId: () => string | undefined
  /** Eu silenciei essa pessoa. */
  isMuted: (userId: string) => boolean
  /** Volume da mesa de áudio. */
  volume: () => number
  apiBase: string
  /** Toca o clipe; false se não deu (não carregou, formato, autoplay). */
  playClip: (src: string, volume: number) => Promise<boolean>
  /** O som sintetizado padrão de "alguém entrou". */
  playDefault: () => void
}

/** O som de entrada da pessoa ou, sem ele (ou se falhar), o padrão. */
export async function playJoinSound(
  user: JoinedUser,
  deps: EntranceDeps,
  deafened: boolean
): Promise<void> {
  const sound = chooseJoinSound(user, {
    deafened,
    locallyMuted: deps.isMuted(user.id),
    volume: deps.volume(),
    apiBase: deps.apiBase
  })
  if (sound.kind === 'custom' && (await deps.playClip(sound.src, sound.volume))) return
  deps.playDefault()
}

/** call:joined de outra pessoa na minha call: toca o som de entrada dela. */
export async function handleEntranceEvent(
  event: { type: string; payload: unknown },
  deps: EntranceDeps
): Promise<void> {
  const call = deps.call()
  const user = joinedOtherUser(event, call, deps.meId())
  if (user) await playJoinSound(user, deps, call.deafened)
}
