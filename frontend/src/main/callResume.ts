import { app } from 'electron'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { freshCallResume, type CallResume, type PendingCallResume } from '../shared/callResume'

const path = (): string => join(app.getPath('userData'), 'update-call-resume.json')

export function clearCallResume(): void {
  try {
    unlinkSync(path())
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

/** Removido do disco antes de entregar: um novo boot não repete a retomada. */
export function takeCallResume(): PendingCallResume | null {
  let value: unknown
  try {
    value = JSON.parse(readFileSync(path(), 'utf8'))
  } catch {
    value = null
  }
  try {
    clearCallResume()
  } catch (error) {
    console.error('[update] não foi possível consumir a retomada:', error)
    return null
  }
  return freshCallResume(value) ? value : null
}

export function saveCallResume(snapshot: CallResume | null): void {
  clearCallResume()
  if (snapshot) writeFileSync(path(), JSON.stringify({ ...snapshot, savedAt: Date.now() }))
}
