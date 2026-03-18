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

function applyLateralTextureOnly(shader: {
  vertexShader: string
  fragmentShader: string
}) {
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
sampledDiffuseColor.rgb = mix(vec3(1.0), sampledDiffuseColor.rgb, lateralBlend);
diffuseColor *= sampledDiffuseColor;
#endif`,
  )
}

interface LateralLabelMaterialProps {
  color: string
  texture?: Texture | null
  roughness?: number
  metalness?: number
  attach?: string
}

export function LateralLabelMaterial({
  color,
  texture = null,
  roughness = 0.55,
  metalness = 0.02,
  attach,
}: LateralLabelMaterialProps) {
  return (
    <meshStandardMaterial
      attach={attach}
      color={texture ? '#ffffff' : color}
      map={texture ?? undefined}
      roughness={roughness}
      metalness={metalness}
      customProgramCacheKey={() => (texture ? 'lateral-label-mask-v1' : 'base-material-v1')}
      onBeforeCompile={(shader) => {
        if (!texture) {
          return
        }
        applyLateralTextureOnly(shader)
      }}
    />
  )
}
