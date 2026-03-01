import { Edges, OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { InstancedMesh, Object3D } from 'three'
import { VISUAL_GAP_MM } from '../constants'
import { groupLoadBoxesForInstancing } from '../containerPalletLoad'
import type {
  BoxInstance,
  ContainerInput,
  ContainerResult,
  ExportedPalletLoad,
} from '../types'
import { Boxes } from './Boxes'

interface SceneContainerProps {
  input: ContainerInput
  result: ContainerResult
  palletLoad?: ExportedPalletLoad | null
  onCanvasReady?: (canvas: HTMLCanvasElement) => void
}

interface CanvasReporterProps {
  onReady?: (canvas: HTMLCanvasElement) => void
}

interface InstanceTransform {
  x: number
  y: number
  z: number
  rotationY: number
}

interface InstancedBoxGroupProps {
  length: number
  width: number
  height: number
  color: string
  instances: InstanceTransform[]
  applyVisualGap?: boolean
}

interface LoadInstancedGroup extends InstancedBoxGroupProps {
  key: string
}

function InstancedBoxGroup({
  length,
  width,
  height,
  color,
  instances,
  applyVisualGap = false,
}: InstancedBoxGroupProps) {
  const meshRef = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) {
      return
    }

    const dummy = new Object3D()

    instances.forEach((instance, index) => {
      dummy.position.set(instance.x, instance.y, instance.z)
      dummy.rotation.set(0, instance.rotationY, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })

    mesh.instanceMatrix.needsUpdate = true
  }, [instances])

  if (instances.length === 0) {
    return null
  }

  const visualLength = Math.max(1, length - (applyVisualGap ? VISUAL_GAP_MM : 0))
  const visualHeight = Math.max(1, height - (applyVisualGap ? VISUAL_GAP_MM : 0))
  const visualWidth = Math.max(1, width - (applyVisualGap ? VISUAL_GAP_MM : 0))

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, instances.length]} castShadow>
      <boxGeometry args={[visualLength, visualHeight, visualWidth]} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.02} />
    </instancedMesh>
  )
}

function CanvasReporter({ onReady }: CanvasReporterProps) {
  const { gl } = useThree()

  useEffect(() => {
    if (onReady) {
      onReady(gl.domElement)
    }
  }, [gl, onReady])

  return null
}

export function SceneContainer({
  input,
  result,
  palletLoad = null,
  onCanvasReady,
}: SceneContainerProps) {
  const containerLength = input.container.length
  const containerWidth = input.container.width
  const containerHeight = input.container.height
  const sceneScale = Math.max(containerLength, containerWidth, containerHeight)

  const legacyPalletBoxes = useMemo<BoxInstance[]>(
    () =>
      result.placements.map((placement) => ({
        x: placement.x,
        y: placement.y,
        z: placement.z,
        length: placement.length,
        width: placement.width,
        height: placement.height,
        color: '#94653a',
      })),
    [result.placements],
  )

  const basePalletInstances = useMemo<InstanceTransform[]>(() => {
    if (!palletLoad) {
      return []
    }

    return result.placements.map((placement) => {
      const floorY = placement.y - placement.height / 2
      return {
        x: placement.x,
        y: floorY + palletLoad.palletHeightMm / 2,
        z: placement.z,
        rotationY: placement.rotated ? Math.PI / 2 : 0,
      }
    })
  }, [palletLoad, result.placements])

  const loadGroups = useMemo<LoadInstancedGroup[]>(() => {
    if (!palletLoad) {
      return []
    }

    if (result.placements.length === 0) {
      return []
    }

    if (palletLoad.boxesPlacements.length === 0) {
      const fallbackHeight = Math.max(
        1,
        palletLoad.loadTotalHeightMm - palletLoad.palletHeightMm,
      )
      return [
        {
          key: 'fallback-load',
          length: palletLoad.palletLengthMm,
          width: palletLoad.palletWidthMm,
          height: fallbackHeight,
          color: '#2f8f9d',
          applyVisualGap: true,
          instances: result.placements.map((placement) => {
            const floorY = placement.y - placement.height / 2
            return {
              x: placement.x,
              y: floorY + palletLoad.palletHeightMm + fallbackHeight / 2,
              z: placement.z,
              rotationY: placement.rotated ? Math.PI / 2 : 0,
            }
          }),
        },
      ]
    }

    const groupedBoxes = groupLoadBoxesForInstancing(palletLoad.boxesPlacements)
    return groupedBoxes.map((group, groupIndex) => {
      const instances: InstanceTransform[] = []

      result.placements.forEach((placement) => {
        const floorY = placement.y - placement.height / 2
        const rotated = placement.rotated
        const rotationY = rotated ? Math.PI / 2 : 0

        group.boxes.forEach((box) => {
          const offsetX = rotated ? box.zMm : box.xMm
          const offsetZ = rotated ? -box.xMm : box.zMm
          instances.push({
            x: placement.x + offsetX,
            y: floorY + palletLoad.palletHeightMm + box.yMm,
            z: placement.z + offsetZ,
            rotationY,
          })
        })
      })

      return {
        key: `load-group-${groupIndex}`,
        length: group.lengthMm,
        width: group.widthMm,
        height: group.heightMm,
        color: group.color,
        applyVisualGap: true,
        instances,
      }
    })
  }, [palletLoad, result.placements])

  return (
    <div className="scene-frame">
      <Canvas
        shadows
        camera={{
          position: [sceneScale * 1.15, sceneScale * 0.95, sceneScale * 1.15],
          fov: 42,
          near: 1,
          far: sceneScale * 20,
        }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <color attach="background" args={['#f6efe4']} />

        <ambientLight intensity={0.52} />
        <directionalLight
          position={[sceneScale * 0.8, sceneScale * 1.5, sceneScale * 0.55]}
          intensity={1.08}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />

        <mesh position={[0, containerHeight / 2, 0]}>
          <boxGeometry args={[containerLength, containerHeight, containerWidth]} />
          <meshStandardMaterial
            color="#b9c7d4"
            transparent
            opacity={0.12}
            roughness={0.8}
            metalness={0.05}
          />
          <Edges threshold={15} color="#5f7284" />
        </mesh>

        {palletLoad ? (
          <>
            <InstancedBoxGroup
              length={palletLoad.palletLengthMm}
              width={palletLoad.palletWidthMm}
              height={palletLoad.palletHeightMm}
              color="#94653a"
              instances={basePalletInstances}
            />
            {loadGroups.map((group) => (
              <InstancedBoxGroup
                key={group.key}
                length={group.length}
                width={group.width}
                height={group.height}
                color={group.color}
                instances={group.instances}
                applyVisualGap={group.applyVisualGap}
              />
            ))}
          </>
        ) : (
          <Boxes boxes={legacyPalletBoxes} />
        )}

        <gridHelper
          args={[Math.max(sceneScale * 1.8, 3000), 30, '#ba9f84', '#d8c5b2']}
        />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        <CanvasReporter onReady={onCanvasReady} />
      </Canvas>
    </div>
  )
}
