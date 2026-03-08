/* eslint-disable react-refresh/only-export-components */
import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { BufferGeometry, Texture } from 'three'
import { normalizeSackGeometry, pickLargestBakedGeometry } from './sackGeometry'

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

export function useSackTemplate(): SackTemplate | null {
  const gltf = useGLTF(SACK_MODEL_PATH)

  return useMemo(() => {
    const bakedGeometry = pickLargestBakedGeometry(gltf.scene)
    if (!bakedGeometry) {
      return null
    }

    const geometry = normalizeSackGeometry(bakedGeometry)
    bakedGeometry.dispose()
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
      position={[0, -height / 2, 0]}
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
