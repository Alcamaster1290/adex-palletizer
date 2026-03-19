import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'

vi.mock('./scene/Scene', () => ({
  Scene: (props: { boxSkinMode?: string }) => (
    <div data-testid="scene-single" data-skin={props.boxSkinMode ?? 'box'}>
      scene-single
    </div>
  ),
}))

vi.mock('./scene/SceneMulti', () => ({
  SceneMulti: () => <div data-testid="scene-multi">scene-multi</div>,
}))

vi.mock('./scene/SceneContainer', () => ({
  SceneContainer: (props: {
    palletLoad?: {
      loadTotalHeightMm?: number
      palletHeightMm?: number
      boxesPlacements?: Array<unknown>
    } | null
    palletCatalog?: Array<{ id: string; quantity: number }>
    result?: {
      solverVariant?: string
    }
  }) => (
    <div
      data-testid="scene-container"
      data-load-height={props.palletLoad?.loadTotalHeightMm ?? ''}
      data-pallet-height={props.palletLoad?.palletHeightMm ?? ''}
      data-load-boxes={props.palletLoad?.boxesPlacements?.length ?? 0}
      data-catalog-size={props.palletCatalog?.length ?? 0}
      data-solver-variant={props.result?.solverVariant ?? ''}
    >
      scene-container
    </div>
  ),
}))

afterEach(() => {
  delete (window as Window & { __ADEX_FORCE_LOGIN__?: boolean }).__ADEX_FORCE_LOGIN__
})

describe('App input validation', () => {
  it('bloquea Calcular y muestra error cuando un campo queda vacio', () => {
    render(<App />)

    const calculateButton = screen.getByRole('button', { name: /calcular|recalcular/i })
    expect(calculateButton).toBeEnabled()

    const palletLengthInput = document.getElementById('pallet-length') as HTMLInputElement
    fireEvent.change(palletLengthInput, { target: { value: '' } })

    expect(calculateButton).toBeDisabled()
    expect(screen.getByText(/obligatorio/i)).toBeInTheDocument()
    expect(screen.getByTestId('scene-single')).toBeInTheDocument()
    expect(screen.queryByText(/nan/i)).not.toBeInTheDocument()
  })

  it('muestra acceso directo a SisLoPe en la cabecera', () => {
    render(<App />)

    const sislopeLink = screen.getByRole('link', {
      name: /abrir sistema logistico del peru/i,
    })

    expect(sislopeLink).toHaveAttribute('href', 'https://sis-lo-pe.vercel.app')
    expect(sislopeLink).toHaveAttribute('target', '_blank')
  })

  it('muestra login cuando no hay sesion y permite entrar con admin/admin', async () => {
    ;(window as Window & { __ADEX_FORCE_LOGIN__?: boolean }).__ADEX_FORCE_LOGIN__ = true

    const authenticatedPayload = {
      user: {
        id: 'user-1',
        username: 'admin',
        email: 'admin',
        role: 'admin',
        status: 'active',
        mustChangePassword: true,
      },
      session: {
        id: 'session-1',
        expiresAt: '2099-01-01T00:00:00.000Z',
      },
    }

    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url

      if (url.includes('/api/auth/me')) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      if (url.includes('/api/auth/login')) {
        return Promise.resolve(
          new Response(JSON.stringify(authenticatedPayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      if (url.includes('/api/auth/logout')) {
        return Promise.resolve(new Response(null, { status: 204 }))
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: 'NOT_MOCKED' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(await screen.findByRole('button', { name: /iniciar sesion/i })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/usuario o correo/i), {
      target: { value: 'admin' },
    })
    fireEvent.change(screen.getByLabelText(/^contrasena/i), {
      target: { value: 'admin' },
    })
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesion/i }))

    expect(await screen.findByText(/pallet solver by alvaro cac/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /abrir menu de usuario/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /abrir menu de usuario/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /cerrar sesion/i }))

    expect(await screen.findByRole('button', { name: /iniciar sesion/i })).toBeInTheDocument()

    delete (window as Window & { __ADEX_FORCE_LOGIN__?: boolean }).__ADEX_FORCE_LOGIN__
  })

  it('mantiene el error de negocio cuando maxTotalHeight <= palletHeight', () => {
    render(<App />)

    const maxHeightInput = document.getElementById('max-total-height') as HTMLInputElement
    fireEvent.change(maxHeightInput, { target: { value: '100' } })

    fireEvent.click(screen.getByRole('button', { name: /calcular|recalcular/i }))

    expect(
      screen.getByText(/la altura m[aá]xima total debe ser mayor que la altura del pallet/i),
    ).toBeInTheDocument()
  })

  it('bloquea Generar 3D en tab multiples cuando hay errores de entrada', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /multiples cajas/i }))

    const generateButton = screen.getByRole('button', { name: /generar 3d|regenerar 3d/i })
    expect(generateButton).toBeEnabled()

    const overhangInput = document.getElementById('multi-overhang') as HTMLInputElement
    fireEvent.change(overhangInput, { target: { value: '-1' } })

    expect(generateButton).toBeDisabled()
    expect(screen.getByText(/debe ser mayor o igual a 0/i)).toBeInTheDocument()
    expect(screen.getByTestId('scene-multi')).toBeInTheDocument()
  })

  it('aplica pallet preset euro y recalcula patron sin romper top view ni escena', () => {
    render(<App />)

    const packingMode = document.getElementById('single-packing-mode') as HTMLSelectElement
    fireEvent.change(packingMode, { target: { value: 'grid' } })
    fireEvent.click(screen.getByRole('button', { name: /calcular|recalcular/i }))

    const palletWidthInput = document.getElementById('pallet-width') as HTMLInputElement
    const palletHeightInput = document.getElementById('pallet-height') as HTMLInputElement
    expect(palletWidthInput.value).toBe('1000')
    expect(palletHeightInput.value).toBe('150')
    expect(screen.getByText(/residual eje ancho: 200 mm/i)).toBeInTheDocument()

    const presetSelect = document.getElementById('single-pallet-preset') as HTMLSelectElement
    fireEvent.change(presetSelect, { target: { value: 'euro' } })

    expect(palletWidthInput.value).toBe('800')
    expect(palletHeightInput.value).toBe('144')
    expect(screen.getByText(/residual eje ancho: 0 mm/i)).toBeInTheDocument()
    expect(screen.getByTestId('scene-single')).toBeInTheDocument()
  })

  it('aplica preset de caja maestra y actualiza dimensiones con recalculo', () => {
    render(<App />)

    const packingMode = document.getElementById('single-packing-mode') as HTMLSelectElement
    fireEvent.change(packingMode, { target: { value: 'grid' } })
    fireEvent.click(screen.getByRole('button', { name: /calcular|recalcular/i }))

    const boxLengthInput = document.getElementById('box-length') as HTMLInputElement
    const boxWidthInput = document.getElementById('box-width') as HTMLInputElement
    const boxHeightInput = document.getElementById('box-height') as HTMLInputElement
    const boxPreset = document.getElementById('single-box-preset') as HTMLSelectElement

    fireEvent.change(boxPreset, { target: { value: 'euronorm-400-300-240' } })

    expect(boxLengthInput.value).toBe('400')
    expect(boxWidthInput.value).toBe('300')
    expect(boxHeightInput.value).toBe('240')
    expect(screen.getByText(/residual eje ancho: 100 mm/i)).toBeInTheDocument()
    expect(screen.getByTestId('scene-single')).toBeInTheDocument()
  })

  it('cambiar packing mode a advanced mantiene TopView y escena sin crash', () => {
    render(<App />)

    const packingMode = document.getElementById('single-packing-mode') as HTMLSelectElement
    fireEvent.change(packingMode, { target: { value: 'advanced' } })
    fireEvent.click(screen.getByRole('button', { name: /calcular|recalcular/i }))

    expect(packingMode.value).toBe('advanced')
    expect(screen.getByTestId('single-top-view-panel')).toBeInTheDocument()
    expect(screen.getByTestId('scene-single')).toBeInTheDocument()
  })

  it('toggle global de skin cambia el modo visual sin recalcular solver', () => {
    render(<App />)

    const skinSelect = document.getElementById('global-box-skin-mode') as HTMLSelectElement
    const scene = screen.getByTestId('scene-single')

    expect(skinSelect.value).toBe('box')
    expect(scene.getAttribute('data-skin')).toBe('box')

    fireEvent.change(skinSelect, { target: { value: 'sack' } })

    expect((document.getElementById('global-box-skin-mode') as HTMLSelectElement).value).toBe(
      'sack',
    )
    expect(screen.getByTestId('scene-single').getAttribute('data-skin')).toBe('sack')
  })

  it('cambia preset de caja a custom cuando se edita manualmente una dimension', () => {
    render(<App />)

    const boxPreset = document.getElementById('single-box-preset') as HTMLSelectElement
    const boxLengthInput = document.getElementById('box-length') as HTMLInputElement

    fireEvent.change(boxPreset, { target: { value: 'standard-500-350-450' } })
    expect(boxPreset.value).toBe('standard-500-350-450')

    fireEvent.change(boxLengthInput, { target: { value: '510' } })
    expect(boxPreset.value).toBe('custom')
  })

  it('aplica preset de contenedor 40GP y recalcula layout', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /contenedores/i }))

    const containerLengthInput = document.getElementById('container-length') as HTMLInputElement
    const containerPreset = document.getElementById('container-preset') as HTMLSelectElement
    const containerClearanceInput = document.getElementById(
      'container-clearance',
    ) as HTMLInputElement

    expect(containerLengthInput.value).toBe('5898')
    expect(containerClearanceInput.value).toBe('50')
    expect(screen.getByText(/patron:/i)).toBeInTheDocument()
    expect(
      (document.getElementById('container-allow-alternating-pattern') as HTMLInputElement).checked,
    ).toBe(true)

    fireEvent.change(containerPreset, { target: { value: '40gp' } })

    expect(containerLengthInput.value).toBe('12032')
    expect(screen.getByText(/patron:/i)).toBeInTheDocument()
    expect(screen.getByText(/peso total de carga/i)).toBeInTheDocument()
    expect(screen.getByText(/utilizacion de payload \(%\)/i)).toBeInTheDocument()
    expect(screen.getByTestId('scene-container')).toBeInTheDocument()
  })

  it('agregar pallet actual crea una entrada consolidada desde el pallet aplicado', () => {
    render(<App />)

    fireEvent.change(document.getElementById('single-packing-mode') as HTMLSelectElement, {
      target: { value: 'grid' },
    })
    fireEvent.change(document.getElementById('box-length') as HTMLInputElement, {
      target: { value: '600' },
    })
    fireEvent.change(document.getElementById('box-width') as HTMLInputElement, {
      target: { value: '500' },
    })
    fireEvent.change(document.getElementById('box-height') as HTMLInputElement, {
      target: { value: '200' },
    })
    fireEvent.change(document.getElementById('pallet-weight') as HTMLInputElement, {
      target: { value: '18.5' },
    })
    fireEvent.change(document.getElementById('box-unit-weight') as HTMLInputElement, {
      target: { value: '12.25' },
    })
    fireEvent.click(screen.getByRole('button', { name: /calcular|recalcular/i }))

    fireEvent.click(screen.getByRole('button', { name: /contenedores/i }))

    const palletHeightInput = document.getElementById(
      'container-pallet-height',
    ) as HTMLInputElement
    const weightPerPalletInput = document.getElementById(
      'container-weight-per-pallet',
    ) as HTMLInputElement
    expect(palletHeightInput.value).toBe('150')
    expect(weightPerPalletInput.value).toBe('')
    const sceneContainer = screen.getByTestId('scene-container')
    expect(sceneContainer.getAttribute('data-load-height')).toBe('')

    fireEvent.click(screen.getByRole('button', { name: /agregar pallet actual/i }))

    expect(screen.getByTestId('container-pallet-catalog')).toBeInTheDocument()
    expect(screen.getByText(/cantidad: 1/i)).toBeInTheDocument()
    expect(palletHeightInput.value).toBe('150')
    expect(weightPerPalletInput.value).toBe('')
    expect(sceneContainer.getAttribute('data-catalog-size')).toBe('1')
    expect(sceneContainer.getAttribute('data-solver-variant')).toBe('consolidated')
  })

  it('usa solver por columnas SKU al activar no mix stacking en multi', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /multiples cajas/i }))

    const noMixCheckbox = document.getElementById('multi-no-mix-stacking') as HTMLInputElement
    expect(noMixCheckbox.checked).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /resolver \(heuristica\)/i }))

    expect(screen.getByText(/heuristica por columnas sku/i)).toBeInTheDocument()
  })

  it('con noMix activo, Generar 3D usa resultado no-mix (no preview)', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /multiples cajas/i }))

    const noMixCheckbox = document.getElementById('multi-no-mix-stacking') as HTMLInputElement
    expect(noMixCheckbox.checked).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /generar 3d|regenerar 3d/i }))

    expect(screen.getByText(/heuristica por columnas sku/i)).toBeInTheDocument()
  })

  it('con noMix desactivado, Generar 3D mantiene preview por grilla', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /multiples cajas/i }))

    const noMixCheckbox = document.getElementById('multi-no-mix-stacking') as HTMLInputElement
    expect(noMixCheckbox.checked).toBe(true)
    fireEvent.click(noMixCheckbox)
    expect(noMixCheckbox.checked).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /generar 3d|regenerar 3d/i }))

    expect(screen.getByText(/vista previa por grilla/i)).toBeInTheDocument()
  })

  it('en primera carga, Multi inicia con noMix activo y 3D heuristico generado', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /multiples cajas/i }))

    const noMixCheckbox = document.getElementById('multi-no-mix-stacking') as HTMLInputElement
    expect(noMixCheckbox.checked).toBe(true)
    expect(screen.getByText(/heuristica por columnas sku/i)).toBeInTheDocument()
  })
})
