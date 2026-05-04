import React, { useState, useRef, useCallback, useEffect } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'

type ImageAlign = 'left' | 'center' | 'right'

interface ResizableImageViewProps {
  node: {
    attrs: {
      src?: string
      alt?: string
      title?: string
      width?: number
      height?: number
      align?: ImageAlign
    }
  }
  updateAttributes: (attributes: Record<string, unknown>) => void
  selected: boolean
}

const MIN_SIZE = 50
const DEFAULT_MAX_IMAGE_WIDTH = 860
const QUICK_RESIZE_PRESETS = [25, 50, 75, 100]

interface ImageSize {
  width: number
  height: number
}

function clampSize(size: ImageSize, maxWidth: number): ImageSize {
  if (size.width <= maxWidth) {
    return size
  }

  const ratio = size.height / size.width
  return {
    width: Math.round(maxWidth),
    height: Math.round(maxWidth * ratio)
  }
}

const ResizableImageView: React.FC<ResizableImageViewProps> = ({
  node,
  updateAttributes,
  selected
}) => {
  const { src, alt, title, width, height, align = 'left' } = node.attrs
  const [isHovered, setIsHovered] = useState(false)
  const [tempSize, setTempSize] = useState<ImageSize | null>(null)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const tempSizeRef = useRef<ImageSize | null>(null)
  const widthInputRef = useRef<HTMLInputElement>(null)
  const heightInputRef = useRef<HTMLInputElement>(null)

  const getEditorMaxWidth = useCallback((): number => {
    const editorElement = containerRef.current?.closest('.ProseMirror') as HTMLElement | null
    if (!editorElement) {
      return DEFAULT_MAX_IMAGE_WIDTH
    }

    return Math.max(MIN_SIZE, Math.min(DEFAULT_MAX_IMAGE_WIDTH, editorElement.clientWidth - 32))
  }, [])

  const getAspectRatio = useCallback((): number => {
    if (naturalSize.width > 0 && naturalSize.height > 0) {
      return naturalSize.height / naturalSize.width
    }
    if (width && height && width > 0) {
      return height / width
    }
    return 1
  }, [height, naturalSize.height, naturalSize.width, width])

  // 获取图片原始尺寸
  useEffect(() => {
    const img = imageRef.current
    if (img && img.complete) {
      setNaturalSize({
        width: img.naturalWidth,
        height: img.naturalHeight
      })
    } else if (img) {
      img.onload = () => {
        setNaturalSize({
          width: img.naturalWidth,
          height: img.naturalHeight
        })
      }
    }
  }, [src])

  useEffect(() => {
    if (!naturalSize.width || !naturalSize.height) return
    if (width || height) return

    const fittedSize = clampSize(
      {
        width: naturalSize.width,
        height: naturalSize.height
      },
      getEditorMaxWidth()
    )

    updateAttributes({ width: fittedSize.width, height: fittedSize.height })
  }, [getEditorMaxWidth, height, naturalSize.height, naturalSize.width, updateAttributes, width])

  // 使用本地状态避免闪烁
  const currentWidth = tempSize?.width || width || null
  const currentHeight = tempSize?.height || height || null

  const applySize = useCallback(
    (nextSize: ImageSize): void => {
      const fittedSize = clampSize(nextSize, getEditorMaxWidth())
      tempSizeRef.current = fittedSize
      setTempSize(fittedSize)
      updateAttributes({ width: fittedSize.width, height: fittedSize.height })
    },
    [getEditorMaxWidth, updateAttributes]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, direction: 'se' | 'e' | 's') => {
      e.preventDefault()
      e.stopPropagation()

      const startX = e.clientX
      const startY = e.clientY
      const startWidth = imageRef.current?.offsetWidth || naturalSize.width || 300
      const startHeight = imageRef.current?.offsetHeight || naturalSize.height || 200
      const aspectRatio = startHeight / startWidth || getAspectRatio()

      const handleMouseMove = (moveEvent: MouseEvent): void => {
        const deltaX = moveEvent.clientX - startX
        const deltaY = moveEvent.clientY - startY

        let newWidth = startWidth
        let newHeight = startHeight

        if (direction === 'se' || direction === 'e') {
          newWidth = Math.max(MIN_SIZE, startWidth + deltaX)
          newHeight = Math.round(newWidth * aspectRatio)
        }
        if (direction === 'se' || direction === 's') {
          newHeight = Math.max(MIN_SIZE, startHeight + deltaY)
          newWidth = Math.round(newHeight / aspectRatio)
        }

        // 使用临时状态，避免频繁更新 DOM
        const nextSize = clampSize({ width: newWidth, height: newHeight }, getEditorMaxWidth())
        tempSizeRef.current = nextSize
        setTempSize(nextSize)
      }

      const handleMouseUp = (): void => {
        // 只在鼠标释放时更新真实属性
        if (tempSizeRef.current) {
          updateAttributes({
            width: tempSizeRef.current.width,
            height: tempSizeRef.current.height
          })
        }

        setTempSize(null)
        tempSizeRef.current = null
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [getAspectRatio, getEditorMaxWidth, naturalSize.height, naturalSize.width, updateAttributes]
  )

  const handleApplyDraftSize = useCallback((): void => {
    const nextWidth = Number.parseInt(widthInputRef.current?.value || '', 10)
    const nextHeight = Number.parseInt(heightInputRef.current?.value || '', 10)
    const aspectRatio = getAspectRatio()

    if (Number.isFinite(nextWidth) && nextWidth >= MIN_SIZE) {
      applySize({
        width: nextWidth,
        height:
          Number.isFinite(nextHeight) && nextHeight >= MIN_SIZE
            ? nextHeight
            : Math.round(nextWidth * aspectRatio)
      })
    }
  }, [applySize, getAspectRatio])

  const handlePresetResize = useCallback(
    (ratioPercent: number): void => {
      if (!naturalSize.width || !naturalSize.height) return

      applySize({
        width: Math.round(naturalSize.width * (ratioPercent / 100)),
        height: Math.round(naturalSize.height * (ratioPercent / 100))
      })
    },
    [applySize, naturalSize.height, naturalSize.width]
  )

  const handleFitToEditor = useCallback((): void => {
    if (!naturalSize.width || !naturalSize.height) return
    applySize(
      clampSize(
        {
          width: naturalSize.width,
          height: naturalSize.height
        },
        getEditorMaxWidth()
      )
    )
  }, [applySize, getEditorMaxWidth, naturalSize.height, naturalSize.width])

  const handleAlignChange = useCallback(
    (nextAlign: ImageAlign): void => {
      updateAttributes({ align: nextAlign })
    },
    [updateAttributes]
  )

  // 显示手柄的条件：选中或悬停
  const showHandles = selected || isHovered

  // 计算显示样式
  const imageStyle: React.CSSProperties = {
    maxWidth: '100%',
    height: 'auto',
    userSelect: 'none',
    display: 'block'
  }

  // 如果有设置尺寸，使用 style 而不是 HTML 属性
  if (currentWidth) {
    imageStyle.width = `${currentWidth}px`
  }
  if (currentHeight) {
    imageStyle.height = `${currentHeight}px`
  }

  const wrapperStyle: React.CSSProperties = {
    display: 'block'
  }

  if (align === 'center') {
    wrapperStyle.marginLeft = 'auto'
    wrapperStyle.marginRight = 'auto'
  } else if (align === 'right') {
    wrapperStyle.marginLeft = 'auto'
    wrapperStyle.marginRight = '0'
  } else {
    wrapperStyle.marginLeft = '0'
    wrapperStyle.marginRight = 'auto'
  }

  return (
    <NodeViewWrapper
      ref={containerRef}
      className="group relative my-4 block w-fit max-w-full leading-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...wrapperStyle
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'block',
          width: currentWidth ? `${currentWidth}px` : 'auto',
          height: currentHeight ? `${currentHeight}px` : 'auto'
        }}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          title={title}
          className="rounded-lg max-w-full"
          style={imageStyle}
          draggable={false}
        />

        {selected && (
          <div
            className="pointer-events-none absolute inset-0 rounded-lg border-2 border-primary/70 shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
            aria-hidden="true"
          />
        )}

        {selected && (
          <div className="absolute left-3 top-3 z-10 rounded-lg border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>W</span>
                <input
                  key={`width-${currentWidth ?? 'auto'}`}
                  ref={widthInputRef}
                  defaultValue={currentWidth ? String(currentWidth) : ''}
                  onBlur={handleApplyDraftSize}
                  className="h-7 w-16 rounded border bg-background px-2 text-foreground"
                />
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>H</span>
                <input
                  key={`height-${currentHeight ?? 'auto'}`}
                  ref={heightInputRef}
                  defaultValue={currentHeight ? String(currentHeight) : ''}
                  onBlur={handleApplyDraftSize}
                  className="h-7 w-16 rounded border bg-background px-2 text-foreground"
                />
              </div>
              <button
                type="button"
                onClick={handleFitToEditor}
                className="h-7 rounded border px-2 text-xs text-foreground hover:bg-accent"
              >
                适配宽度
              </button>
              <button
                type="button"
                onClick={() => handlePresetResize(100)}
                className="h-7 rounded border px-2 text-xs text-foreground hover:bg-accent"
              >
                原始尺寸
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <div className="mr-1 flex items-center gap-1 rounded border p-0.5">
                <button
                  type="button"
                  onClick={() => handleAlignChange('left')}
                  className={`flex h-6 w-6 items-center justify-center rounded ${
                    align === 'left'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                  aria-label="左对齐"
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleAlignChange('center')}
                  className={`flex h-6 w-6 items-center justify-center rounded ${
                    align === 'center'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                  aria-label="居中对齐"
                >
                  <AlignCenter className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleAlignChange('right')}
                  className={`flex h-6 w-6 items-center justify-center rounded ${
                    align === 'right'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                  aria-label="右对齐"
                >
                  <AlignRight className="h-3.5 w-3.5" />
                </button>
              </div>
              {QUICK_RESIZE_PRESETS.map((ratioPercent) => (
                <button
                  key={ratioPercent}
                  type="button"
                  onClick={() => handlePresetResize(ratioPercent)}
                  className="h-6 rounded border px-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {ratioPercent}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 调整大小的手柄 */}
        {showHandles && (
          <>
            {/* 右下角手柄 */}
            <div
              className="absolute bottom-0 right-0 flex h-3.5 w-3.5 cursor-se-resize items-center justify-center rounded-full border-2 border-background bg-primary shadow-md transition-transform hover:scale-110 hover:bg-primary/90"
              style={{
                transform: 'translate(-30%, -30%)'
              }}
              onMouseDown={(e) => handleMouseDown(e, 'se')}
            >
              <div className="h-1.5 w-1.5 rounded-full bg-background/90" />
            </div>

            {/* 右边手柄 */}
            <div
              className="absolute top-1/2 right-0 h-3 w-3 cursor-e-resize rounded-full border-2 border-background bg-primary shadow-md transition-transform hover:scale-110 hover:bg-primary/90"
              style={{
                transform: 'translate(-35%, -50%)'
              }}
              onMouseDown={(e) => handleMouseDown(e, 'e')}
            />

            {/* 底边手柄 */}
            <div
              className="absolute bottom-0 left-1/2 h-3 w-3 cursor-s-resize rounded-full border-2 border-background bg-primary shadow-md transition-transform hover:scale-110 hover:bg-primary/90"
              style={{
                transform: 'translate(-50%, -35%)'
              }}
              onMouseDown={(e) => handleMouseDown(e, 's')}
            />
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default ResizableImageView
