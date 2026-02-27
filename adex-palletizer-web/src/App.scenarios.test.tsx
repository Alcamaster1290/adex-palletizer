import { fireEvent, render, screen } from '@testing-library/react'
import { SCENARIOS_STORAGE_KEY } from './scenarios'
import App from './App'

vi.mock('./scene/Scene', () => ({
  Scene: () => <div data-testid="scene-single">scene-single</div>,
}))

vi.mock('./scene/SceneMulti', () => ({
  SceneMulti: () => <div data-testid="scene-multi">scene-multi</div>,
}))

describe('App scenarios storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('guarda escenario y lo mantiene tras recargar la app', () => {
    const { unmount } = render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /save scenario/i }))

    expect(screen.getByText('Scenario 1')).toBeInTheDocument()

    const storedRaw = window.localStorage.getItem(SCENARIOS_STORAGE_KEY)
    expect(storedRaw).not.toBeNull()

    unmount()
    render(<App />)

    expect(screen.getByText('Scenario 1')).toBeInTheDocument()
  })

  it('aplica limite maximo de 5 escenarios guardados', () => {
    render(<App />)

    const saveButton = screen.getByRole('button', { name: /save scenario/i })
    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(saveButton)
    }

    expect(screen.getAllByRole('button', { name: 'Load' })).toHaveLength(5)

    fireEvent.click(saveButton)

    expect(screen.getByText(/limite de 5 escenarios alcanzado/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Load' })).toHaveLength(5)
  })
})
