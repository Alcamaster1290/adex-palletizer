import { Edit3 } from 'lucide-react'

interface EditToggleButtonProps {
  active: boolean
  onClick: () => void
}

export function EditToggleButton({ active, onClick }: EditToggleButtonProps) {
  return (
    <button
      type="button"
      className={`floating-edit-button ${active ? 'active' : ''}`}
      onClick={onClick}
      title="Editar modelo"
      aria-label="Editar modelo"
      aria-pressed={active}
    >
      <Edit3 className="floating-edit-icon" aria-hidden="true" />
      <span className="sr-only">Editar modelo</span>
    </button>
  )
}
