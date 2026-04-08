import { describe, expect, it } from 'vitest'
import {
  createEmptyRegistrationDraft,
  validateRegistrationDraft,
} from './registrationModel'

describe('registrationModel', () => {
  it('crea un draft vacio listo para el modo registro', () => {
    expect(createEmptyRegistrationDraft()).toEqual({
      fullName: '',
      email: '',
      companyName: '',
      jobTitle: '',
      useCase: '',
      monthlyVolumeBand: '',
      phone: '',
      password: '',
      confirmPassword: '',
    })
  })

  it('valida campos minimos y contrasena consistente', () => {
    expect(
      validateRegistrationDraft({
        fullName: 'A',
        email: 'correo-invalido',
        companyName: '',
        jobTitle: '',
        useCase: '',
        monthlyVolumeBand: '',
        phone: '',
        password: '123',
        confirmPassword: '456',
      }),
    ).toEqual({
      fullName: 'Ingresa tu nombre completo.',
      email: 'Ingresa un correo de trabajo valido.',
      companyName: 'Ingresa el nombre de tu empresa.',
      useCase: 'Selecciona el caso de uso principal.',
      monthlyVolumeBand: 'Selecciona un volumen estimado.',
      password: 'La contrasena debe tener al menos 12 caracteres.',
      confirmPassword: 'Las contrasenas no coinciden.',
    })
  })
})
