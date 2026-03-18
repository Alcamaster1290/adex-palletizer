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
  ContainerPalletCatalogEntry,
  ContainerResult,
  ExportedPalletLoad,
  SkuLabelsBySku,
} from '../types'
import { Pallet, PalletFallback } from './Pallet'
import { LateralLabelMaterial } from './LateralLabelMaterial'
import { useSackTemplate } from './Sack'
import { resolveSackPatternTransform } from './sackPattern'
import { resolveSackVisualProfile } from './sackVisual'

interface SceneContainerProps {
  input: ContainerInput
  result: ContainerResult
  palletLoad?: ExportedPalletLoad | null
  palletCatalog?: ContainerPalletCatalogEntry[]
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
  isStacked?: boolean
  layerIndex?: number
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
      const sackVisual = useSack
        ? resolveSackVisualProfile(length, width, height, Boolean(instance.isStacked))
        : null
      const patternTransform = useSack
        ? resolveSackPatternTransform(
            sackVisual?.visualLength ?? visualLength,
            sackVisual?.visualWidth ?? visualWidth,
            instance.layerIndex ?? 0,
            instance.z,
          )
        : { offsetX: 0, offsetZ: 0 }
      const resolvedY = useSack
        ? instance.y + (sackVisual?.gravityOffsetY ?? -visualHeight / 2)
        : instance.y
      dummy.position.set(
        instance.x + patternTransform.offsetX,
        resolvedY,
        instance.z + patternTransform.offsetZ,
      )
      dummy.rotation.set(0, instance.rotationY, 0)
      if (useSack) {
        dummy.scale.set(
          sackVisual?.visualLength ?? visualLength,
          sackVisual?.visualHeight ?? visualHeight,
          sackVisual?.visualWidth ?? visualWidth,
        )
      } else {
        dummy.scale.set(1, 1, 1)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })

    mesh.instanceMatrix.needsUpdate = true
  }, [height, instances, length, useSack, visualHeight, visualLength, visualWidth, width])

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
      <LateralLabelMaterial
        color={color}
        texture={texture}
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
  palletCatalog = [],
  labelsBySku = {},
  boxSkinMode = 'box',
  onCanvasReady,
}: SceneContainerProps) {
  const containerLength = input.container.length
  const containerWidth = input.container.width
  const containerHeight = input.container.height
  const sceneScale = Math.max(containerLength, containerWidth, containerHeight)
  const sackTemplate = useSackTemplate()
  const palletCatalogMap = useMemo(
    () => new Map(palletCatalog.map((entry) => [entry.id, entry])),
    [palletCatalog],
  )
  const hasConsolidatedCatalog = palletCatalog.length > 0

  const basePalletModels = useMemo<PalletModelPlacement[]>(() => {
    return result.placements.map((placement, index) => {
      const floorY = placement.y - placement.height / 2
      const catalogEntry =
        hasConsolidatedCatalog && placement.palletTypeId
          ? palletCatalogMap.get(placement.palletTypeId)
          : null
      const activeLoad = catalogEntry?.load ?? palletLoad
      const length = activeLoad ? activeLoad.palletLengthMm : placement.length
      const width = activeLoad ? activeLoad.palletWidthMm : placement.width
      const height = activeLoad ? activeLoad.palletHeightMm : Math.min(170, placement.height)
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
  }, [hasConsolidatedCatalog, palletCatalogMap, palletLoad, result.placements])

  const legacyLoadBlocks = useMemo<LoadInstancedGroup[]>(() => {
    if (palletLoad || hasConsolidatedCatalog) {
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
            isStacked: false,
            layerIndex: 0,
          },
        ],
      })
    })

    return groups
  }, [hasConsolidatedCatalog, palletLoad, result.placements])

  const loadGroups = useMemo<LoadInstancedGroup[]>(() => {
    if (hasConsolidatedCatalog) {
      const grouped = new Map<string, LoadInstancedGroup>()

      result.placements.forEach((placement) => {
        if (!placement.palletTypeId) {
          return
        }

        const entry = palletCatalogMap.get(placement.palletTypeId)
        if (!entry) {
          return
        }

        const load = entry.load
        const floorY = placement.y - placement.height / 2
        const rotationY = placement.rotated ? Math.PI / 2 : 0

        if (!load || load.boxesPlacements.length === 0) {
          const fallbackHeight = Math.max(1, placement.height - Math.min(170, placement.height))
          if (fallbackHeight <= 0) {
            return
          }

          const key = `catalog-fallback-${entry.id}`
          const existing = grouped.get(key)
          const instance = {
            x: placement.x,
            y: floorY + Math.min(170, placement.height) + fallbackHeight / 2,
            z: placement.z,
            rotationY,
            isStacked: false,
            layerIndex: 0,
          }

          if (existing) {
            existing.instances.push(instance)
            return
          }

          grouped.set(key, {
            key,
            length: placement.length,
            width: placement.width,
            height: fallbackHeight,
            color: entry.color ?? '#2f8f9d',
            applyVisualGap: false,
            instances: [instance],
          })
          return
        }

        const groupedBoxes = groupLoadBoxesForInstancing(load.boxesPlacements)
        groupedBoxes.forEach((group, groupIndex) => {
          const key = `${entry.id}-${groupIndex}-${group.lengthMm}-${group.widthMm}-${group.heightMm}-${group.skuId ?? ''}`
          const existing = grouped.get(key)
          const target =
            existing ??
            ({
              key,
              length: group.lengthMm,
              width: group.widthMm,
              height: group.heightMm,
              color: group.color,
              textureDataUrl: resolveSkuTextureDataUrl(labelsBySku, group.skuId),
              applyVisualGap: false,
              instances: [],
            } satisfies LoadInstancedGroup)

          group.boxes.forEach((box) => {
            const offsetX = placement.rotated ? box.zMm : box.xMm
            const offsetZ = placement.rotated ? -box.xMm : box.zMm
            target.instances.push({
              x: placement.x + offsetX,
              y: floorY + load.palletHeightMm + box.yMm,
              z: placement.z + offsetZ,
              rotationY,
              isStacked: box.yMm - box.heightMm / 2 > 0.5,
              layerIndex: Math.max(
                0,
                Math.round((box.yMm - box.heightMm / 2) / Math.max(1, box.heightMm)),
              ),
            })
          })

          if (!existing) {
            grouped.set(key, target)
          }
        })
      })

      return Array.from(grouped.values())
    }

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
              isStacked: false,
              layerIndex: 0,
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
            isStacked: box.yMm - box.heightMm / 2 > 0.5,
            layerIndex: Math.max(
              0,
              Math.round((box.yMm - box.heightMm / 2) / Math.max(1, box.heightMm)),
            ),
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
  }, [hasConsolidatedCatalog, labelsBySku, palletCatalogMap, palletLoad, result.placements])

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

        {palletLoad || hasConsolidatedCatalog ? (
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
