import { LinearFilter, SRGBColorSpace, TextureLoader, type Texture } from 'three'
import type { SkuLabelsBySku } from '../types'
import { SINGLE_BOX_SKU_ID } from './labelModel'

const textureCache = new Map<string, Texture>()

function buildTextureKey(textureDataUrl: string) {
  return textureDataUrl
}

function createTexture(textureDataUrl: string) {
  const texture = new TextureLoader().load(textureDataUrl)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}

export function getTextureForDataUrl(textureDataUrl: string): Texture {
  const key = buildTextureKey(textureDataUrl)
  const cached = textureCache.get(key)
  if (cached) {
    return cached
  }

  const nextTexture = createTexture(textureDataUrl)
  textureCache.set(key, nextTexture)
  return nextTexture
}

export function resolveSkuTextureDataUrl(
  labelsBySku: SkuLabelsBySku,
  skuId?: string,
  fallbackSkuId?: string,
) {
  const resolvedSku = skuId ?? fallbackSkuId ?? SINGLE_BOX_SKU_ID
  return labelsBySku[resolvedSku]?.frontTextureDataUrl ?? null
}

export function resolveSkuTexture(
  labelsBySku: SkuLabelsBySku,
  skuId?: string,
  fallbackSkuId?: string,
): Texture | null {
  const dataUrl = resolveSkuTextureDataUrl(labelsBySku, skuId, fallbackSkuId)
  if (!dataUrl) {
    return null
  }
  return getTextureForDataUrl(dataUrl)
}

export function invalidateTextureByDataUrl(textureDataUrl: string | undefined) {
  if (!textureDataUrl) {
    return
  }
  const key = buildTextureKey(textureDataUrl)
  const cached = textureCache.get(key)
  if (cached) {
    cached.dispose()
    textureCache.delete(key)
  }
}

export function clearLabelTextureCache() {
  textureCache.forEach((texture) => texture.dispose())
  textureCache.clear()
}
