import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'

vi.mock('./scene/Scene', () => ({
  Scene: () => <div data-testid="scene-single">scene-single</div>,
}))

vi.mock('./scene/SceneMulti', () => ({
  SceneMulti: () => <div data-testid="scene-multi">scene-multi</div>,
}))

describe('App share link', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('inicializa inputs desde query params validos', () => {
    window.history.replaceState(
      {},
      '',
      '/?pL=1300&pW=900&pH=160&bL=700&bW=500&bH=300&maxH=1400&rot=0&ov=25&mode=single',
    )

    render(<App />)

    expect((document.getElementById('pallet-length') as HTMLInputElement).value).toBe('1300')
    expect((document.getElementById('pallet-width') as HTMLInputElement).value).toBe('900')
    expect((document.getElementById('pallet-height') as HTMLInputElement).value).toBe('160')
    expect((document.getElementById('box-length') as HTMLInputElement).value).toBe('700')
    expect((document.getElementById('box-width') as HTMLInputElement).value).toBe('500')
    expect((document.getElementById('box-height') as HTMLInputElement).value).toBe('300')
    expect((document.getElementById('max-total-height') as HTMLInputElement).value).toBe('1400')
    expect((document.getElementById('overhang') as HTMLInputElement).value).toBe('25')
    expect((document.getElementById('allow-rotation') as HTMLInputElement).checked).toBe(false)
  })

  it('muestra warning y usa defaults si la query es invalida', () => {
    window.history.replaceState({}, '', '/?pL=-1&bL=abc')

    render(<App />)

    expect(screen.getByText(/parametros de enlace invalidos/i)).toBeInTheDocument()
    expect((document.getElementById('pallet-length') as HTMLInputElement).value).toBe('1200')
    expect((document.getElementById('box-length') as HTMLInputElement).value).toBe('600')
  })

  it('genera URL compartible con los parametros actuales', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /share link/i }))

    expect(window.location.search).toContain('pL=1200')
    expect(window.location.search).toContain('pW=1000')
    expect(window.location.search).toContain('pH=150')
    expect(window.location.search).toContain('bL=600')
    expect(window.location.search).toContain('bW=400')
    expect(window.location.search).toContain('bH=200')
    expect(window.location.search).toContain('maxH=1200')
    expect(window.location.search).toContain('rot=1')
    expect(window.location.search).toContain('ov=0')
    expect(window.location.search).toContain('mode=single')
  })
})
