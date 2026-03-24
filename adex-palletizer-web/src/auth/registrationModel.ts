export type AuthMode = 'login' | 'register'

export type RegistrationUseCase =
  | 'single_palletization'
  | 'multi_box_mixing'
  | 'container_loading'
  | 'general_exploration'

export type RegistrationVolumeBand =
  | 'lt_10'
  | 'between_10_50'
  | 'between_51_200'
  | 'gt_200'

export interface RegistrationDraft {
  fullName: string
  email: string
  companyName: string
  useCase: RegistrationUseCase | ''
  monthlyVolumeBand: RegistrationVolumeBand | ''
  password: string
  confirmPassword: string
}

export type RegistrationField = keyof RegistrationDraft
export type RegistrationFieldErrors = Partial<Record<RegistrationField, string>>

export const REGISTRATION_USE_CASE_OPTIONS: Array<{
  value: RegistrationUseCase
  label: string
}> = [
  { value: 'single_palletization', label: 'Palletizacion de caja unica' },
  { value: 'multi_box_mixing', label: 'Mix de multiples cajas' },
  { value: 'container_loading', label: 'Carga en contenedores' },
  { value: 'general_exploration', label: 'Exploracion general' },
]

export const REGISTRATION_VOLUME_OPTIONS: Array<{
  value: RegistrationVolumeBand
  label: string
}> = [
  { value: 'lt_10', label: 'Menos de 10 pallets/mes' },
  { value: 'between_10_50', label: '10 a 50 pallets/mes' },
  { value: 'between_51_200', label: '51 a 200 pallets/mes' },
  { value: 'gt_200', label: 'Mas de 200 pallets/mes' },
]

export function createEmptyRegistrationDraft(): RegistrationDraft {
  return {
    fullName: '',
    email: '',
    companyName: '',
    useCase: '',
    monthlyVolumeBand: '',
    password: '',
    confirmPassword: '',
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validateRegistrationDraft(
  draft: RegistrationDraft,
): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {}

  if (draft.fullName.trim().length < 2) {
    errors.fullName = 'Ingresa tu nombre completo.'
  }

  if (!isValidEmail(draft.email.trim())) {
    errors.email = 'Ingresa un correo de trabajo valido.'
  }

  if (draft.companyName.trim().length < 2) {
    errors.companyName = 'Ingresa el nombre de tu empresa.'
  }

  if (!draft.useCase) {
    errors.useCase = 'Selecciona el caso de uso principal.'
  }

  if (!draft.monthlyVolumeBand) {
    errors.monthlyVolumeBand = 'Selecciona un volumen estimado.'
  }

  if (draft.password.length < 12) {
    errors.password = 'La contrasena debe tener al menos 12 caracteres.'
  }

  if (draft.confirmPassword.length === 0) {
    errors.confirmPassword = 'Confirma tu contrasena.'
  } else if (draft.password !== draft.confirmPassword) {
    errors.confirmPassword = 'Las contrasenas no coinciden.'
  }

  return errors
}
