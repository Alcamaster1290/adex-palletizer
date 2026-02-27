export function exportPng(canvas: HTMLCanvasElement | null) {
  if (canvas === null) {
    return
  }

  const dataUrl = canvas.toDataURL('image/png')
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = 'pallet-layout.png'
  document.body.append(link)
  link.click()
  link.remove()
}
