import type {
  RectPackConfig,
  RectPackItemInput,
  RectPackPlacement,
  RectPackResult,
} from './types'

interface FreeRect {
  x: number
  y: number
  w: number
  h: number
}

interface CandidateFit {
  rectIndex: number
  x: number
  y: number
  w: number
  h: number
  rotated: boolean
  shortSideLeftover: number
  longSideLeftover: number
}

function isPositiveInteger(value: number) {
  return Number.isFinite(value) && value > 0 && Number.isInteger(value)
}

function intersects(a: FreeRect, b: { x: number; y: number; w: number; h: number }) {
  return !(
    b.x >= a.x + a.w ||
    b.x + b.w <= a.x ||
    b.y >= a.y + a.h ||
    b.y + b.h <= a.y
  )
}

function buildSplitRects(freeRect: FreeRect, usedRect: { x: number; y: number; w: number; h: number }) {
  const output: FreeRect[] = []
  const freeRight = freeRect.x + freeRect.w
  const freeBottom = freeRect.y + freeRect.h
  const usedRight = usedRect.x + usedRect.w
  const usedBottom = usedRect.y + usedRect.h

  if (usedRect.y > freeRect.y) {
    output.push({
      x: freeRect.x,
      y: freeRect.y,
      w: freeRect.w,
      h: usedRect.y - freeRect.y,
    })
  }

  if (usedBottom < freeBottom) {
    output.push({
      x: freeRect.x,
      y: usedBottom,
      w: freeRect.w,
      h: freeBottom - usedBottom,
    })
  }

  if (usedRect.x > freeRect.x) {
    output.push({
      x: freeRect.x,
      y: freeRect.y,
      w: usedRect.x - freeRect.x,
      h: freeRect.h,
    })
  }

  if (usedRight < freeRight) {
    output.push({
      x: usedRight,
      y: freeRect.y,
      w: freeRight - usedRight,
      h: freeRect.h,
    })
  }

  return output.filter((rect) => rect.w > 0 && rect.h > 0)
}

function isContained(inner: FreeRect, outer: FreeRect) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  )
}

function normalizeFreeRects(input: FreeRect[]) {
  const dedup = new Map<string, FreeRect>()
  input.forEach((rect) => {
    if (rect.w <= 0 || rect.h <= 0) {
      return
    }
    dedup.set(`${rect.x}|${rect.y}|${rect.w}|${rect.h}`, rect)
  })

  const candidates = Array.from(dedup.values())
  const pruned = candidates.filter((rect, index) => {
    for (let otherIndex = 0; otherIndex < candidates.length; otherIndex += 1) {
      if (index === otherIndex) {
        continue
      }
      if (isContained(rect, candidates[otherIndex])) {
        return false
      }
    }
    return true
  })

  pruned.sort((left, right) => {
    if (left.y !== right.y) {
      return left.y - right.y
    }
    if (left.x !== right.x) {
      return left.x - right.x
    }
    if (left.h !== right.h) {
      return left.h - right.h
    }
    return left.w - right.w
  })

  return pruned
}

function chooseBestCandidate(
  item: RectPackItemInput,
  freeRects: FreeRect[],
  allowRotatePerItem: boolean,
): CandidateFit | null {
  const orientations = [
    { w: item.w, h: item.h, rotated: false },
    ...(allowRotatePerItem && item.canRotate && item.w !== item.h
      ? [{ w: item.h, h: item.w, rotated: true }]
      : []),
  ]

  let best: CandidateFit | null = null

  for (let rectIndex = 0; rectIndex < freeRects.length; rectIndex += 1) {
    const rect = freeRects[rectIndex]
    for (const orientation of orientations) {
      if (orientation.w > rect.w || orientation.h > rect.h) {
        continue
      }

      const shortSideLeftover = Math.min(rect.w - orientation.w, rect.h - orientation.h)
      const longSideLeftover = Math.max(rect.w - orientation.w, rect.h - orientation.h)
      const candidate: CandidateFit = {
        rectIndex,
        x: rect.x,
        y: rect.y,
        w: orientation.w,
        h: orientation.h,
        rotated: orientation.rotated,
        shortSideLeftover,
        longSideLeftover,
      }

      if (best === null) {
        best = candidate
        continue
      }

      if (candidate.shortSideLeftover < best.shortSideLeftover) {
        best = candidate
        continue
      }

      if (
        candidate.shortSideLeftover === best.shortSideLeftover &&
        candidate.longSideLeftover < best.longSideLeftover
      ) {
        best = candidate
        continue
      }

      if (
        candidate.shortSideLeftover === best.shortSideLeftover &&
        candidate.longSideLeftover === best.longSideLeftover &&
        candidate.y < best.y
      ) {
        best = candidate
        continue
      }

      if (
        candidate.shortSideLeftover === best.shortSideLeftover &&
        candidate.longSideLeftover === best.longSideLeftover &&
        candidate.y === best.y &&
        candidate.x < best.x
      ) {
        best = candidate
        continue
      }

      if (
        candidate.shortSideLeftover === best.shortSideLeftover &&
        candidate.longSideLeftover === best.longSideLeftover &&
        candidate.y === best.y &&
        candidate.x === best.x &&
        best.rotated &&
        !candidate.rotated
      ) {
        best = candidate
      }
    }
  }

  return best
}

export function rectPack2d(
  binWidth: number,
  binHeight: number,
  items: RectPackItemInput[],
  config: RectPackConfig = {},
): RectPackResult {
  if (!isPositiveInteger(binWidth) || !isPositiveInteger(binHeight)) {
    return {
      placements: [],
      unplaced: [...items],
      stats: {
        usedArea: 0,
        utilization: 0,
        freeRectCount: 0,
      },
    }
  }

  const validItems: RectPackItemInput[] = []
  const unplaced: RectPackItemInput[] = []

  for (const item of items) {
    if (isPositiveInteger(item.w) && isPositiveInteger(item.h) && item.id.length > 0) {
      validItems.push(item)
    } else {
      unplaced.push(item)
    }
  }

  const placements: RectPackPlacement[] = []
  let usedArea = 0

  let freeRects: FreeRect[] = [{ x: 0, y: 0, w: binWidth, h: binHeight }]
  const allowRotatePerItem = config.allowRotatePerItem !== false

  validItems.forEach((item) => {
    const fit = chooseBestCandidate(item, freeRects, allowRotatePerItem)
    if (fit === null) {
      unplaced.push(item)
      return
    }

    placements.push({
      itemId: item.id,
      skuId: item.skuId,
      color: item.color,
      x: fit.x,
      y: fit.y,
      w: fit.w,
      h: fit.h,
      rotated: fit.rotated,
    })

    usedArea += fit.w * fit.h

    const usedRect = { x: fit.x, y: fit.y, w: fit.w, h: fit.h }
    const nextFreeRects: FreeRect[] = []

    freeRects.forEach((rect) => {
      if (!intersects(rect, usedRect)) {
        nextFreeRects.push(rect)
        return
      }

      nextFreeRects.push(...buildSplitRects(rect, usedRect))
    })

    freeRects = normalizeFreeRects(nextFreeRects)
  })

  return {
    placements,
    unplaced,
    stats: {
      usedArea,
      utilization: usedArea / (binWidth * binHeight),
      freeRectCount: freeRects.length,
    },
  }
}

