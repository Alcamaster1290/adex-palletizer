import type { IsoPictogramId } from '../types'

interface PictogramRect {
  x: number
  y: number
  size: number
}

function drawThisSideUp(
  ctx: CanvasRenderingContext2D,
  { x, y, size }: PictogramRect,
) {
  const top = y + size * 0.25
  const leftArrow = x + size * 0.32
  const rightArrow = x + size * 0.68
  const bottom = y + size * 0.78

  ctx.lineWidth = Math.max(2, size * 0.06)
  ctx.strokeStyle = '#111111'

  ;[leftArrow, rightArrow].forEach((arrowX) => {
    ctx.beginPath()
    ctx.moveTo(arrowX, bottom)
    ctx.lineTo(arrowX, top)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(arrowX, top)
    ctx.lineTo(arrowX - size * 0.09, top + size * 0.1)
    ctx.moveTo(arrowX, top)
    ctx.lineTo(arrowX + size * 0.09, top + size * 0.1)
    ctx.stroke()
  })

  ctx.beginPath()
  ctx.moveTo(x + size * 0.18, y + size * 0.86)
  ctx.lineTo(x + size * 0.82, y + size * 0.86)
  ctx.stroke()
}

function drawFragile(ctx: CanvasRenderingContext2D, { x, y, size }: PictogramRect) {
  ctx.lineWidth = Math.max(2, size * 0.05)
  ctx.strokeStyle = '#111111'

  ctx.beginPath()
  ctx.arc(x + size * 0.5, y + size * 0.35, size * 0.18, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x + size * 0.5, y + size * 0.53)
  ctx.lineTo(x + size * 0.4, y + size * 0.7)
  ctx.lineTo(x + size * 0.6, y + size * 0.7)
  ctx.closePath()
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x + size * 0.3, y + size * 0.22)
  ctx.lineTo(x + size * 0.7, y + size * 0.8)
  ctx.stroke()
}

function drawKeepDry(ctx: CanvasRenderingContext2D, { x, y, size }: PictogramRect) {
  ctx.lineWidth = Math.max(2, size * 0.05)
  ctx.strokeStyle = '#111111'

  ctx.beginPath()
  ctx.moveTo(x + size * 0.2, y + size * 0.78)
  ctx.lineTo(x + size * 0.8, y + size * 0.78)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x + size * 0.5, y + size * 0.55, size * 0.18, Math.PI, Math.PI * 2, false)
  ctx.stroke()

  const drops = [0.25, 0.5, 0.75]
  drops.forEach((factor) => {
    const dropX = x + size * factor
    ctx.beginPath()
    ctx.moveTo(dropX, y + size * 0.16)
    ctx.lineTo(dropX - size * 0.04, y + size * 0.27)
    ctx.lineTo(dropX + size * 0.04, y + size * 0.27)
    ctx.closePath()
    ctx.stroke()
  })
}

function drawKeepAwayFromHeat(
  ctx: CanvasRenderingContext2D,
  { x, y, size }: PictogramRect,
) {
  ctx.lineWidth = Math.max(2, size * 0.05)
  ctx.strokeStyle = '#111111'

  const baseY = y + size * 0.8
  ctx.beginPath()
  ctx.moveTo(x + size * 0.2, baseY)
  ctx.lineTo(x + size * 0.8, baseY)
  ctx.stroke()

  const flameXs = [0.32, 0.5, 0.68]
  flameXs.forEach((factor) => {
    const flameX = x + size * factor
    ctx.beginPath()
    ctx.moveTo(flameX, y + size * 0.66)
    ctx.quadraticCurveTo(flameX - size * 0.05, y + size * 0.52, flameX, y + size * 0.38)
    ctx.quadraticCurveTo(flameX + size * 0.05, y + size * 0.52, flameX, y + size * 0.66)
    ctx.stroke()
  })

  ctx.beginPath()
  ctx.moveTo(x + size * 0.16, y + size * 0.28)
  ctx.lineTo(x + size * 0.84, y + size * 0.28)
  ctx.stroke()
}

export function drawPictogram(
  ctx: CanvasRenderingContext2D,
  pictogramId: IsoPictogramId,
  rect: PictogramRect,
) {
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = Math.max(1, rect.size * 0.03)
  ctx.fillRect(rect.x, rect.y, rect.size, rect.size)
  ctx.strokeRect(rect.x, rect.y, rect.size, rect.size)

  switch (pictogramId) {
    case 'thisSideUp':
      drawThisSideUp(ctx, rect)
      break
    case 'fragile':
      drawFragile(ctx, rect)
      break
    case 'keepDry':
      drawKeepDry(ctx, rect)
      break
    case 'keepAwayFromHeat':
      drawKeepAwayFromHeat(ctx, rect)
      break
    default:
      break
  }

  ctx.restore()
}
