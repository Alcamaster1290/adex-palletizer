import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'

vi.mock('./scene/Scene', () => ({
  Scene: () => <div data-testid="scene-single">scene-single</div>,
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
  }) => (
    <div
      data-testid="scene-container"
      data-load-height={props.palletLoad?.loadTotalHeightMm ?? ''}
      data-pallet-height={props.palletLoad?.palletHeightMm ?? ''}
      data-load-boxes={props.palletLoad?.boxesPlacements?.length ?? 0}
    >
      scene-container
    </div>
  ),
}))

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
    expect(screen.getByTestId('scene-container')).toBeInTheDocument()
  })

  it('usar resultado actual del pallet actualiza pallet de carga en tab container', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /contenedores/i }))

    const palletHeightInput = document.getElementById(
      'container-pallet-height',
    ) as HTMLInputElement
    expect(palletHeightInput.value).toBe('150')
    const sceneContainer = screen.getByTestId('scene-container')
    expect(sceneContainer.getAttribute('data-load-height')).toBe('')

    fireEvent.click(screen.getByRole('button', { name: /usar resultado actual del pallet/i }))

    expect(palletHeightInput.value).toBe('1150')
    const loadHeight = Number(sceneContainer.getAttribute('data-load-height') ?? '0')
    const palletHeight = Number(sceneContainer.getAttribute('data-pallet-height') ?? '0')
    const loadBoxes = Number(sceneContainer.getAttribute('data-load-boxes') ?? '0')
    expect(loadHeight).toBeGreaterThan(palletHeight)
    expect(loadBoxes).toBeGreaterThan(0)
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
