/* eslint-disable react-refresh/only-export-components */
import { useMemo } from 'react'
import { BufferGeometry, Texture } from 'three'
import { createWarehouseSackGeometry } from './sackGeometry'

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
  return useMemo(() => {
    const geometry = createWarehouseSackGeometry()
    if (!geometry) {
      return null
    }

    return {
      geometry,
    }
  }, [])
}

interface SackMeshProps {
  template: SackTemplate | null
  length: number
  width: number
  height: number
  gravityOffsetY?: number
  color: string
  texture?: Texture | null
}

export function SackMesh({
  template,
  length,
  width,
  height,
  gravityOffsetY = -height / 2,
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
      position={[0, gravityOffsetY, 0]}
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
