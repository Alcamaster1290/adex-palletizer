import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { Box3, Mesh, Object3D, Vector3 } from 'three'

interface PalletProps {
  length: number
  width: number
  height: number
}

const PALLET_MODEL_PATH = '/models/pallet.glb'

interface FittedModelData {
  clonedScene: Object3D
  position: [number, number, number]
  scale: [number, number, number]
}

export function PalletFallback({ length, width, height }: PalletProps) {
  return (
    <mesh position={[0, height / 2, 0]} receiveShadow castShadow>
      <boxGeometry args={[length, height, width]} />
      <meshStandardMaterial color="#a86b3c" roughness={0.85} metalness={0.05} />
    </mesh>
  )
}

export function Pallet({ length, width, height }: PalletProps) {
  const gltf = useGLTF(PALLET_MODEL_PATH)

  const fittedModel = useMemo<FittedModelData>(() => {
    const clonedScene = gltf.scene.clone(true)
    clonedScene.traverse((object) => {
      if ((object as Mesh).isMesh) {
        const mesh = object as Mesh
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })

    const bounds = new Box3().setFromObject(clonedScene)
    const size = new Vector3()
    const center = new Vector3()
    bounds.getSize(size)
    bounds.getCenter(center)

    const scaleX = size.x > 0 ? length / size.x : 1
    const scaleY = size.y > 0 ? height / size.y : 1
    const scaleZ = size.z > 0 ? width / size.z : 1

    const position: [number, number, number] = [
      -center.x * scaleX,
      -bounds.min.y * scaleY,
      -center.z * scaleZ,
    ]

    return {
      clonedScene,
      position,
      scale: [scaleX, scaleY, scaleZ],
    }
  }, [gltf.scene, length, width, height])

  return (
    <primitive
      object={fittedModel.clonedScene}
      position={fittedModel.position}
      scale={fittedModel.scale}
    />
  )
}

useGLTF.preload(PALLET_MODEL_PATH)
