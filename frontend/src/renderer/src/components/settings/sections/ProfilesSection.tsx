import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuthStore, type User } from '../../../store/authStore'
import { useSettingsStore } from '../../../store/settingsStore'
import { showToast } from '../../../store/toastStore'
import {
  deleteProfileImage,
  updateProfile,
  uploadProfileImage,
  type ProfileImageKind
} from '../../../api/users'
import {
  MAX_BIO,
  MAX_DISPLAY_NAME,
  MAX_PRONOUNS,
  MAX_STATUS_TEXT,
  PROFILE_IMAGE_TYPES,
  charCount,
  draftFromProfile,
  fieldsChanged,
  hasErrors,
  imageFileError,
  isDirty,
  profileErrors,
  profilePayload,
  type MediaChange,
  type ProfileDraft
} from '../../../lib/profileValidation'
import { MAX_LINKS, detectProvider, linkError, normalizeLink } from '../../../lib/profileLinks'
import ProfileCardBody from '../../profile/ProfileCardBody'
import ProfileCardFrame from '../../profile/ProfileCardFrame'
import { profileThemeLook, resolveProfileTheme } from '../../../lib/profileTheme'
import LinkIcon from '../../profile/LinkIcon'
import { BirthdaySettings } from '../../AppSettings'
import { PlusIcon, XIcon } from '../../icons'
import ImageCropModal, { type ImageKind } from '../ImageCropModal'
import NameStyleEditor from '../NameStyleEditor'
import ProfileThemeEditor from '../ProfileThemeEditor'

const DEFAULT_BANNER = 'linear-gradient(135deg, #5865f2, #8b5cf6)'
const inputClass =
  'w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-[#5865f2] focus:outline-none'

function Field({
  label,
  hint,
  error,
  counter,
  children
}: {
  label: string
  hint?: string
  error?: string | null
  counter?: { used: number; max: number }
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="border-b border-white/10 pb-6">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-ds-sm font-medium text-gray-300">{label}</p>
        {counter && (
          <span
            className={`text-[11px] ${counter.used > counter.max ? 'text-[#f23f43]' : 'text-gray-500'}`}
          >
            {counter.max - counter.used}
          </span>
        )}
      </div>
      {hint && <p className="-mt-1 mb-2 text-xs text-gray-400">{hint}</p>}
      {children}
      {error && <p className="mt-1.5 text-xs text-[#f23f43]">{error}</p>}
    </div>
  )
}

function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>): React.JSX.Element {
  return (
    <button
      type="button"
      {...props}
      className="cursor-pointer rounded-md bg-white/10 px-4 py-2 text-ds-sm font-medium text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
    />
  )
}

/** URL do avatar/banner mostrada na prévia: o rascunho por cima do salvo. */
function previewMedia(change: MediaChange, saved: string | null | undefined): string | null {
  if (change.kind === 'set') return change.previewUrl
  if (change.kind === 'remove') return null
  return saved ?? null
}

const revoke = (change: MediaChange): void => {
  if (change.kind === 'set') URL.revokeObjectURL(change.previewUrl)
}

/**
 * Configurações → Perfis, como no Discord: o editor à esquerda e a prévia do
 * cartão à direita, ao vivo. Nada vai para o servidor até "Salvar alterações";
 * com algo pendente, a barra de aviso aparece embaixo (e treme se tentar sair).
 */
function ProfilesSection(): React.JSX.Element | null {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const setDirty = useSettingsStore((s) => s.setDirty)
  const blockedAt = useSettingsStore((s) => s.blockedAt)

  const saved = useMemo(() => draftFromProfile(user ?? {}), [user])
  const [draft, setDraft] = useState<ProfileDraft>(saved)
  const [cropping, setCropping] = useState<{ file: File; src: string; kind: ImageKind } | null>(
    null
  )
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [shaking, setShaking] = useState(false)
  const fileInputs = {
    avatar: useRef<HTMLInputElement>(null),
    banner: useRef<HTMLInputElement>(null)
  }

  const dirty = isDirty(draft, saved)
  const errors = profileErrors(draft)
  const invalid = hasErrors(errors)

  useEffect(() => {
    setDirty(dirty)
  }, [dirty, setDirty])
  useEffect(() => () => setDirty(false), [setDirty])

  // Tentou sair com alterações: a barra treme e fica vermelha por um instante.
  const firstBlock = useRef(blockedAt)
  useEffect(() => {
    if (blockedAt === firstBlock.current) return
    setShaking(true)
    const t = setTimeout(() => setShaking(false), 900)
    return () => clearTimeout(t)
  }, [blockedAt])

  // Prévias locais (blob:) vivem enquanto o rascunho existir.
  const draftRef = useRef(draft)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])
  useEffect(
    () => () => {
      revoke(draftRef.current.avatar)
      revoke(draftRef.current.banner)
    },
    []
  )

  if (!user) return null

  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]): void =>
    setDraft((d) => ({ ...d, [key]: value }))

  const setMedia = (kind: ImageKind, change: MediaChange): void =>
    setDraft((d) => {
      revoke(d[kind])
      return { ...d, [kind]: change }
    })

  const pickFile = (kind: ImageKind, file: File | undefined): void => {
    if (!file) return
    const error = imageFileError(file)
    if (error) {
      showToast.error(error)
      return
    }
    setCropping({ file, kind, src: URL.createObjectURL(file) })
  }

  const reset = (): void => {
    revoke(draft.avatar)
    revoke(draft.banner)
    setDraft(saved)
  }

  const commit = (latest: User): void => {
    // O status da sessão é o escolhido; a resposta já traz, mas o local manda.
    const current = useAuthStore.getState().user
    setUser({ ...latest, status: current?.status ?? latest.status })
  }

  const save = async (): Promise<void> => {
    if (invalid || saving) return
    setSaving(true)
    try {
      // Cada passo que dá certo sai do rascunho: se um falhar, "Salvar" de
      // novo só refaz o que faltou.
      for (const kind of ['avatar', 'banner'] as ProfileImageKind[]) {
        const change = draftRef.current[kind]
        if (change.kind === 'keep') continue
        setProgress(change.kind === 'set' ? 0 : null)
        const latest =
          change.kind === 'set'
            ? await uploadProfileImage(kind, change.file, change.staticFrame, setProgress)
            : await deleteProfileImage(kind)
        commit(latest)
        setMedia(kind, { kind: 'keep' })
      }
      setProgress(null)
      const fresh = draftFromProfile(useAuthStore.getState().user ?? {})
      if (fieldsChanged(draftRef.current, fresh)) {
        const latest = await updateProfile(profilePayload(draftRef.current))
        commit(latest)
        setDraft(draftFromProfile(latest))
      } else {
        setDraft(fresh)
      }
      showToast.success('Perfil salvo!')
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Não foi possível salvar o perfil.')
    } finally {
      setSaving(false)
      setProgress(null)
    }
  }

  const theme = resolveProfileTheme(draft.profile_theme)
  const look = profileThemeLook(theme)
  const avatarUrl = previewMedia(draft.avatar, user.avatar_url)
  const bannerUrl = previewMedia(draft.banner, user.banner_url)
  const links = draft.links

  return (
    <>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Editor */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Field
            label="Nome de exibição"
            error={errors.display_name}
            counter={{ used: charCount(draft.display_name), max: MAX_DISPLAY_NAME }}
          >
            <input
              value={draft.display_name}
              onChange={(e) => set('display_name', e.target.value)}
              className={inputClass}
              aria-label="Nome de exibição"
            />
          </Field>

          <Field label="Estilo do nome" hint="Fonte e efeito do seu nome de exibição.">
            <NameStyleEditor
              value={draft.name_style}
              previewName={draft.display_name.trim()}
              onChange={(next) => set('name_style', next)}
            />
          </Field>

          <Field
            label="Pronomes"
            error={errors.pronouns}
            counter={{ used: charCount(draft.pronouns), max: MAX_PRONOUNS }}
          >
            <input
              value={draft.pronouns}
              onChange={(e) => set('pronouns', e.target.value)}
              placeholder="Adicione seus pronomes"
              className={inputClass}
              aria-label="Pronomes"
            />
          </Field>

          <Field label="Avatar" hint="PNG, JPG, WebP ou GIF animado, até 10 MB.">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputs.avatar.current?.click()}
                className="cursor-pointer rounded-md bg-[#5865f2] px-4 py-2 text-ds-sm font-medium text-white transition-colors hover:bg-[#4752c4]"
              >
                Alterar avatar
              </button>
              {avatarUrl && (
                <SecondaryButton onClick={() => setMedia('avatar', { kind: 'remove' })}>
                  Remover avatar
                </SecondaryButton>
              )}
            </div>
          </Field>

          <Field label="Banner do perfil" hint="Imagem ou GIF (até 10 MB), ou só uma cor.">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputs.banner.current?.click()}
                className="cursor-pointer rounded-md bg-[#5865f2] px-4 py-2 text-ds-sm font-medium text-white transition-colors hover:bg-[#4752c4]"
              >
                Alterar banner
              </button>
              {bannerUrl && (
                <SecondaryButton onClick={() => setMedia('banner', { kind: 'remove' })}>
                  Remover banner
                </SecondaryButton>
              )}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <label
                className="relative h-12 w-16 cursor-pointer overflow-hidden rounded-md border border-white/20"
                style={{ background: draft.banner_color ?? DEFAULT_BANNER }}
                title="Escolher a cor do banner"
              >
                <input
                  type="color"
                  value={draft.banner_color ?? '#5865f2'}
                  onChange={(e) => set('banner_color', e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Cor do banner"
                />
              </label>
              <div className="text-xs text-gray-400">
                <p className="font-semibold text-gray-200">Cor do banner</p>
                <p>Aparece quando não há imagem de banner.</p>
                {draft.banner_color && (
                  <button
                    type="button"
                    onClick={() => set('banner_color', null)}
                    className="mt-0.5 cursor-pointer text-[#00a8fc] hover:underline"
                  >
                    Usar a cor padrão
                  </button>
                )}
              </div>
            </div>
            {errors.banner_color && (
              <p className="mt-1.5 text-xs text-[#f23f43]">{errors.banner_color}</p>
            )}
          </Field>

          <Field
            label="Tema do perfil"
            hint="Borda, fundo e efeito do seu cartão de perfil, do jeito que os outros veem."
          >
            <ProfileThemeEditor
              value={draft.profile_theme}
              onChange={(next) => set('profile_theme', next)}
            />
          </Field>

          <Field
            label="Nota"
            hint="O balão que aparece ao lado da sua foto."
            error={errors.status_text}
            counter={{ used: charCount(draft.status_text), max: MAX_STATUS_TEXT }}
          >
            <input
              value={draft.status_text}
              onChange={(e) => set('status_text', e.target.value)}
              placeholder="No que você está pensando?"
              className={inputClass}
              aria-label="Nota"
            />
          </Field>

          <Field
            label="Sobre mim"
            hint="Você pode usar links."
            error={errors.bio}
            counter={{ used: charCount(draft.bio), max: MAX_BIO }}
          >
            <textarea
              value={draft.bio}
              onChange={(e) => set('bio', e.target.value)}
              rows={4}
              className={`${inputClass} resize-none`}
              aria-label="Sobre mim"
            />
          </Field>

          <Field
            label="Links"
            hint="Steam, Twitch, YouTube, X, Instagram, TikTok, GitHub, Spotify ou qualquer site."
            error={errors.links}
          >
            <div className="flex flex-col gap-2">
              {links.map((link, i) => {
                const provider = detectProvider(normalizeLink(link))
                const error = errors.linkErrors?.[i]
                return (
                  <div key={i}>
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/5 text-gray-300"
                        title={provider.label}
                      >
                        <LinkIcon provider={provider.id} />
                      </span>
                      <input
                        value={link}
                        onChange={(e) =>
                          set(
                            'links',
                            links.map((l, j) => (j === i ? e.target.value : l))
                          )
                        }
                        placeholder="https://steamcommunity.com/id/voce"
                        className={inputClass}
                        aria-label={`Link ${i + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          set(
                            'links',
                            links.filter((_, j) => j !== i)
                          )
                        }
                        aria-label={`Remover link ${i + 1}`}
                        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    </div>
                    {error && <p className="ml-11 mt-1 text-xs text-[#f23f43]">{error}</p>}
                  </div>
                )
              })}
              <div>
                <SecondaryButton
                  onClick={() => set('links', [...links, ''])}
                  disabled={links.length >= MAX_LINKS}
                >
                  <span className="flex items-center gap-1.5">
                    <PlusIcon className="h-4 w-4" />
                    Adicionar link
                  </span>
                </SecondaryButton>
                {links.length >= MAX_LINKS && (
                  <span className="ml-3 text-xs text-gray-500">Máximo de {MAX_LINKS} links.</span>
                )}
              </div>
            </div>
          </Field>

          {/* Aniversário salva na hora, como antes (fora do "Salvar alterações"). */}
          <BirthdaySettings />
        </div>

        {/* Prévia */}
        <div className="w-full shrink-0 lg:sticky lg:top-0 lg:w-[300px]">
          <p className="mb-2 text-ds-sm font-medium text-gray-300">Prévia</p>
          <ProfileCardFrame
            look={look}
            effect={theme.effect}
            className="text-sm text-gray-200 shadow-2xl"
          >
            <ProfileCardBody
              preview
              isMe
              surface={look.surface}
              onEditAvatar={() => fileInputs.avatar.current?.click()}
              onEditBanner={() => fileInputs.banner.current?.click()}
              profile={{
                display_name: draft.display_name.trim() || user.username,
                name_style: draft.name_style,
                username: user.username,
                avatar_url: avatarUrl,
                banner_url: bannerUrl,
                banner_color: draft.banner_color,
                pronouns: draft.pronouns.trim(),
                bio: draft.bio,
                status_text: draft.status_text,
                // Na prévia só entram os links válidos.
                links: links.map(normalizeLink).filter((l) => !linkError(l))
              }}
              status={user.status ?? 'online'}
              fallbackBanner={DEFAULT_BANNER}
            />
          </ProfileCardFrame>
          <p className="mt-2 text-xs text-gray-500">
            Passe o mouse no avatar ou no banner para trocar a imagem.
          </p>
        </div>
      </div>

      {(['avatar', 'banner'] as ImageKind[]).map((kind) => (
        <input
          key={kind}
          ref={fileInputs[kind]}
          type="file"
          accept={PROFILE_IMAGE_TYPES.join(',')}
          className="hidden"
          onChange={(e) => {
            pickFile(kind, e.target.files?.[0])
            e.target.value = ''
          }}
        />
      ))}

      {cropping && (
        <ImageCropModal
          file={cropping.file}
          src={cropping.src}
          kind={cropping.kind}
          onCancel={() => {
            URL.revokeObjectURL(cropping.src)
            setCropping(null)
          }}
          onApply={(change) => {
            URL.revokeObjectURL(cropping.src)
            setMedia(cropping.kind, change)
            setCropping(null)
          }}
        />
      )}

      {dirty && (
        <div className="sticky bottom-6 z-10 mt-8">
          <div
            role="status"
            className={`flex items-center justify-between gap-4 rounded-lg px-4 py-2.5 shadow-2xl transition-colors ${
              shaking ? 'unsaved-shake bg-[#da373c]' : 'bg-[#111214] border border-white/10'
            }`}
          >
            <p className="text-sm font-medium text-white">
              Cuidado — você tem alterações não salvas!
            </p>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={reset}
                disabled={saving}
                className="cursor-pointer text-sm text-white hover:underline disabled:opacity-50"
              >
                Redefinir
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || invalid}
                title={invalid ? 'Corrija os campos em vermelho' : undefined}
                className="cursor-pointer rounded-md bg-[#248046] px-4 py-2 text-ds-sm font-medium text-white transition-colors hover:bg-[#1a6334] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? progress !== null
                    ? `Enviando ${Math.round(progress * 100)}%`
                    : 'Salvando...'
                  : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ProfilesSection
