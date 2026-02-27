import { Suspense, useEffect, useMemo } from 'react'
import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { buildBoxInstances } from '../solver'
import type { SolverInput, SolverResult } from '../types'
import { Boxes } from './Boxes'
import { Pallet, PalletFallback } from './Pallet'

interface SceneProps {
  input: SolverInput
  result: SolverResult
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

export function Scene({ input, result, onCanvasReady }: SceneProps) {
  const boxes = useMemo(() => buildBoxInstances(input, result), [input, result])

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
              length={input.pallet.length}
              width={input.pallet.width}
              height={input.pallet.height}
            />
          }
        >
          <Pallet
            length={input.pallet.length}
            width={input.pallet.width}
            height={input.pallet.height}
          />
        </Suspense>
        <Boxes boxes={boxes} />

        <gridHelper args={[3000, 30, '#ba9f84', '#d8c5b2']} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        <CanvasReporter onReady={onCanvasReady} />
      </Canvas>
    </div>
  )
}
