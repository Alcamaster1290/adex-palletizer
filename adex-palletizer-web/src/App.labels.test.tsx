import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from './App'
import { SKU_LABELS_STORAGE_KEY } from './labels/labelStorage'

vi.mock('./scene/Scene', () => ({
  Scene: () => <div data-testid="scene-single">scene-single</div>,
}))

vi.mock('./scene/SceneMulti', () => ({
  SceneMulti: () => <div data-testid="scene-multi">scene-multi</div>,
}))

vi.mock('./scene/SceneContainer', () => ({
  SceneContainer: () => <div data-testid="scene-container">scene-container</div>,
}))

describe('App label designer', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('abre modal en single, guarda etiqueta y persiste en storage', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /editar caja maestra/i }))

    const dialog = screen.getByRole('dialog', { name: /editar caja maestra/i })
    expect(dialog).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText(/CONSIGNEE/i), {
      target: { value: 'CLIENTE TEST' },
    })

    await waitFor(() =>
      expect(within(dialog).getByTestId('label-preview-canvas')).toBeInTheDocument(),
    )
    fireEvent.click(within(dialog).getByRole('button', { name: /guardar/i }))

    const raw = window.localStorage.getItem(SKU_LABELS_STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(raw ?? '').toContain('SINGLE-BOX')
  })

  it('abre modal en multi con dropdown SKU y guarda etiqueta para SKU elegido', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /multiples cajas/i }))
    fireEvent.click(screen.getByRole('button', { name: /editar caja \(sku\)/i }))

    const dialog = screen.getByRole('dialog', { name: /editar caja \(sku\)/i })
    fireEvent.change(within(dialog).getByLabelText(/SKU a editar/i), {
      target: { value: 'SKU-2' },
    })

    await waitFor(() =>
      expect(within(dialog).getByTestId('label-preview-canvas')).toBeInTheDocument(),
    )
    fireEvent.click(within(dialog).getByRole('button', { name: /guardar/i }))

    const raw = window.localStorage.getItem(SKU_LABELS_STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(raw ?? '').toContain('SKU-2')
  })

  it('restaura etiquetas desde storage al recargar App', async () => {
    window.localStorage.setItem(
      SKU_LABELS_STORAGE_KEY,
      JSON.stringify({
        'SINGLE-BOX': {
          skuId: 'SINGLE-BOX',
          baseColor: '#b88752',
          template: 'export',
          shippingMarks: {
            consignee: 'Persistido',
            destination: 'LIM',
            product: 'Caja',
            lot: 'L1',
            cartonNo: '1/1',
          },
          isoPictograms: ['fragile'],
          frontTextureDataUrl: 'data:image/png;base64,AAA',
          updatedAt: '2026-03-02T00:00:00.000Z',
        },
      }),
    )

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /editar caja maestra/i }))
    const dialog = screen.getByRole('dialog', { name: /editar caja maestra/i })
    await waitFor(() =>
      expect((within(dialog).getByLabelText(/CONSIGNEE/i) as HTMLInputElement).value).toBe(
        'Persistido',
      ),
    )
  })
})
