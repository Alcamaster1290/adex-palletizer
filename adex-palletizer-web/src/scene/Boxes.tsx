import { Edges, Text } from '@react-three/drei'
import { VISUAL_GAP_MM } from '../constants'
import { resolveSkuTexture } from '../labels/labelTextures'
import { SackMesh, useSackTemplate } from './Sack'
import type { BoxInstance, BoxSkinMode, SkuLabelsBySku } from '../types'

interface BoxesProps {
  boxes: BoxInstance[]
  showLabels?: boolean
  labelsBySku?: SkuLabelsBySku
  defaultSkuId?: string
  boxSkinMode?: BoxSkinMode
}

const DEFAULT_BOX_COLOR = '#2f8f9d'

export function Boxes({
  boxes,
  showLabels = false,
  labelsBySku = {},
  defaultSkuId,
  boxSkinMode = 'box',
}: BoxesProps) {
  const sackTemplate = useSackTemplate()

  return (
    <>
      {boxes.map((box, index) => {
        const visualLength = Math.max(1, box.length - VISUAL_GAP_MM)
        const visualHeight = Math.max(1, box.height - VISUAL_GAP_MM)
        const visualWidth = Math.max(1, box.width - VISUAL_GAP_MM)
        const texture = resolveSkuTexture(labelsBySku, box.skuId, defaultSkuId)
        const materialColor = texture ? '#ffffff' : box.color ?? DEFAULT_BOX_COLOR

        if (boxSkinMode === 'sack') {
          return (
            <group
              key={`${index}-${box.x}-${box.y}-${box.z}`}
              position={[box.x, box.y, box.z]}
            >
              <SackMesh
                template={sackTemplate}
                length={visualLength}
                height={visualHeight}
                width={visualWidth}
                color={materialColor}
                texture={texture}
              />
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
            <meshStandardMaterial
              color={materialColor}
              map={texture ?? undefined}
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
