import { Suspense, useEffect } from 'react'
import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import type { BoxInstance, DimensionsMM } from '../types'
import { Boxes } from './Boxes'
import { Pallet, PalletFallback } from './Pallet'

interface SceneMultiProps {
  pallet: DimensionsMM
  boxes: BoxInstance[]
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

export function SceneMulti({ pallet, boxes, onCanvasReady }: SceneMultiProps) {
  return (
    <div className="scene-frame">
      <Canvas
        shadows
        camera={{ position: [2200, 1600, 2200], fov: 42, near: 1, far: 12000 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <color attach="background" args={['#f6efe4']} />
        <fog attach="fog" args={['#f6efe4', 2500, 5600]} />

        <ambientLight intensity={0.5} />
        <directionalLight
          position={[1800, 2500, 900]}
          intensity={1.15}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />

        <Suspense
          fallback={
            <PalletFallback
              length={pallet.length}
              width={pallet.width}
              height={pallet.height}
            />
          }
        >
          <Pallet length={pallet.length} width={pallet.width} height={pallet.height} />
        </Suspense>
        <Boxes boxes={boxes} />

        <gridHelper args={[3000, 30, '#ba9f84', '#d8c5b2']} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        <CanvasReporter onReady={onCanvasReady} />
      </Canvas>
    </div>
  )
}
