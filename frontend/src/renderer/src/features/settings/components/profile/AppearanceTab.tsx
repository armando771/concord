import type { ProfileEditor } from '../../hooks/useProfileEditor'
import NameStyleEditor from '../NameStyleEditor'
import { EditorSection } from './controls'
import ProfileThemeEditor from './theme/ProfileThemeEditor'

/** Aba "Aparência": o tema do cartão (predefinições, borda, fundo, efeito) e o estilo do nome. */
export default function AppearanceTab({ editor }: { editor: ProfileEditor }): React.JSX.Element {
  const { draft, set } = editor
  return (
    <>
      <ProfileThemeEditor
        value={draft.profile_theme}
        onChange={(next) => set('profile_theme', next)}
      />
      <EditorSection title="Estilo do nome" description="Fonte e efeito do seu nome de exibição.">
        <NameStyleEditor
          value={draft.name_style}
          previewName={draft.display_name.trim()}
          onChange={(next) => set('name_style', next)}
        />
      </EditorSection>
    </>
  )
}
