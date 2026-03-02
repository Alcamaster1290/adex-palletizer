import { useEffect, useRef } from 'react'
import type { SkuLabelConfig } from '../types'
import { LABEL_TEXTURE_SIZE } from './labelModel'
import { renderLabelToCanvas } from './labelRenderer'

interface LabelPreviewCanvasProps {
  draft: Omit<SkuLabelConfig, 'frontTextureDataUrl' | 'updatedAt'>
  onDataUrlReady?: (dataUrl: string) => void
}

export function LabelPreviewCanvas({ draft, onDataUrlReady }: LabelPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    let isActive = true

    const draw = async () => {
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      await renderLabelToCanvas(canvas, draft, LABEL_TEXTURE_SIZE)
      if (!isActive) {
        return
      }

      if (onDataUrlReady) {
        onDataUrlReady(canvas.toDataURL('image/png'))
      }
    }

    void draw()
    return () => {
      isActive = false
    }
  }, [draft, onDataUrlReady])

  return (
    <canvas
      ref={canvasRef}
      width={LABEL_TEXTURE_SIZE}
      height={LABEL_TEXTURE_SIZE}
      className="label-preview-canvas"
      data-testid="label-preview-canvas"
    />
  )
}
