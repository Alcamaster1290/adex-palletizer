import { Edges, Text } from '@react-three/drei'
import { VISUAL_GAP_MM } from '../constants'
import { resolveSkuTexture } from '../labels/labelTextures'
import { resolveSackLayerIndex, resolveSackPatternTransform } from './sackPattern'
import { LateralLabelMaterial } from './LateralLabelMaterial'
import { SackMesh, useSackTemplate } from './Sack'
import { resolveSackVisualProfile } from './sackVisual'
import type { BoxInstance, BoxSkinMode, SkuLabelsBySku } from '../types'

interface BoxesProps {
  boxes: BoxInstance[]
  showLabels?: boolean
  labelsBySku?: SkuLabelsBySku
  defaultSkuId?: string
  boxSkinMode?: BoxSkinMode
}

const DEFAULT_BOX_COLOR = '#b88752'

export function Boxes({
  boxes,
  showLabels = false,
  labelsBySku = {},
  defaultSkuId,
  boxSkinMode = 'box',
}: BoxesProps) {
  const sackTemplate = useSackTemplate()
  const baseBottomY =
    boxes.length > 0 ? Math.min(...boxes.map((box) => box.y - box.height / 2)) : 0

  return (
    <>
      {boxes.map((box, index) => {
        const sackMode = boxSkinMode === 'sack'
        const isStacked =
          sackMode &&
          ((box.layer ?? 0) > 0 || box.y - box.height / 2 > baseBottomY + 0.5)
        const sackVisual = sackMode
          ? resolveSackVisualProfile(box.length, box.width, box.height, isStacked)
          : null
        const visualLength = sackVisual
          ? sackVisual.visualLength
          : Math.max(1, box.length - VISUAL_GAP_MM)
        const visualHeight = sackVisual
          ? sackVisual.visualHeight
          : Math.max(1, box.height - VISUAL_GAP_MM)
        const visualWidth = sackVisual
          ? sackVisual.visualWidth
          : Math.max(1, box.width - VISUAL_GAP_MM)
        const layerIndex = sackMode ? resolveSackLayerIndex(box, baseBottomY) : 0
        const patternTransform = sackMode
          ? resolveSackPatternTransform(
              visualLength,
              visualWidth,
              layerIndex,
              box.z,
            )
          : { offsetX: 0, offsetZ: 0 }
        const texture = resolveSkuTexture(labelsBySku, box.skuId, defaultSkuId)
        const materialColor = texture ? '#ffffff' : box.color ?? DEFAULT_BOX_COLOR

        if (sackMode) {
          return (
            <group
              key={`${index}-${box.x}-${box.y}-${box.z}`}
              position={[
                box.x + patternTransform.offsetX,
                box.y,
                box.z + patternTransform.offsetZ,
              ]}
            >
              <SackMesh
                template={sackTemplate}
                length={visualLength}
                height={visualHeight}
                width={visualWidth}
                gravityOffsetY={sackVisual?.gravityOffsetY}
                color={materialColor}
                texture={texture}
              />
              {showLabels && box.label && (
                <Text
                  position={[0, (sackVisual?.topSurfaceY ?? visualHeight / 2) + 14, 0]}
                  fontSize={28}
                  color="#1f1f1f"
                  anchorX="center"
                  anchorY="middle"
                  maxWidth={visualLength}
                >
                  {box.label}
                </Text>
              )}
            </group>
          )
        }

        return (
          <mesh
            key={`${index}-${box.x}-${box.y}-${box.z}`}
            position={[box.x, box.y, box.z]}
            castShadow
          >
            <boxGeometry args={[visualLength, visualHeight, visualWidth]} />
            <LateralLabelMaterial
              color={materialColor}
              texture={texture}
              textureMode="full"
              roughness={0.55}
              metalness={0.02}
            />
            <Edges threshold={15} color="#0c4950" />
            {showLabels && box.label && (
              <Text
                position={[0, visualHeight / 2 + 14, 0]}
                fontSize={28}
                color="#1f1f1f"
                anchorX="center"
                anchorY="middle"
                maxWidth={visualLength}
              >
                {box.label}
              </Text>
            )}
          </mesh>
        )
      })}
    </>
  )
}
