import { SACK_FOOTPRINT_OVERLAP_MM, SACK_GRAVITY_SETTLE_MM } from '../constants'

export interface SackVisualProfile {
  visualLength: number
  visualWidth: number
  visualHeight: number
  gravityOffsetY: number
  topSurfaceY: number
}

export function resolveSackVisualProfile(
  length: number,
  width: number,
  height: number,
  isStacked: boolean,
): SackVisualProfile {
  const overlap = Math.min(
    SACK_FOOTPRINT_OVERLAP_MM,
    Math.max(6, Math.min(length, width) * 0.05),
  )
  const settle = isStacked
    ? Math.min(SACK_GRAVITY_SETTLE_MM, Math.max(4, height * 0.08))
    : 0

  return {
    visualLength: length + overlap,
    visualWidth: width + overlap,
    visualHeight: height + settle,
    gravityOffsetY: -height / 2 - settle,
    topSurfaceY: height / 2,
  }
}
