import type { ReactNode } from 'react'
import type { CardSpot } from '../../../../profile/lib/cardSpots'
import type { ProfileDraft, ProfileErrors } from '../../../../profile/lib/profileValidation'
import ProfileLinksField from '../ProfileLinksField'
import { BioField, NoteField, PronounsField } from '../ProfileTextFields'

/** Os campos de texto do cartão que abrem num modal simples (o nome tem o dele). */
export type FieldKey = 'pronouns' | 'status_text' | 'bio' | 'links'

export interface SpotField<K extends FieldKey = FieldKey> {
  title: string
  key: K
  render: (
    value: ProfileDraft[K],
    errors: ProfileErrors,
    onChange: (value: ProfileDraft[K]) => void
  ) => ReactNode
}

const field = <K extends FieldKey>(f: SpotField<K>): SpotField<K> => f

export const SPOT_FIELDS: Record<Exclude<CardSpot, 'avatar' | 'banner' | 'name'>, SpotField> = {
  pronouns: field({
    title: 'Pronomes',
    key: 'pronouns',
    render: (value, errors, onChange) => (
      <PronounsField value={value} error={errors.pronouns} onChange={onChange} />
    )
  }) as SpotField,
  note: field({
    title: 'Nota',
    key: 'status_text',
    render: (value, errors, onChange) => (
      <NoteField value={value} error={errors.status_text} onChange={onChange} />
    )
  }) as SpotField,
  bio: field({
    title: 'Sobre mim',
    key: 'bio',
    render: (value, errors, onChange) => (
      <BioField value={value} error={errors.bio} onChange={onChange} />
    )
  }) as SpotField,
  links: field({
    title: 'Links',
    key: 'links',
    render: (value, errors, onChange) => (
      <ProfileLinksField
        links={value}
        error={errors.links}
        linkErrors={errors.linkErrors}
        onChange={onChange}
      />
    )
  }) as SpotField
}
