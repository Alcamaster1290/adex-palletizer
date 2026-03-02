import '@testing-library/jest-dom/vitest'

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => {
    return {
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      font: '12px sans-serif',
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      fill: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      fillText: () => {},
      arc: () => {},
      quadraticCurveTo: () => {},
      drawImage: () => {},
      save: () => {},
      restore: () => {},
    } satisfies Partial<CanvasRenderingContext2D>
  },
  configurable: true,
})

Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
  value: () => 'data:image/png;base64,TEST',
  configurable: true,
})
