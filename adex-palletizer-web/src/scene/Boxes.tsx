import { Edges } from '@react-three/drei'
import type { BoxInstance } from '../types'

interface BoxesProps {
  boxes: BoxInstance[]
}

const VISUAL_GAP_MM = 4
const DEFAULT_BOX_COLOR = '#2f8f9d'

export function Boxes({ boxes }: BoxesProps) {
  return (
    <>
      {boxes.map((box, index) => {
        const visualLength = Math.max(1, box.length - VISUAL_GAP_MM)
        const visualHeight = Math.max(1, box.height - VISUAL_GAP_MM)
        const visualWidth = Math.max(1, box.width - VISUAL_GAP_MM)

        return (
          <mesh
            key={`${index}-${box.x}-${box.y}-${box.z}`}
            position={[box.x, box.y, box.z]}
            castShadow
          >
            <boxGeometry args={[visualLength, visualHeight, visualWidth]} />
            <meshStandardMaterial
              color={box.color ?? DEFAULT_BOX_COLOR}
              roughness={0.55}
              metalness={0.02}
            />
            <Edges threshold={15} color="#0c4950" />
          </mesh>
        )
      })}
    </>
  )
}
