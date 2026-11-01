import Button from '../../../../../shared/ui/Button'
import Modal from '../../../../../shared/ui/Modal'
import EntranceSoundSettings from '../../../../profile/components/EntranceSoundSettings'

/** Som de entrada: escolher, ouvir ou voltar ao padrão (cada ação já salva). */
export default function EntranceSoundModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  return (
    <Modal open title="Som de entrada" onClose={onClose}>
      <EntranceSoundSettings />
      <div className="mt-5 flex justify-end">
        <Button type="button" onClick={onClose} className="min-h-10">
          Pronto
        </Button>
      </div>
    </Modal>
  )
}
