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

    fireEvent.click(screen.getByRole('button', { name: /compartir enlace/i }))

    expect(window.location.search).toContain('pL=1200')
    expect(window.location.search).toContain('pW=1000')
    expect(window.location.search).toContain('pH=150')
    expect(window.location.search).toContain('bPr=standard-600-400-200')
    expect(window.location.search).toContain('bL=600')
    expect(window.location.search).toContain('bW=400')
    expect(window.location.search).toContain('bH=200')
    expect(window.location.search).toContain('maxH=1200')
    expect(window.location.search).toContain('rot=1')
    expect(window.location.search).toContain('ov=0')
    expect(window.location.search).toContain('pm=advanced')
    expect(window.location.search).toContain('mode=single')
  })

  it('aplica packing mode desde query param pm=advanced', () => {
    window.history.replaceState({}, '', '/?mode=single&pm=advanced')

    render(<App />)

    expect((document.getElementById('single-packing-mode') as HTMLSelectElement).value).toBe(
      'advanced',
    )
  })

  it('usa Grid como modo estandar cuando la grilla no deja area libre', () => {
    window.history.replaceState(
      {},
      '',
      '/?mode=single&pL=1200&pW=1000&pH=150&bL=600&bW=500&bH=200&maxH=1200&rot=1&ov=0',
    )

    render(<App />)

    expect((document.getElementById('single-packing-mode') as HTMLSelectElement).value).toBe(
      'grid',
    )
  })

  it('incluye pm=advanced al compartir enlace en modo avanzado', () => {
    render(<App />)

    fireEvent.change(document.getElementById('single-packing-mode') as HTMLSelectElement, {
      target: { value: 'advanced' },
    })
    fireEvent.click(screen.getByRole('button', { name: /calcular|recalcular/i }))
    fireEvent.click(screen.getByRole('button', { name: /compartir enlace/i }))

    expect(window.location.search).toContain('pm=advanced')
  })

  it('aplica bPr en la inicializacion del modo single', () => {
    window.history.replaceState({}, '', '/?mode=single&bPr=euronorm-400-300-240')

    render(<App />)

    expect((document.getElementById('single-box-preset') as HTMLSelectElement).value).toBe(
      'euronorm-400-300-240',
    )
    expect((document.getElementById('box-length') as HTMLInputElement).value).toBe('400')
    expect((document.getElementById('box-width') as HTMLInputElement).value).toBe('300')
    expect((document.getElementById('box-height') as HTMLInputElement).value).toBe('240')
  })

  it('permite override explicito de dimensiones sobre bPr', () => {
    window.history.replaceState(
      {},
      '',
      '/?mode=single&bPr=standard-600-400-200&bL=650',
    )

    render(<App />)

    expect((document.getElementById('box-length') as HTMLInputElement).value).toBe('650')
    expect((document.getElementById('single-box-preset') as HTMLSelectElement).value).toBe(
      'custom',
    )
  })

  it('inicializa tab container desde query params de contenedor', () => {
    window.history.replaceState(
      {},
      '',
      '/?mode=container&cPr=40gp&cL=12032&cW=2352&cH=2393&ppL=1200&ppW=1000&ppH=1150&cRot=1&alt=0&cClr=0&cRear=125&wpp=800&pMax=20000',
    )

    render(<App />)

    expect((document.getElementById('container-length') as HTMLInputElement).value).toBe('12032')
    expect((document.getElementById('container-width') as HTMLInputElement).value).toBe('2352')
    expect((document.getElementById('container-pallet-height') as HTMLInputElement).value).toBe(
      '1150',
    )
    expect((document.getElementById('container-clearance') as HTMLInputElement).value).toBe('0')
    expect((document.getElementById('container-rear-clearance') as HTMLInputElement).value).toBe(
      '125',
    )
    expect((document.getElementById('container-allow-rotation') as HTMLInputElement).checked).toBe(
      true,
    )
    expect(
      (document.getElementById('container-allow-alternating-pattern') as HTMLInputElement).checked,
    ).toBe(false)
    expect(screen.getByTestId('scene-container')).toBeInTheDocument()
  })

  it('en modo container usa clearance por defecto cuando cClr no viene en la URL', () => {
    window.history.replaceState(
      {},
      '',
      '/?mode=container&cPr=40gp&cL=12032&cW=2352&cH=2393&ppL=1200&ppW=1000&ppH=1150&cRot=1',
    )

    render(<App />)

    expect((document.getElementById('container-clearance') as HTMLInputElement).value).toBe('50')
    expect((document.getElementById('container-rear-clearance') as HTMLInputElement).value).toBe(
      '50',
    )
  })

  it('inicializa tab multi con noMix=1 desde share link', () => {
    window.history.replaceState({}, '', '/?mode=multi&noMix=1')

    render(<App />)

    const noMixCheckbox = document.getElementById('multi-no-mix-stacking') as HTMLInputElement
    expect(noMixCheckbox.checked).toBe(true)
    expect(screen.getByTestId('scene-multi')).toBeInTheDocument()
  })

  it('inicializa tab multi con noMix=0 desde share link', () => {
    window.history.replaceState({}, '', '/?mode=multi&noMix=0')

    render(<App />)

    const noMixCheckbox = document.getElementById('multi-no-mix-stacking') as HTMLInputElement
    expect(noMixCheckbox.checked).toBe(false)
    expect(screen.getByTestId('scene-multi')).toBeInTheDocument()
  })

  it('genera URL compartible en modo multi con noMix', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /multiples cajas/i }))
    fireEvent.click(screen.getByRole('button', { name: /compartir enlace/i }))

    expect(window.location.search).toContain('mode=multi')
    expect(window.location.search).toContain('noMix=1')
  })

  it('genera URL compartible en modo container', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /contenedores/i }))
    fireEvent.click(screen.getByRole('button', { name: /compartir enlace/i }))

    expect(window.location.search).toContain('mode=container')
    expect(window.location.search).toContain('cL=5898')
    expect(window.location.search).toContain('cW=2352')
    expect(window.location.search).toContain('cH=2393')
    expect(window.location.search).toContain('ppL=1200')
    expect(window.location.search).toContain('ppW=1000')
    expect(window.location.search).toContain('ppH=150')
    expect(window.location.search).toContain('cRot=1')
    expect(window.location.search).toContain('alt=1')
    expect(window.location.search).toContain('cClr=50')
    expect(window.location.search).toContain('cRear=50')
  })
})
