import { BufferGeometry, Mesh, Object3D, Vector3 } from 'three'

const EPSILON = 1e-6

function computeBoundingVolume(geometry: BufferGeometry): number {
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  if (!bounds) {
    return 0
  }

  const size = new Vector3()
  bounds.getSize(size)
  return Math.max(0, Math.abs(size.x * size.y * size.z))
}

export function bakeMeshWorldGeometry(mesh: Mesh): BufferGeometry | null {
  if (!mesh.geometry) {
    return null
  }

  mesh.updateWorldMatrix(true, false)
  const geometry = mesh.geometry.clone()
  geometry.applyMatrix4(mesh.matrixWorld)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

export function pickLargestBakedGeometry(root: Object3D): BufferGeometry | null {
  let largest: BufferGeometry | null = null
  let largestVolume = -1

  root.traverse((object) => {
    if (!(object as Mesh).isMesh) {
      return
    }

    const baked = bakeMeshWorldGeometry(object as Mesh)
    if (!baked) {
      return
    }

    const volume = computeBoundingVolume(baked)
    if (volume > largestVolume) {
      largestVolume = volume
      largest = baked
      return
    }

    baked.dispose()
  })

  return largest
}

export function normalizeSackGeometry(source: BufferGeometry): BufferGeometry | null {
  const geometry = source.clone()
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  if (!bounds) {
    geometry.dispose()
    return null
  }

  const center = new Vector3()
  const size = new Vector3()
  bounds.getCenter(center)
  bounds.getSize(size)

  const safeX = Math.max(EPSILON, size.x)
  const safeY = Math.max(EPSILON, size.y)
  const safeZ = Math.max(EPSILON, size.z)

  // Center in X/Z but keep base contact in Y.
  geometry.translate(-center.x, -bounds.min.y, -center.z)
  geometry.scale(1 / safeX, 1 / safeY, 1 / safeZ)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

