import type { ProfileEditor } from '../../hooks/useProfileEditor'
import StyledName from '../../../profile/components/StyledName'
import Button from '../../../../shared/ui/Button'
import { EditorSection } from './controls'
import ProfileThemeEditor from './theme/ProfileThemeEditor'

/**
 * Aba "Aparência": o tema do cartão (predefinições, borda, fundo, efeito) e o
 * estilo do nome, que abre o modal do nome (o mesmo do clique no cartão).
 */
export default function AppearanceTab({
  editor,
  onEditName
}: {
  editor: ProfileEditor
  onEditName: () => void
}): React.JSX.Element {
  const { draft, set } = editor
  const name = draft.display_name.trim() || (editor.user?.username ?? '')
  return (
    <>
      <ProfileThemeEditor
        value={draft.profile_theme}
        onChange={(next) => set('profile_theme', next)}
      />
      <EditorSection
        title="Estilo do nome"
        description="Fonte, efeito e cor do seu nome de exibição."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 truncate rounded-lg bg-input px-3 py-2 text-lg text-strong">
            <StyledName name={name} style={draft.name_style} />
          </p>
          <Button type="button" onClick={onEditName} className="min-h-10 shrink-0">
            Mudar estilo
          </Button>
        </div>
      </EditorSection>
    </>
  )
}
