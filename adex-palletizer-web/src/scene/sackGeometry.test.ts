import { BoxGeometry, BufferGeometry, Mesh, Object3D, Vector3 } from 'three'
import {
  bakeMeshWorldGeometry,
  normalizeSackGeometry,
  pickLargestBakedGeometry,
} from './sackGeometry'

function getBoundsSize(geometry: BufferGeometry) {
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  if (!bounds) {
    throw new Error('Bounding box unavailable')
  }
  const size = new Vector3()
  bounds.getSize(size)
  return { bounds, size }
}

describe('sackGeometry helpers', () => {
  it('normalizeSackGeometry centra X/Z y alinea la base en Y=0', () => {
    const source = new BoxGeometry(2, 4, 6)
    source.translate(10, 3, -8)

    const normalized = normalizeSackGeometry(source)
    expect(normalized).not.toBeNull()
    if (!normalized) {
      return
    }

    normalized.computeBoundingBox()
    const bounds = normalized.boundingBox
    expect(bounds).not.toBeNull()
    if (!bounds) {
      return
    }

    expect(bounds.min.x).toBeCloseTo(-0.5, 5)
    expect(bounds.max.x).toBeCloseTo(0.5, 5)
    expect(bounds.min.z).toBeCloseTo(-0.5, 5)
    expect(bounds.max.z).toBeCloseTo(0.5, 5)
    expect(bounds.min.y).toBeCloseTo(0, 5)
    expect(bounds.max.y).toBeCloseTo(1, 5)
  })

  it('bakeMeshWorldGeometry aplica transform del nodo antes de normalizar', () => {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1))
    mesh.position.set(3, 2, -4)
    mesh.scale.set(2, 4, 6)

    const baked = bakeMeshWorldGeometry(mesh)
    expect(baked).not.toBeNull()
    if (!baked) {
      return
    }

    baked.computeBoundingBox()
    const bounds = baked.boundingBox
    expect(bounds).not.toBeNull()
    if (!bounds) {
      return
    }

    expect(bounds.min.x).toBeCloseTo(2, 5)
    expect(bounds.max.x).toBeCloseTo(4, 5)
    expect(bounds.min.y).toBeCloseTo(0, 5)
    expect(bounds.max.y).toBeCloseTo(4, 5)
    expect(bounds.min.z).toBeCloseTo(-7, 5)
    expect(bounds.max.z).toBeCloseTo(-1, 5)
  })

  it('pickLargestBakedGeometry selecciona la malla mayor en espacio mundo', () => {
    const root = new Object3D()
    const small = new Mesh(new BoxGeometry(1, 1, 1))
    const large = new Mesh(new BoxGeometry(1, 1, 1))
    large.scale.set(3, 2, 2)
    root.add(small)
    root.add(large)

    const picked = pickLargestBakedGeometry(root)
    expect(picked).not.toBeNull()
    if (!picked) {
      return
    }

    const { size } = getBoundsSize(picked)
    expect(size.x).toBeCloseTo(3, 5)
    expect(size.y).toBeCloseTo(2, 5)
    expect(size.z).toBeCloseTo(2, 5)
  })
})
