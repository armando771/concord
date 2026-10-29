import { describe, expect, it } from 'vitest'
import { draftFromProfile, hasErrors } from '../../profile/lib/profileValidation'
import { patchErrors, patchedDraft } from './draftPatch'

const draft = draftFromProfile({ display_name: '', pronouns: 'ela', links: [''] })

describe('draftPatch', () => {
  it('o modal mostra o rascunho com a mudança por cima', () => {
    expect(patchedDraft(draft, { pronouns: 'ele' }).pronouns).toBe('ele')
    expect(patchedDraft(draft, {}).pronouns).toBe('ela')
  })
  it('só conta os erros dos campos que o modal edita', () => {
    // O nome vazio é erro, mas o modal de pronomes não tem nada com isso.
    expect(hasErrors(patchErrors(draft, ['pronouns']))).toBe(false)
    expect(patchErrors(draft, ['display_name']).display_name).toBeTruthy()
    expect(patchErrors(draft, ['links']).linkErrors?.[0]).toBeTruthy()
    expect(patchErrors(draft, ['bio']).linkErrors).toBeUndefined()
  })
})
