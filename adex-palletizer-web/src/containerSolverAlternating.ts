import type {
  ContainerInput,
  ContainerOrientationPlan,
  Orientation,
  PalletPlacement,
} from './types'

interface AlternatingRowLayout {
  placements: PalletPlacement[]
  selected: ContainerOrientationPlan
  totalPalletsBySpace: number
  utilizationArea: number
  rowPattern: Orientation[]
  patternLabel: string
}

function buildRowPatterns(countA: number, countB: number): Orientation[][] {
  const patterns: Orientation[][] = []
  const seen = new Set<string>()

  const pushUnique = (pattern: Orientation[]) => {
    const key = pattern.join('|')
    if (!seen.has(key)) {
      seen.add(key)
      patterns.push(pattern)
    }
  }

  const asBlocks = [
    ...Array.from({ length: countA }, () => 'LxW' as const),
    ...Array.from({ length: countB }, () => 'WxL' as const),
  ]
  pushUnique(asBlocks)
  pushUnique([...asBlocks].reverse())

  const buildAlternating = (start: Orientation): Orientation[] => {
    let remainingA = countA
    let remainingB = countB
    let expected = start
    const pattern: Orientation[] = []

    while (remainingA > 0 || remainingB > 0) {
      if (expected === 'LxW') {
        if (remainingA > 0) {
          pattern.push('LxW')
          remainingA -= 1
        } else if (remainingB > 0) {
          pattern.push('WxL')
          remainingB -= 1
        }
      } else if (remainingB > 0) {
        pattern.push('WxL')
        remainingB -= 1
      } else if (remainingA > 0) {
        pattern.push('LxW')
        remainingA -= 1
      }

      expected = expected === 'LxW' ? 'WxL' : 'LxW'
    }

    return pattern
  }

  pushUnique(buildAlternating('LxW'))
  pushUnique(buildAlternating('WxL'))
  return patterns
}

function comparePatterns(left: Orientation[], right: Orientation[]) {
  const leftKey = left.join('|')
  const rightKey = right.join('|')
  return leftKey.localeCompare(rightKey)
}

function buildPatternLabel(pattern: Orientation[]): string {
  if (pattern.length === 0) {
    return 'Alternado'
  }

  const sequence = pattern.map((item) => (item === 'LxW' ? 'A' : 'B'))
  const countA = sequence.filter((item) => item === 'A').length
  const countB = sequence.length - countA

  if (pattern.length <= 8) {
    return `Alternado ${sequence.join('-')}`
  }

  return `Alternado A x${countA} + B x${countB}`
}

export function solveAlternatingByRows(
  input: ContainerInput,
  frontClearance: number,
  rearClearance: number,
  sideClearance: number,
  gap: number,
): AlternatingRowLayout | null {
  const containerL = input.container.length
  const containerW = input.container.width
  const palletL = input.pallet.length
  const palletW = input.pallet.width
  const containerArea = containerL * containerW

  const effectiveLength = Math.max(0, containerL - frontClearance - rearClearance)
  const effectiveWidth = Math.max(0, containerW - 2 * sideClearance)

  if (effectiveLength <= 0 || effectiveWidth <= 0) {
    return null
  }

  const lenA = palletL
  const depthA = palletW
  const lenB = palletW
  const depthB = palletL
  const nA = Math.max(0, Math.floor((effectiveLength + gap) / (lenA + gap)))
  const nB = input.allowRotation
    ? Math.max(0, Math.floor((effectiveLength + gap) / (lenB + gap)))
    : 0

  const maxRowsA = depthA > 0 ? Math.floor((effectiveWidth + gap) / (depthA + gap)) : 0
  const maxRowsB =
    input.allowRotation && depthB > 0
      ? Math.floor((effectiveWidth + gap) / (depthB + gap))
      : 0

  let best: AlternatingRowLayout | null = null
  let bestPattern: Orientation[] = []
  let bestResidualWidth = Number.POSITIVE_INFINITY

  for (let countA = 0; countA <= maxRowsA; countA += 1) {
    for (let countB = 0; countB <= maxRowsB; countB += 1) {
      if (countA + countB === 0) {
        continue
      }
      if ((countA > 0 && nA === 0) || (countB > 0 && nB === 0)) {
        continue
      }

      const patterns = buildRowPatterns(countA, countB)

      patterns.forEach((pattern) => {
        const rowDepth = pattern.reduce(
          (sum, orientation) => sum + (orientation === 'LxW' ? depthA : depthB),
          0,
        )
        const rowGaps = pattern.length > 1 ? (pattern.length - 1) * gap : 0
        const usedDepth = rowDepth + rowGaps
        if (usedDepth > effectiveWidth) {
          return
        }

        const rows = pattern.map((orientation) => {
          const length = orientation === 'LxW' ? lenA : lenB
          const depth = orientation === 'LxW' ? depthA : depthB
          const count = orientation === 'LxW' ? nA : nB
          const occupiedLength = count > 0 ? count * length + (count - 1) * gap : 0
          return { orientation, length, depth, count, occupiedLength }
        })
        if (rows.some((row) => row.count === 0)) {
          return
        }

        const totalPalletsBySpace = rows.reduce((sum, row) => sum + row.count, 0)
        if (totalPalletsBySpace === 0) {
          return
        }

        const occupiedLength = rows.reduce(
          (maxValue, row) => Math.max(maxValue, row.occupiedLength),
          0,
        )
        const trailingResidualLength = Math.max(0, effectiveLength - occupiedLength)
        const trailingResidualWidth = Math.max(0, effectiveWidth - usedDepth)
        const utilizedBlockArea = occupiedLength * usedDepth
        const utilizationArea = containerArea > 0 ? utilizedBlockArea / containerArea : 0

        const shouldReplace =
          !best ||
          totalPalletsBySpace > best.totalPalletsBySpace ||
          (totalPalletsBySpace === best.totalPalletsBySpace &&
            utilizationArea > best.utilizationArea) ||
          (totalPalletsBySpace === best.totalPalletsBySpace &&
            utilizationArea === best.utilizationArea &&
            trailingResidualWidth < bestResidualWidth) ||
          (totalPalletsBySpace === best.totalPalletsBySpace &&
            utilizationArea === best.utilizationArea &&
            trailingResidualWidth === bestResidualWidth &&
            comparePatterns(pattern, bestPattern) < 0)

        if (!shouldReplace) {
          return
        }

        const startX = -containerL / 2 + frontClearance
        const startZ = -containerW / 2 + sideClearance + trailingResidualWidth / 2
        const placements: PalletPlacement[] = []
        let currentZ = startZ
        let index = 0

        rows.forEach((row) => {
          for (let palletIndex = 0; palletIndex < row.count; palletIndex += 1) {
            placements.push({
              x: startX + row.length / 2 + palletIndex * (row.length + gap),
              y: input.pallet.height / 2,
              z: currentZ + row.depth / 2,
              length: row.length,
              width: row.depth,
              height: input.pallet.height,
              rotated: row.orientation === 'WxL',
              index,
              layer: 0,
            })
            index += 1
          }
          currentZ += row.depth + gap
        })

        const firstOrientation = pattern[0] ?? 'LxW'
        const firstLength = firstOrientation === 'LxW' ? palletL : palletW
        const firstDepth = firstOrientation === 'LxW' ? palletW : palletL
        const maxRowCount = rows.reduce((maxValue, row) => Math.max(maxValue, row.count), 0)

        const selected: ContainerOrientationPlan = {
          orientation: firstOrientation,
          palletFootprintL: firstLength,
          palletFootprintW: firstDepth,
          pitchLength: firstLength + gap,
          pitchWidth: firstDepth + gap,
          marginToWall: sideClearance,
          nx: maxRowCount,
          ny: pattern.length,
          perFloor: totalPalletsBySpace,
          occupiedLength,
          occupiedWidth: usedDepth,
          trailingResidualLength,
          trailingResidualWidth,
          utilizationArea,
          residualLength: Math.max(0, containerL - occupiedLength),
          residualWidth: Math.max(0, containerW - usedDepth),
        }

        best = {
          placements,
          selected,
          totalPalletsBySpace,
          utilizationArea,
          rowPattern: [...pattern],
          patternLabel: buildPatternLabel(pattern),
        }
        bestPattern = [...pattern]
        bestResidualWidth = trailingResidualWidth
      })
    }
  }

  return best
}
