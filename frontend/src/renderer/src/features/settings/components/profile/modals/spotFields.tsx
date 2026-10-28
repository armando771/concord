import type { ReactNode } from 'react'
import type { ProfileDraft, ProfileErrors } from '../../../../profile/lib/profileValidation'
import BannerColorField from '../BannerColorField'
import ProfileLinksField from '../ProfileLinksField'
import { BioField, NoteField, PronounsField } from '../ProfileTextFields'
import ProfileThemeEditor from '../theme/ProfileThemeEditor'

/** Os campos do perfil que abrem num modal simples (o nome tem o dele). */
export type FieldKey = 'pronouns' | 'status_text' | 'bio' | 'links' | 'banner_color' | 'profile_theme'

/** Quem abre cada um: a parte do cartão ou o bloco da coluna. */
export type FieldModalId = 'pronouns' | 'note' | 'bio' | 'links' | 'banner_color' | 'theme'

export interface SpotField<K extends FieldKey = FieldKey> {
  title: string
  key: K
  /** O tema tem muitos controles: modal mais largo. */
  size?: 'wide' | 'xl'
  render: (
    value: ProfileDraft[K],
    errors: ProfileErrors,
    onChange: (value: ProfileDraft[K]) => void
  ) => ReactNode
}

const field = <K extends FieldKey>(f: SpotField<K>): SpotField => f as unknown as SpotField

export const SPOT_FIELDS: Record<FieldModalId, SpotField> = {
  pronouns: field({
    title: 'Pronomes',
    key: 'pronouns',
    render: (value, errors, onChange) => (
      <PronounsField value={value} error={errors.pronouns} onChange={onChange} />
    )
  }),
  note: field({
    title: 'Nota',
    key: 'status_text',
    render: (value, errors, onChange) => (
      <NoteField value={value} error={errors.status_text} onChange={onChange} />
    )
  }),
  bio: field({
    title: 'Sobre mim',
    key: 'bio',
    render: (value, errors, onChange) => (
      <BioField value={value} error={errors.bio} onChange={onChange} />
    )
  }),
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
  }),
  banner_color: field({
    title: 'Cor do banner',
    key: 'banner_color',
    render: (value, errors, onChange) => (
      <BannerColorField value={value} error={errors.banner_color} onChange={onChange} />
    )
  }),
  theme: field({
    title: 'Tema do perfil',
    key: 'profile_theme',
    size: 'xl',
    render: (value, _errors, onChange) => <ProfileThemeEditor value={value} onChange={onChange} />
  })
}
