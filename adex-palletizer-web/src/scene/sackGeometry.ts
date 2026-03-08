import { BoxGeometry, BufferGeometry, Mesh, Object3D, Vector3 } from 'three'

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

export function createWarehouseSackGeometry(): BufferGeometry | null {
  const geometry = new BoxGeometry(1, 1, 1, 14, 6, 10)
  const position = geometry.getAttribute('position')

  for (let index = 0; index < position.count; index += 1) {
    const baseX = position.getX(index)
    const baseY = position.getY(index)
    const baseZ = position.getZ(index)

    const nx = baseX / 0.5
    const ny = baseY / 0.5
    const nz = baseZ / 0.5

    const midBand = Math.max(0, 1 - Math.abs(ny))
    const endTaper = 1 - 0.04 * Math.pow(Math.abs(nx), 2.2)
    const sideSoftening = 1 - 0.03 * Math.pow(Math.abs(nz), 2)

    let nextX = baseX * (0.985 + midBand * 0.015)
    let nextY = baseY * (0.91 + 0.09 * (1 - Math.max(Math.abs(nx), Math.abs(nz))))
    let nextZ = baseZ * (0.985 + midBand * 0.015)

    nextX *= sideSoftening
    nextZ *= endTaper

    if (ny > 0.15) {
      nextY += 0.035 * (1 - Math.abs(nx)) * (1 - Math.abs(nz))
    }

    if (ny < -0.55) {
      nextY += (-0.55 - ny) * 0.055
      nextX *= 1.01
      nextZ *= 1.01
    }

    position.setXYZ(index, nextX, nextY, nextZ)
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()

  const normalized = normalizeSackGeometry(geometry)
  geometry.dispose()
  return normalized
}
