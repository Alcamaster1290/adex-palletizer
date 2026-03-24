// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import {
  buildGeneratedUsername,
  EmailAlreadyRegisteredError,
  parseRegisterPayload,
  registerSelfServeUser,
} from './src/auth.ts'

describe('auth self-serve register', () => {
  it('valida el payload minimo del registro', () => {
    expect(() =>
      parseRegisterPayload({
        fullName: 'Ana Perez',
        email: 'ana@empresa.com',
        companyName: 'Empresa Demo',
        useCase: 'single_palletization',
        monthlyVolumeBand: 'lt_10',
        password: 'clave-super-segura',
      }),
    ).not.toThrow()

    expect(() =>
      parseRegisterPayload({
        fullName: 'Ana Perez',
        email: 'ana@empresa.com',
        companyName: 'Empresa Demo',
        useCase: 'otro',
        monthlyVolumeBand: 'lt_10',
        password: 'clave-super-segura',
      }),
    ).toThrow()
  })

  it('normaliza un username derivado desde el correo', () => {
    expect(buildGeneratedUsername('Jose+Prueba@Empresa.com')).toBe('jose-prueba')
    expect(buildGeneratedUsername('Jose+Prueba@Empresa.com', 2)).toBe('jose-prueba-3')
  })

  it('crea usuario y perfil con defaults self-serve', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'user-1',
            username: 'ana',
            email: 'ana@empresa.com',
            role: 'analyst',
            status: 'active',
            mustChangePassword: false,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })

    const user = await registerSelfServeUser(
      { query } as never,
      {
        fullName: 'Ana Perez',
        email: 'ana@empresa.com',
        companyName: 'Empresa Demo',
        useCase: 'container_loading',
        monthlyVolumeBand: 'between_10_50',
        password: 'clave-super-segura',
      },
    )

    expect(user).toMatchObject({
      username: 'ana',
      email: 'ana@empresa.com',
      role: 'analyst',
      status: 'active',
      mustChangePassword: false,
    })
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO public.usuario_profiles'),
      [
        'user-1',
        'Ana Perez',
        'Empresa Demo',
        'container_loading',
        'between_10_50',
      ],
    )
  })

  it('reintenta si hay colision de username y no pide username al usuario', async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce({
        code: '23505',
        constraint: 'usuarios_username_uq',
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'user-2',
            username: 'ana-2',
            email: 'ana@empresa.com',
            role: 'analyst',
            status: 'active',
            mustChangePassword: false,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })

    const user = await registerSelfServeUser(
      { query } as never,
      {
        fullName: 'Ana Perez',
        email: 'ana@empresa.com',
        companyName: 'Empresa Demo',
        useCase: 'single_palletization',
        monthlyVolumeBand: 'lt_10',
        password: 'clave-super-segura',
      },
    )

    expect(user.username).toBe('ana-2')
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO public.usuarios'),
      expect.arrayContaining(['ana-2', 'ana@empresa.com']),
    )
  })

  it('expone un error claro si el correo ya existe', async () => {
    const query = vi.fn().mockRejectedValueOnce({
      code: '23505',
      constraint: 'usuarios_email_uq',
    })

    await expect(
      registerSelfServeUser(
        { query } as never,
        {
          fullName: 'Ana Perez',
          email: 'ana@empresa.com',
          companyName: 'Empresa Demo',
          useCase: 'general_exploration',
          monthlyVolumeBand: 'gt_200',
          password: 'clave-super-segura',
        },
      ),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError)
  })
})
