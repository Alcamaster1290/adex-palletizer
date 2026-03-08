/* eslint-disable react-refresh/only-export-components */
import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import {
  BufferGeometry,
  Mesh,
  Object3D,
  Texture,
  Vector3,
} from 'three'

const SACK_MODEL_PATH = '/models/gunny-sack.glb'

export interface SackTemplate {
  geometry: BufferGeometry
}

interface SackFallbackProps {
  length: number
  width: number
  height: number
  color: string
  texture?: Texture | null
}

export function SackFallback({
  length,
  width,
  height,
  color,
  texture = null,
}: SackFallbackProps) {
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[length, height, width]} />
      <meshStandardMaterial
        color={texture ? '#ffffff' : color}
        map={texture ?? undefined}
        roughness={0.62}
        metalness={0.02}
      />
    </mesh>
  )
}

function getLargestMesh(root: Object3D): Mesh | null {
  let largest: Mesh | null = null
  let largestVolume = -1

  root.traverse((object) => {
    if (!(object as Mesh).isMesh) {
      return
    }

    const mesh = object as Mesh
    const geometry = mesh.geometry
    if (!geometry) {
      return
    }

    if (!geometry.boundingBox) {
      geometry.computeBoundingBox()
    }

    if (!geometry.boundingBox) {
      return
    }

    const size = new Vector3()
    geometry.boundingBox.getSize(size)
    const volume = Math.abs(size.x * size.y * size.z)
    if (volume > largestVolume) {
      largestVolume = volume
      largest = mesh
    }
  })

  return largest
}

function buildNormalizedGeometry(source: BufferGeometry): BufferGeometry | null {
  const geometry = source.clone()
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  if (!bounds) {
    return null
  }

  const center = new Vector3()
  const size = new Vector3()
  bounds.getCenter(center)
  bounds.getSize(size)

  const safeX = size.x > 0 ? size.x : 1
  const safeY = size.y > 0 ? size.y : 1
  const safeZ = size.z > 0 ? size.z : 1

  geometry.translate(-center.x, -center.y, -center.z)
  geometry.scale(1 / safeX, 1 / safeY, 1 / safeZ)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

export function useSackTemplate(): SackTemplate | null {
  const gltf = useGLTF(SACK_MODEL_PATH)

  return useMemo(() => {
    const mesh = getLargestMesh(gltf.scene)
    if (!mesh) {
      return null
    }

    const geometry = buildNormalizedGeometry(mesh.geometry)
    if (!geometry) {
      return null
    }

    return {
      geometry,
    }
  }, [gltf.scene])
}

interface SackMeshProps {
  template: SackTemplate | null
  length: number
  width: number
  height: number
  color: string
  texture?: Texture | null
}

export function SackMesh({
  template,
  length,
  width,
  height,
  color,
  texture = null,
}: SackMeshProps) {
  if (!template) {
    return (
      <SackFallback
        length={length}
        width={width}
        height={height}
        color={color}
        texture={texture}
      />
    )
  }

  return (
    <mesh
      geometry={template.geometry}
      castShadow
      receiveShadow
      scale={[length, height, width]}
    >
      <meshStandardMaterial
        color={texture ? '#ffffff' : color}
        map={texture ?? undefined}
        roughness={0.72}
        metalness={0.01}
      />
    </mesh>
  )
}

useGLTF.preload(SACK_MODEL_PATH)
