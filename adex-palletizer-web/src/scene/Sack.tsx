/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useState } from 'react'
import { BufferGeometry, Texture } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  createWarehouseSackGeometry,
  normalizeSackGeometry,
  pickLargestBakedGeometry,
} from './sackGeometry'

export interface SackTemplate {
  geometry: BufferGeometry
}

const WAREHOUSE_SACK_MODEL_URL = '/models/warehouse-sack.glb'

let cachedSackGeometry: BufferGeometry | null = null
let loadingSackGeometry: Promise<BufferGeometry | null> | null = null

function buildFallbackSackGeometry(): BufferGeometry | null {
  if (cachedSackGeometry) {
    return cachedSackGeometry
  }

  const fallback = createWarehouseSackGeometry()
  if (!fallback) {
    return null
  }

  cachedSackGeometry = fallback
  return fallback
}

function loadWarehouseSackGeometry(): Promise<BufferGeometry | null> {
  if (cachedSackGeometry) {
    return Promise.resolve(cachedSackGeometry)
  }

  if (loadingSackGeometry) {
    return loadingSackGeometry
  }

  loadingSackGeometry = new Promise((resolve) => {
    const loader = new GLTFLoader()
    loader.load(
      WAREHOUSE_SACK_MODEL_URL,
      (gltf) => {
        const bakedGeometry = pickLargestBakedGeometry(gltf.scene)
        const normalizedGeometry = bakedGeometry
          ? normalizeSackGeometry(bakedGeometry)
          : null

        bakedGeometry?.dispose()

        if (!normalizedGeometry) {
          resolve(buildFallbackSackGeometry())
          loadingSackGeometry = null
          return
        }

        cachedSackGeometry = normalizedGeometry
        resolve(normalizedGeometry)
        loadingSackGeometry = null
      },
      undefined,
      () => {
        resolve(buildFallbackSackGeometry())
        loadingSackGeometry = null
      },
    )
  })

  return loadingSackGeometry
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
  const [geometry, setGeometry] = useState<BufferGeometry | null>(
    cachedSackGeometry,
  )

  useEffect(() => {
    let active = true

    loadWarehouseSackGeometry().then((loadedGeometry) => {
      if (!active) {
        return
      }
      setGeometry(loadedGeometry)
    })

    return () => {
      active = false
    }
  }, [])

  return useMemo(() => {
    if (!geometry) {
      return null
    }

    return { geometry }
  }, [geometry])
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
