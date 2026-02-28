import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'

vi.mock('./scene/Scene', () => ({
  Scene: () => <div data-testid="scene-single">scene-single</div>,
}))

vi.mock('./scene/SceneMulti', () => ({
  SceneMulti: () => <div data-testid="scene-multi">scene-multi</div>,
}))

vi.mock('./scene/SceneContainer', () => ({
  SceneContainer: () => <div data-testid="scene-container">scene-container</div>,
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

  it('aplica preset de contenedor 40GP y recalcula layout', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /container loading/i }))

    const containerLengthInput = document.getElementById('container-length') as HTMLInputElement
    const containerPreset = document.getElementById('container-preset') as HTMLSelectElement

    expect(containerLengthInput.value).toBe('5898')
    expect(screen.getByText(/patron: 4 x 2/i)).toBeInTheDocument()

    fireEvent.change(containerPreset, { target: { value: '40gp' } })

    expect(containerLengthInput.value).toBe('12032')
    expect(screen.getByText(/patron: 10 x 2/i)).toBeInTheDocument()
    expect(screen.getByTestId('scene-container')).toBeInTheDocument()
  })

  it('use current pallet result actualiza pallet de carga en tab container', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /container loading/i }))

    const palletHeightInput = document.getElementById(
      'container-pallet-height',
    ) as HTMLInputElement
    expect(palletHeightInput.value).toBe('150')

    fireEvent.click(screen.getByRole('button', { name: /use current pallet result/i }))

    expect(palletHeightInput.value).toBe('1150')
  })
})
