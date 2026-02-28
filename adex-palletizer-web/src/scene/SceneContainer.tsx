import { Edges, OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import type { BoxInstance, ContainerInput, ContainerResult } from '../types'
import { Boxes } from './Boxes'

interface SceneContainerProps {
  input: ContainerInput
  result: ContainerResult
  onCanvasReady?: (canvas: HTMLCanvasElement) => void
}

interface CanvasReporterProps {
  onReady?: (canvas: HTMLCanvasElement) => void
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

export function SceneContainer({ input, result, onCanvasReady }: SceneContainerProps) {
  const containerLength = input.container.length
  const containerWidth = input.container.width
  const containerHeight = input.container.height
  const sceneScale = Math.max(containerLength, containerWidth, containerHeight)

  const palletBoxes = useMemo<BoxInstance[]>(
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

        <Boxes boxes={palletBoxes} />

        <gridHelper
          args={[Math.max(sceneScale * 1.8, 3000), 30, '#ba9f84', '#d8c5b2']}
        />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        <CanvasReporter onReady={onCanvasReady} />
      </Canvas>
    </div>
  )
}
