import { draftFromProfile } from '../../../profile/lib/profileValidation'
import type { CardSpot } from '../../../profile/lib/cardSpots'
import ProfilePreview, { type PreviewBase } from './ProfilePreview'

/**
 * O palco de Configurações → Perfis: o cartão inteiro, grande, do jeito que
 * os outros veem (o mesmo componente do cartão que abre ao clicar). Cada
 * parte abre o editor dela. No desktop fica à direita e acompanha a rolagem;
 * no celular vai para cima, na largura toda.
 */
export default function ProfileStage({
  base,
  status,
  onEdit
}: {
  base: PreviewBase
  /** "Salvando…" / "Enviando a imagem: 42%", ou nada. */
  status: string | null
  onEdit: (spot: CardSpot) => void
}): React.JSX.Element {
  return (
    <section
      aria-labelledby="profile-stage-title"
      className="min-w-0 sm:rounded-2xl sm:border sm:border-subtle sm:bg-fg/[0.03] sm:px-6 sm:pb-5 sm:pt-4 lg:sticky lg:top-4 lg:order-2 xl:px-10 xl:pb-8 xl:pt-6"
    >
      <div className="mb-4 flex min-h-5 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3
          id="profile-stage-title"
          className="text-xs font-semibold uppercase tracking-wide text-gray-400"
        >
          Como os outros veem
        </h3>
        <p aria-live="polite" className="text-xs font-medium text-link">
          {status}
        </p>
      </div>
      {/* O cartão tem 300 px nos outros lugares: aqui ele cresce por zoom (tudo
          na mesma proporção). No celular ocupa a largura disponível. */}
      <div className="mx-auto w-full max-w-[400px] lg:w-[300px] lg:max-w-none lg:[zoom:1.12] xl:[zoom:1.32] 2xl:[zoom:1.45]">
        <ProfilePreview
          user={base.user}
          draft={draftFromProfile(base.user)}
          avatarUrl={base.avatarUrl}
          bannerUrl={base.bannerUrl}
          onEdit={onEdit}
        />
      </div>
      <p className="mt-4 text-center text-xs text-gray-400">
        Clique ou toque em qualquer parte do cartão para editar.
      </p>
    </section>
  )
}
