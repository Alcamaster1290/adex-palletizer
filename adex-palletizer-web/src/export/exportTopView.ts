function triggerDownload(url: string, filename: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
}

function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  return new XMLSerializer().serializeToString(clone)
}

function getSvgSize(svg: SVGSVGElement) {
  const viewBox = svg.viewBox.baseVal
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height }
  }

  const rect = svg.getBoundingClientRect()
  return {
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  }
}

export function exportTopViewSvg(
  svg: SVGSVGElement | null,
  filename = 'top-view.svg',
) {
  if (!svg) {
    return
  }

  const content = serializeSvg(svg)
  const blob = new Blob([content], {
    type: 'image/svg+xml;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, filename)
  URL.revokeObjectURL(url)
}

export async function exportTopViewPng(
  svg: SVGSVGElement | null,
  filename = 'top-view.png',
) {
  if (!svg) {
    return
  }

  const content = serializeSvg(svg)
  const blob = new Blob([content], {
    type: 'image/svg+xml;charset=utf-8',
  })
  const svgUrl = URL.createObjectURL(blob)
  const image = new Image()
  const size = getSvgSize(svg)

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('No se pudo renderizar el TopView.'))
    image.src = svgUrl
  })

  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(size.width * scale))
  canvas.height = Math.max(1, Math.round(size.height * scale))
  const context = canvas.getContext('2d')

  if (!context) {
    URL.revokeObjectURL(svgUrl)
    return
  }

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.scale(scale, scale)
  context.drawImage(image, 0, 0, size.width, size.height)
  URL.revokeObjectURL(svgUrl)

  const pngUrl = canvas.toDataURL('image/png')
  triggerDownload(pngUrl, filename)
}
