import { Edit3 } from 'lucide-react'

interface EditToggleButtonProps {
  onClick: () => void
}

export function EditToggleButton({ onClick }: EditToggleButtonProps) {
  return (
    <button
      type="button"
      className="floating-edit-button"
      onClick={onClick}
      title="Editar caja maestra"
      aria-label="Editar caja maestra"
    >
      <Edit3 className="floating-edit-icon" aria-hidden="true" />
      <span className="sr-only">Editar caja maestra</span>
    </button>
  )
}
