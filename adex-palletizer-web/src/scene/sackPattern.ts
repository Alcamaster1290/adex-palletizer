import type { BoxInstance } from '../types'

export interface SackPatternTransform {
  offsetX: number
  offsetZ: number
}

export function resolveSackLayerIndex(box: BoxInstance, baseBottomY: number): number {
  if (typeof box.layer === 'number') {
    return Math.max(0, box.layer)
  }

  const bottomY = box.y - box.height / 2
  return Math.max(0, Math.round((bottomY - baseBottomY) / Math.max(1, box.height)))
}

export function resolveSackPatternTransform(
  length: number,
  width: number,
  layerIndex: number,
  centerZ: number,
): SackPatternTransform {
  if (layerIndex % 2 === 0) {
    return {
      offsetX: 0,
      offsetZ: 0,
    }
  }

  const stagger = Math.min(34, Math.max(12, Math.min(length, width) * 0.08))
  const rowStep = Math.max(1, Math.min(length, width))
  const rowIndex = Math.abs(Math.round(centerZ / rowStep))
  const direction = rowIndex % 2 === 0 ? 1 : -1

  return {
    offsetX: stagger * direction,
    offsetZ: 0,
  }
}
