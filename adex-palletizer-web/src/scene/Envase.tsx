/* eslint-disable react-refresh/only-export-components */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Edges, OrbitControls } from '@react-three/drei'
import { useGLTF } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import {
  Box3,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  Vector3,
  type BufferGeometry,
} from 'three'
import { bakeMeshWorldGeometry } from './sackGeometry'
import type { EnvaseAxisAssignment, EnvaseInstance } from '../envaseSolver'
import type { EnvasePreset } from '../envasePresets'
import type { DimensionsMM } from '../types'

interface EnvaseTemplateItem {
  geometry: BufferGeometry
  material: Material
}

interface EnvaseTemplate {
  items: EnvaseTemplateItem[]
  /** Escala por eje que lleva el modelo crudo a las dimensiones del preset (mm), de pie. */
  scale: Vector3
}

/**
 * Rotacion (multiplos de 90 grados) que lleva los ejes del envase de pie
 * (x=fondo, y=alto, z=ancho) a la asignacion de ejes elegida por el solver.
 * Si la permutacion es impar se invierte el eje del ancho para mantener una
 * rotacion propia (el envase es simetrico, el cambio no se percibe).
 */
function buildAxisRotation(ejes: EnvaseAxisAssignment): Matrix4 {
  const columns: Record<'length' | 'height' | 'width', Vector3> = {
    length: new Vector3(),
    height: new Vector3(),
    width: new Vector3(),
  }
  columns[ejes.x].set(1, 0, 0)
  columns[ejes.y].set(0, 1, 0)
  columns[ejes.z].set(0, 0, 1)

  const rotation = new Matrix4().makeBasis(
    columns.length,
    columns.height,
    columns.width,
  )
  if (rotation.determinant() < 0) {
    columns.width.negate()
    rotation.makeBasis(columns.length, columns.height, columns.width)
  }
  return rotation
}

/**
 * Hornea las mallas del GLB a espacio mundo (los scans de Sketchfab traen
 * cadenas de transforms arbitrarias), centra el conjunto en el origen y
 * calcula la escala por eje hacia las dimensiones reales del preset.
 * Convencion de ejes del modelo: Y = alto; de los dos ejes horizontales, el
 * de mayor extension es el ancho frontal y el menor es el fondo/gusset, de
 * modo que cambiar de modelo (250gr/340gr o el diseno real) sea trivial.
 */
function buildEnvaseTemplate(
  scene: import('three').Object3D,
  preset: DimensionsMM,
): EnvaseTemplate | null {
  const items: EnvaseTemplateItem[] = []
  scene.traverse((object) => {
    if (!(object as Mesh).isMesh) {
      return
    }
    const mesh = object as Mesh
    const baked = bakeMeshWorldGeometry(mesh)
    if (!baked) {
      return
    }
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    items.push({ geometry: baked, material })
  })

  if (items.length === 0) {
    return null
  }

  const measure = () => {
    const bounds = new Box3()
    items.forEach((item) => {
      item.geometry.computeBoundingBox()
      if (item.geometry.boundingBox) {
        bounds.union(item.geometry.boundingBox)
      }
    })
    const size = new Vector3()
    const center = new Vector3()
    bounds.getSize(size)
    bounds.getCenter(center)
    return { size, center }
  }

  let { size, center } = measure()

  if (size.x >= size.z) {
    // El modelo trae el ancho frontal sobre X: se rota 90 grados para dejar
    // siempre X = fondo/gusset y Z = ancho (la escala sola no permuta ejes).
    items.forEach((item) => {
      item.geometry.rotateY(Math.PI / 2)
    })
    ;({ size, center } = measure())
  }

  items.forEach((item) => {
    item.geometry.translate(-center.x, -center.y, -center.z)
    item.geometry.computeBoundingBox()
    item.geometry.computeBoundingSphere()
  })

  const scale = new Vector3(
    size.x > 0 ? preset.length / size.x : 1,
    size.y > 0 ? preset.height / size.y : 1,
    size.z > 0 ? preset.width / size.z : 1,
  )

  return { items, scale }
}

interface EnvaseInstancedMeshProps {
  geometry: BufferGeometry
  material: Material
  instances: EnvaseInstance[]
  baseTransform: Matrix4
}

function EnvaseInstancedMesh({
  geometry,
  material,
  instances,
  baseTransform,
}: EnvaseInstancedMeshProps) {
  const meshRef = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) {
      return
    }
    const matrix = new Matrix4()
    instances.forEach((instance, index) => {
      matrix
        .makeTranslation(instance.x, instance.y, instance.z)
        .multiply(baseTransform)
      mesh.setMatrixAt(index, matrix)
    })
    mesh.count = instances.length
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [instances, baseTransform])

  return (
    <instancedMesh
      key={instances.length}
      ref={meshRef}
      args={[geometry, material, Math.max(1, instances.length)]}
      castShadow
      receiveShadow
    />
  )
}

interface EnvaseModelInstancesProps {
  modelPath: string
  preset: DimensionsMM
  instances: EnvaseInstance[]
}

function EnvaseModelInstances({
  modelPath,
  preset,
  instances,
}: EnvaseModelInstancesProps) {
  const gltf = useGLTF(modelPath)

  const template = useMemo(
    () => buildEnvaseTemplate(gltf.scene, preset),
    [gltf.scene, preset],
  )

  const baseTransform = useMemo(() => {
    if (!template || instances.length === 0) {
      return new Matrix4()
    }
    const rotation = buildAxisRotation(instances[0].ejes)
    const scaleMatrix = new Matrix4().makeScale(
      template.scale.x,
      template.scale.y,
      template.scale.z,
    )
    return rotation.multiply(scaleMatrix)
  }, [template, instances])

  if (!template || instances.length === 0) {
    return null
  }

  return (
    <>
      {template.items.map((item, index) => (
        <EnvaseInstancedMesh
          key={index}
          geometry={item.geometry}
          material={item.material}
          instances={instances}
          baseTransform={baseTransform}
        />
      ))}
    </>
  )
}

const ENVASE_FALLBACK_COLOR = '#a9744f'
const ENVASE_VISUAL_GAP_MM = 3

export function EnvaseFallbackInstances({
  instances,
}: {
  instances: EnvaseInstance[]
}) {
  return (
    <>
      {instances.map((instance, index) => (
        <mesh
          key={index}
          position={[instance.x, instance.y, instance.z]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[
              Math.max(1, instance.length - ENVASE_VISUAL_GAP_MM),
              Math.max(1, instance.height - ENVASE_VISUAL_GAP_MM),
              Math.max(1, instance.width - ENVASE_VISUAL_GAP_MM),
            ]}
          />
          <meshStandardMaterial
            color={ENVASE_FALLBACK_COLOR}
            roughness={0.7}
            metalness={0.02}
          />
        </mesh>
      ))}
    </>
  )
}

export function EnvaseInstances({
  preset,
  instances,
}: {
  preset: EnvasePreset
  instances: EnvaseInstance[]
}) {
  if (instances.length === 0) {
    return null
  }

  if (!preset.modelPath) {
    return <EnvaseFallbackInstances instances={instances} />
  }

  return (
    <Suspense fallback={<EnvaseFallbackInstances instances={instances} />}>
      <EnvaseModelInstances
        modelPath={preset.modelPath}
        preset={preset}
        instances={instances}
      />
    </Suspense>
  )
}

interface EnvasePackingSceneProps {
  cajaInterna: DimensionsMM
  preset: EnvasePreset
  instances: EnvaseInstance[]
}

/** Reencuadra la camara cuando cambian las dimensiones de la caja aplicada. */
function EnvaseCameraRig({
  distance,
  targetY,
}: {
  distance: number
  targetY: number
}) {
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    camera.position.set(distance, distance * 0.78, distance)
    camera.lookAt(0, targetY, 0)
    camera.updateProjectionMatrix()
  }, [camera, distance, targetY])

  return null
}

/**
 * Caja de embalaje semi-transparente con los envases acomodados segun el
 * resultado del solver. Misma convencion que Scene.tsx: unidades en mm,
 * origen en el centro de la base de la caja, y hacia arriba.
 */
export function EnvasePackingScene({
  cajaInterna,
  preset,
  instances,
}: EnvasePackingSceneProps) {
  const maxDim = Math.max(
    cajaInterna.length,
    cajaInterna.width,
    cajaInterna.height,
    1,
  )
  const cameraDistance = maxDim * 1.9

  return (
    <div className="scene-frame">
      <Canvas
        shadows
        camera={{
          position: [cameraDistance, cameraDistance * 0.78, cameraDistance],
          fov: 42,
          near: 1,
          far: maxDim * 30,
        }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <color attach="background" args={['#f6efe4']} />

        <ambientLight intensity={0.55} />
        <directionalLight
          position={[maxDim * 1.5, maxDim * 2.2, maxDim * 0.8]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        <EnvaseInstances preset={preset} instances={instances} />

        <mesh position={[0, cajaInterna.height / 2, 0]}>
          <boxGeometry
            args={[cajaInterna.length, cajaInterna.height, cajaInterna.width]}
          />
          <meshStandardMaterial
            color="#b88752"
            transparent
            opacity={0.12}
            depthWrite={false}
          />
          <Edges color="#7a5a36" />
        </mesh>

        <gridHelper
          args={[maxDim * 4, 20, '#ba9f84', '#d8c5b2']}
          position={[0, -0.5, 0]}
        />
        <EnvaseCameraRig
          distance={cameraDistance}
          targetY={cajaInterna.height / 2}
        />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          target={[0, cajaInterna.height / 2, 0]}
        />
      </Canvas>
    </div>
  )
}

export function preloadEnvaseModel(modelPath?: string) {
  if (modelPath) {
    useGLTF.preload(modelPath)
  }
}
