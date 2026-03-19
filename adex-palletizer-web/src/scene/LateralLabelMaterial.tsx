import type { Texture } from 'three'

export function getLateralTextureBlend(normalY: number) {
  const value = Math.abs(normalY)
  if (value <= 0.45) {
    return 1
  }
  if (value >= 0.75) {
    return 0
  }
  return 1 - (value - 0.45) / (0.75 - 0.45)
}

export function getLabelPatchBlend(u: number, v: number) {
  const withinX = u >= 0.22 && u <= 0.78
  const withinY = v >= 0.18 && v <= 0.62
  return withinX && withinY ? 1 : 0
}

function applyLateralTextureOnly(shader: {
  vertexShader: string
  fragmentShader: string
}, textureMode: 'full' | 'patch') {
  shader.vertexShader = `
varying vec3 vLocalNormal;
${shader.vertexShader}`.replace(
    '#include <beginnormal_vertex>',
    `#include <beginnormal_vertex>
vLocalNormal = normal;
`,
  )

  shader.fragmentShader = `
varying vec3 vLocalNormal;
${shader.fragmentShader}`.replace(
    '#include <map_fragment>',
    `#ifdef USE_MAP
vec4 sampledDiffuseColor = texture2D( map, vMapUv );
#ifdef DECODE_VIDEO_TEXTURE
sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
#endif
float lateralBlend = clamp(1.0 - smoothstep(0.45, 0.75, abs(normalize(vLocalNormal).y)), 0.0, 1.0);
float patchBlend = 1.0;
${textureMode === 'patch' ? 'patchBlend = smoothstep(0.22, 0.28, vMapUv.x) * (1.0 - smoothstep(0.72, 0.78, vMapUv.x)) * smoothstep(0.18, 0.24, vMapUv.y) * (1.0 - smoothstep(0.58, 0.64, vMapUv.y));' : ''}
float appliedBlend = clamp(lateralBlend * patchBlend, 0.0, 1.0);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * sampledDiffuseColor.rgb, appliedBlend);
#endif`,
  )
}

interface LateralLabelMaterialProps {
  color: string
  texture?: Texture | null
  roughness?: number
  metalness?: number
  attach?: string
  textureMode?: 'full' | 'patch'
}

export function LateralLabelMaterial({
  color,
  texture = null,
  roughness = 0.55,
  metalness = 0.02,
  attach,
  textureMode = 'full',
}: LateralLabelMaterialProps) {
  return (
    <meshStandardMaterial
      attach={attach}
      color={texture ? '#ffffff' : color}
      map={texture ?? undefined}
      roughness={roughness}
      metalness={metalness}
      customProgramCacheKey={() =>
        texture ? `lateral-label-mask-${textureMode}-v2` : 'base-material-v1'
      }
      onBeforeCompile={(shader) => {
        if (!texture) {
          return
        }
        applyLateralTextureOnly(shader, textureMode)
      }}
    />
  )
}
