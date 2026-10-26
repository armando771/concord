import EntranceSoundSettings from '../../../profile/components/EntranceSoundSettings'
import ProfilesSection from './ProfilesSection'

/**
 * Configurações → Perfis: o editor do cartão (vai no "Salvar alterações") e,
 * embaixo, o som de entrada (salva na hora). No desktop o cartão do som fica
 * na largura do editor, sem passar por baixo da prévia (300 px + gap de 32 px).
 */
function ProfilesPage(): React.JSX.Element {
  return (
    <>
      <ProfilesSection />
      <div className="mt-8 lg:mr-[332px]">
        <EntranceSoundSettings />
      </div>
    </>
  )
}

export default ProfilesPage
