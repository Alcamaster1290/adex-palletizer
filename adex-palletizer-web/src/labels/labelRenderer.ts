import { LABEL_TEXTURE_SIZE } from './labelModel'
import { drawPictogram } from './pictograms'
import type { ShippingMarks, SkuLabelConfig } from '../types'

interface RenderLabelDraft {
  skuId: string
  baseColor: string
  template: SkuLabelConfig['template']
  shippingMarks: ShippingMarks
  isoPictograms: SkuLabelConfig['isoPictograms']
  logoDataUrl?: string
  gs1Text?: string
}

function clampText(value: string, fallback: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function drawTemplateBackground(
  ctx: CanvasRenderingContext2D,
  template: SkuLabelConfig['template'],
  baseColor: string,
  size: number,
) {
  ctx.fillStyle = '#f9f7f2'
  ctx.fillRect(0, 0, size, size)

  if (template === 'minimal') {
    ctx.fillStyle = baseColor
    ctx.fillRect(0, 0, size, size * 0.18)
  } else if (template === 'export') {
    ctx.fillStyle = baseColor
    ctx.fillRect(0, 0, size, size * 0.24)
    ctx.fillStyle = '#efe9dc'
    ctx.fillRect(size * 0.65, 0, size * 0.35, size)
  } else {
    ctx.fillStyle = baseColor
    ctx.fillRect(0, 0, size, size * 0.3)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(size * 0.08, size * 0.12, size * 0.84, size * 0.78)
  }

  ctx.strokeStyle = '#1d1d1d'
  ctx.lineWidth = Math.max(2, size * 0.004)
  ctx.strokeRect(size * 0.04, size * 0.04, size * 0.92, size * 0.92)
}

function drawFieldBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  size: number,
) {
  ctx.fillStyle = '#3d3d3d'
  ctx.font = `600 ${Math.round(size * 0.025)}px "Segoe UI", sans-serif`
  ctx.fillText(label, x, y)
  ctx.fillStyle = '#111111'
  ctx.font = `700 ${Math.round(size * 0.03)}px "Segoe UI", sans-serif`
  const safeValue = value.length > 0 ? value : '-'
  ctx.fillText(safeValue.slice(0, 38), x, y + size * 0.038, width)
}

function drawLogoPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, width, height)
  ctx.strokeStyle = '#8e8e8e'
  ctx.lineWidth = 2
  ctx.strokeRect(x, y, width, height)
  ctx.strokeStyle = '#9a9a9a'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + width, y + height)
  ctx.moveTo(x + width, y)
  ctx.lineTo(x, y + height)
  ctx.stroke()
  ctx.restore()
}

async function drawLogoOrPlaceholder(
  ctx: CanvasRenderingContext2D,
  logoDataUrl: string | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (!logoDataUrl) {
    drawLogoPlaceholder(ctx, x, y, width, height)
    return
  }

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () => reject(new Error('Logo load error'))
      nextImage.src = logoDataUrl
    })
    ctx.drawImage(image, x, y, width, height)
  } catch {
    drawLogoPlaceholder(ctx, x, y, width, height)
  }
}

function drawGs1Placeholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  gs1Text: string,
  size: number,
) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, width, height)
  ctx.strokeStyle = '#222222'
  ctx.strokeRect(x, y, width, height)
  ctx.fillStyle = '#111111'

  const bars = 36
  const barWidth = width / bars
  for (let index = 0; index < bars; index += 1) {
    if (index % 3 === 0 || index % 5 === 0) {
      ctx.fillRect(x + index * barWidth, y + height * 0.08, barWidth * 0.7, height * 0.7)
    }
  }

  ctx.font = `600 ${Math.round(size * 0.022)}px "Consolas", monospace`
  ctx.fillText(gs1Text || '(00) 000000000000000000', x + 8, y + height * 0.93, width - 16)
}

export async function renderLabelToCanvas(
  canvas: HTMLCanvasElement,
  draft: RenderLabelDraft,
  size = LABEL_TEXTURE_SIZE,
) {
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  drawTemplateBackground(context, draft.template, draft.baseColor, size)

  const contentX = size * 0.08
  const contentW = size * 0.84
  const firstRowY = size * 0.17
  const rowGap = size * 0.1

  context.fillStyle = '#111111'
  context.font = `800 ${Math.round(size * 0.045)}px "Segoe UI", sans-serif`
  context.fillText(`SKU: ${clampText(draft.skuId, 'N/A')}`, contentX, size * 0.11, contentW)

  drawFieldBlock(
    context,
    contentX,
    firstRowY,
    contentW,
    'CONSIGNEE',
    clampText(draft.shippingMarks.consignee, '-'),
    size,
  )
  drawFieldBlock(
    context,
    contentX,
    firstRowY + rowGap,
    contentW,
    'DESTINATION',
    clampText(draft.shippingMarks.destination, '-'),
    size,
  )
  drawFieldBlock(
    context,
    contentX,
    firstRowY + rowGap * 2,
    contentW,
    'SKU / PRODUCT',
    clampText(draft.shippingMarks.product, '-'),
    size,
  )
  drawFieldBlock(
    context,
    contentX,
    firstRowY + rowGap * 3,
    contentW * 0.48,
    'LOT',
    clampText(draft.shippingMarks.lot, '-'),
    size,
  )
  drawFieldBlock(
    context,
    contentX + contentW * 0.52,
    firstRowY + rowGap * 3,
    contentW * 0.48,
    'CARTON NO',
    clampText(draft.shippingMarks.cartonNo, '-'),
    size,
  )

  const logoX = contentX
  const logoY = size * 0.62
  const logoW = size * 0.3
  const logoH = size * 0.18
  await drawLogoOrPlaceholder(context, draft.logoDataUrl, logoX, logoY, logoW, logoH)

  const gs1X = contentX + contentW * 0.34
  const gs1Y = size * 0.62
  const gs1W = contentW * 0.66
  const gs1H = size * 0.18
  drawGs1Placeholder(context, gs1X, gs1Y, gs1W, gs1H, draft.gs1Text ?? '', size)

  const iconSize = size * 0.1
  const iconGap = size * 0.02
  draft.isoPictograms.slice(0, 8).forEach((iconId, index) => {
    const iconX = contentX + index * (iconSize + iconGap)
    const iconY = size * 0.84
    drawPictogram(context, iconId, { x: iconX, y: iconY, size: iconSize })
  })
}

export async function renderLabelToDataUrl(
  draft: RenderLabelDraft,
  size = LABEL_TEXTURE_SIZE,
) {
  const canvas = document.createElement('canvas')
  await renderLabelToCanvas(canvas, draft, size)
  return canvas.toDataURL('image/png')
}
