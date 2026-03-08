import { Edges, OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { InstancedMesh, Object3D } from 'three'
import { VISUAL_GAP_MM } from '../constants'
import { groupLoadBoxesForInstancing } from '../containerPalletLoad'
import { getTextureForDataUrl, resolveSkuTextureDataUrl } from '../labels/labelTextures'
import type {
  BoxSkinMode,
  ContainerInput,
  ContainerResult,
  ExportedPalletLoad,
  SkuLabelsBySku,
} from '../types'
import { Pallet, PalletFallback } from './Pallet'
import { useSackTemplate } from './Sack'

interface SceneContainerProps {
  input: ContainerInput
  result: ContainerResult
  palletLoad?: ExportedPalletLoad | null
  labelsBySku?: SkuLabelsBySku
  boxSkinMode?: BoxSkinMode
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
  textureDataUrl?: string | null
  instances: InstanceTransform[]
  applyVisualGap?: boolean
  gapMm?: number
  boxSkinMode?: BoxSkinMode
  sackTemplate?: ReturnType<typeof useSackTemplate>
}

interface LoadInstancedGroup extends InstancedBoxGroupProps {
  key: string
}

interface PalletModelPlacement {
  key: string
  x: number
  y: number
  z: number
  rotationY: number
  length: number
  width: number
  height: number
}

function InstancedBoxGroup({
  length,
  width,
  height,
  color,
  textureDataUrl = null,
  instances,
  applyVisualGap = false,
  gapMm = VISUAL_GAP_MM,
  boxSkinMode = 'box',
  sackTemplate = null,
}: InstancedBoxGroupProps) {
  const meshRef = useRef<InstancedMesh>(null)
  const texture = useMemo(() => {
    if (!textureDataUrl) {
      return null
    }
    return getTextureForDataUrl(textureDataUrl)
  }, [textureDataUrl])

  const visualLength = Math.max(1, length - (applyVisualGap ? gapMm : 0))
  const visualHeight = Math.max(1, height - (applyVisualGap ? gapMm : 0))
  const visualWidth = Math.max(1, width - (applyVisualGap ? gapMm : 0))
  const useSack = boxSkinMode === 'sack' && sackTemplate !== null

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) {
      return
    }

    const dummy = new Object3D()

    instances.forEach((instance, index) => {
      dummy.position.set(instance.x, instance.y, instance.z)
      dummy.rotation.set(0, instance.rotationY, 0)
      if (useSack) {
        dummy.scale.set(visualLength, visualHeight, visualWidth)
      } else {
        dummy.scale.set(1, 1, 1)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })

    mesh.instanceMatrix.needsUpdate = true
  }, [instances, useSack, visualHeight, visualLength, visualWidth])

  if (instances.length === 0) {
    return null
  }

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, instances.length]} castShadow>
      {useSack ? (
        <primitive attach="geometry" object={sackTemplate.geometry} />
      ) : (
        <boxGeometry args={[visualLength, visualHeight, visualWidth]} />
      )}
      <meshStandardMaterial
        color={texture ? '#ffffff' : color}
        map={texture ?? undefined}
        roughness={0.55}
        metalness={0.02}
      />
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
  labelsBySku = {},
  boxSkinMode = 'box',
  onCanvasReady,
}: SceneContainerProps) {
  const containerLength = input.container.length
  const containerWidth = input.container.width
  const containerHeight = input.container.height
  const sceneScale = Math.max(containerLength, containerWidth, containerHeight)
  const sackTemplate = useSackTemplate()

  const basePalletModels = useMemo<PalletModelPlacement[]>(() => {
    return result.placements.map((placement, index) => {
      const floorY = placement.y - placement.height / 2
      const length = palletLoad ? palletLoad.palletLengthMm : placement.length
      const width = palletLoad ? palletLoad.palletWidthMm : placement.width
      const height = palletLoad ? palletLoad.palletHeightMm : Math.min(170, placement.height)
      return {
        key: `container-pallet-${index}`,
        x: placement.x,
        y: floorY,
        z: placement.z,
        rotationY: placement.rotated ? Math.PI / 2 : 0,
        length,
        width,
        height,
      }
    })
  }, [palletLoad, result.placements])

  const legacyLoadBlocks = useMemo<LoadInstancedGroup[]>(() => {
    if (palletLoad) {
      return []
    }

    const groups: LoadInstancedGroup[] = []
    result.placements.forEach((placement, index) => {
      const baseHeight = Math.min(170, placement.height)
      const remainingHeight = Math.max(0, placement.height - baseHeight)
      if (remainingHeight <= 0) {
        return
      }

      groups.push({
        key: `legacy-load-${index}`,
        length: placement.length,
        width: placement.width,
        height: remainingHeight,
        color: '#2f8f9d',
        applyVisualGap: false,
        instances: [
          {
            x: placement.x,
            y: placement.y - placement.height / 2 + baseHeight + remainingHeight / 2,
            z: placement.z,
            rotationY: placement.rotated ? Math.PI / 2 : 0,
          },
        ],
      })
    })

    return groups
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
          applyVisualGap: false,
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
        textureDataUrl: resolveSkuTextureDataUrl(labelsBySku, group.skuId),
        applyVisualGap: false,
        instances,
      }
    })
  }, [labelsBySku, palletLoad, result.placements])

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
            {basePalletModels.map((placement) => (
              <group
                key={placement.key}
                position={[placement.x, placement.y, placement.z]}
                rotation={[0, placement.rotationY, 0]}
              >
                <Suspense
                  fallback={
                    <PalletFallback
                      length={placement.length}
                      width={placement.width}
                      height={placement.height}
                    />
                  }
                >
                  <Pallet
                    length={placement.length}
                    width={placement.width}
                    height={placement.height}
                  />
                </Suspense>
              </group>
            ))}
            {loadGroups.map((group) => (
              <InstancedBoxGroup
                key={group.key}
                length={group.length}
                width={group.width}
                height={group.height}
                color={group.color}
                textureDataUrl={group.textureDataUrl}
                instances={group.instances}
                applyVisualGap={group.applyVisualGap}
                boxSkinMode={boxSkinMode}
                sackTemplate={sackTemplate}
              />
            ))}
          </>
        ) : (
          <>
            {basePalletModels.map((placement) => (
              <group
                key={placement.key}
                position={[placement.x, placement.y, placement.z]}
                rotation={[0, placement.rotationY, 0]}
              >
                <Suspense
                  fallback={
                    <PalletFallback
                      length={placement.length}
                      width={placement.width}
                      height={placement.height}
                    />
                  }
                >
                  <Pallet
                    length={placement.length}
                    width={placement.width}
                    height={placement.height}
                  />
                </Suspense>
              </group>
            ))}
            {legacyLoadBlocks.map((group) => (
              <InstancedBoxGroup
                key={group.key}
                length={group.length}
                width={group.width}
                height={group.height}
                color={group.color}
                textureDataUrl={group.textureDataUrl}
                instances={group.instances}
                applyVisualGap={group.applyVisualGap}
                boxSkinMode={boxSkinMode}
                sackTemplate={sackTemplate}
              />
            ))}
          </>
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
