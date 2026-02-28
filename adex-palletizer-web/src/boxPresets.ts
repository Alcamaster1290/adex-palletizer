import type { DimensionsMM } from './types'

export type BoxPresetId =
  | 'standard-600-400-200'
  | 'standard-500-350-450'
  | 'euronorm-400-300-240'
  | 'compact-360-260-220'
  | 'custom'

interface BoxPresetOption {
  id: BoxPresetId
  label: string
  dimensions?: DimensionsMM
}

export const BOX_PRESET_OPTIONS: BoxPresetOption[] = [
  {
    id: 'standard-600-400-200',
    label: 'Standard 600x400x200',
    dimensions: { length: 600, width: 400, height: 200 },
  },
  {
    id: 'standard-500-350-450',
    label: 'Standard 500x350x450',
    dimensions: { length: 500, width: 350, height: 450 },
  },
  {
    id: 'euronorm-400-300-240',
    label: 'Euronorm 400x300x240',
    dimensions: { length: 400, width: 300, height: 240 },
  },
  {
    id: 'compact-360-260-220',
    label: 'Compact 360x260x220',
    dimensions: { length: 360, width: 260, height: 220 },
  },
  {
    id: 'custom',
    label: 'Custom',
  },
]

export function getBoxPresetDimensions(
  presetId: BoxPresetId,
): DimensionsMM | null {
  const option = BOX_PRESET_OPTIONS.find((item) => item.id === presetId)
  return option?.dimensions ?? null
}

export function detectBoxPreset(box: DimensionsMM): BoxPresetId {
  const matched = BOX_PRESET_OPTIONS.find((item) => {
    if (!item.dimensions) {
      return false
    }

    return (
      item.dimensions.length === box.length &&
      item.dimensions.width === box.width &&
      item.dimensions.height === box.height
    )
  })

  return matched?.id ?? 'custom'
}
