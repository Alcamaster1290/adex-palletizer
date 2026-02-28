import { buildMultiPreviewPlacement } from './multiPreviewPlacer'
import type { MultiPreviewInput, MultiPreviewResult } from './types'

export function buildMultiPreview(input: MultiPreviewInput): MultiPreviewResult {
  return buildMultiPreviewPlacement(input)
}
