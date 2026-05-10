import React, { useState, useRef, useCallback, useEffect } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'

type ImageAlign = 'left' | 'center' | 'right'
type CornerDirection = 'nw' | 'ne' | 'sw' | 'se'
type ImageDisplayMode = 'block' | 'inline'

interface ResizableImageViewProps {
  node: {
    attrs: {
      src?: string
      alt?: string
      title?: string
      width?: number
      height?: number
      align?: ImageAlign
      displayMode?: ImageDisplayMode
    }
  }
  updateAttributes: (attributes: Record<string, unknown>) => void
  selected: boolean
}

const MIN_SIZE = 50
const DEFAULT_MAX_IMAGE_WIDTH = 860
const QUICK_RESIZE_PRESETS = [25, 50, 75, 100]
const IMAGE_PARAGRAPH_CLASS = 'image-node-paragraph'
const CORNER_HANDLES: Array<{
  direction: CornerDirection
  cursor: string
  positionClass: string
  shapeClass: string
}> = [
  {
    direction: 'nw',
    cursor: 'nwse-resize',
    positionClass: '-left-1 -top-1',
    shapeClass: 'rounded-tl-[18px] border-l-[4px] border-t-[4px]'
  },
  {
    direction: 'ne',
    cursor: 'nesw-resize',
    positionClass: '-right-1 -top-1',
    shapeClass: 'rounded-tr-[18px] border-r-[4px] border-t-[4px]'
  },
  {
    direction: 'sw',
    cursor: 'nesw-resize',
    positionClass: '-bottom-1 -left-1',
    shapeClass: 'rounded-bl-[18px] border-b-[4px] border-l-[4px]'
  },
  {
    direction: 'se',
    cursor: 'nwse-resize',
    positionClass: '-bottom-1 -right-1',
    shapeClass: 'rounded-br-[18px] border-b-[4px] border-r-[4px]'
  }
]

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
  const { src, alt, title, width, height, align = 'left', displayMode = 'inline' } = node.attrs
  const [isHovered, setIsHovered] = useState(false)
  const [tempSize, setTempSize] = useState<ImageSize | null>(null)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLElement>(null)
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
    const wrapper = containerRef.current
    const paragraph = wrapper?.parentElement
    if (!paragraph || paragraph.tagName !== 'P') {
      return
    }

    const onlyImageNodes =
      Array.from(paragraph.children).every((child) =>
        child.classList.contains('resizable-image-node')
      ) && (paragraph.textContent?.trim() ?? '') === ''

    paragraph.classList.toggle(
      IMAGE_PARAGRAPH_CLASS,
      displayMode === 'inline' && onlyImageNodes
    )

    return () => {
      paragraph.classList.remove(IMAGE_PARAGRAPH_CLASS)
    }
  }, [displayMode])

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
    (e: React.MouseEvent, direction: CornerDirection) => {
      e.preventDefault()
      e.stopPropagation()

      const startX = e.clientX
      const startY = e.clientY
      const startWidth = imageRef.current?.offsetWidth || naturalSize.width || 300
      const startHeight = imageRef.current?.offsetHeight || naturalSize.height || 200
      const aspectRatio = startHeight / startWidth || getAspectRatio()
      const isEast = direction === 'ne' || direction === 'se'
      const isSouth = direction === 'sw' || direction === 'se'

      const handleMouseMove = (moveEvent: MouseEvent): void => {
        const deltaX = moveEvent.clientX - startX
        const deltaY = moveEvent.clientY - startY

        const widthFromX = startWidth + (isEast ? deltaX : -deltaX)
        const widthFromY = startWidth + ((isSouth ? deltaY : -deltaY) / aspectRatio)
        const preferWidthFromX =
          Math.abs(widthFromX - startWidth) >= Math.abs(widthFromY - startWidth)

        const newWidth = Math.max(MIN_SIZE, Math.round(preferWidthFromX ? widthFromX : widthFromY))
        const newHeight = Math.max(MIN_SIZE, Math.round(newWidth * aspectRatio))

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

  const handleDisplayModeChange = useCallback(
    (nextDisplayMode: ImageDisplayMode): void => {
      updateAttributes({ displayMode: nextDisplayMode })
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

  const wrapperStyle: React.CSSProperties =
    displayMode === 'block'
      ? {
          display: 'block',
          marginTop: '16px',
          marginBottom: '16px'
        }
      : {
          display: 'inline-block',
          verticalAlign: 'top',
          marginRight: '12px',
          marginBottom: '12px'
        }

  if (displayMode === 'block') {
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
  } else {
    wrapperStyle.marginLeft = '0'
    wrapperStyle.marginTop = '0'
  }

  return (
    <NodeViewWrapper
      as="span"
      ref={containerRef}
      className="resizable-image-node group relative w-fit max-w-full align-top leading-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...wrapperStyle
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'inline-block',
          lineHeight: 0
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
          <div className="absolute left-1/2 bottom-full z-10 mb-3 flex max-w-[min(calc(100vw-2rem),42rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/70 bg-background/92 px-3 py-2 shadow-[0_14px_34px_rgba(15,23,42,0.14),0_3px_10px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-muted/30 px-2 py-1">
              <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <span>W</span>
                <input
                  key={`width-${currentWidth ?? 'auto'}`}
                  ref={widthInputRef}
                  defaultValue={currentWidth ? String(currentWidth) : ''}
                  onBlur={handleApplyDraftSize}
                  className="h-8 w-16 rounded-lg border border-border/70 bg-background px-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary/40"
                />
              </div>
              <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <span>H</span>
                <input
                  key={`height-${currentHeight ?? 'auto'}`}
                  ref={heightInputRef}
                  defaultValue={currentHeight ? String(currentHeight) : ''}
                  onBlur={handleApplyDraftSize}
                  className="h-8 w-16 rounded-lg border border-border/70 bg-background px-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary/40"
                />
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-muted/30 p-1">
              <button
                type="button"
                onClick={() => handleDisplayModeChange('inline')}
                className={`h-8 rounded-lg px-2.5 text-xs font-medium transition-colors ${
                  displayMode === 'inline'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                并排
              </button>
              <button
                type="button"
                onClick={() => handleDisplayModeChange('block')}
                className={`h-8 rounded-lg px-2.5 text-xs font-medium transition-colors ${
                  displayMode === 'block'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                独占一行
              </button>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-muted/30 p-1">
              <button
                type="button"
                onClick={() => handleAlignChange('left')}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  displayMode === 'block' && align === 'left'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : displayMode === 'inline'
                      ? 'text-muted-foreground/40'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
                aria-label="左对齐"
                disabled={displayMode === 'inline'}
              >
                <AlignLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleAlignChange('center')}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  displayMode === 'block' && align === 'center'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : displayMode === 'inline'
                      ? 'text-muted-foreground/40'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
                aria-label="居中对齐"
                disabled={displayMode === 'inline'}
              >
                <AlignCenter className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleAlignChange('right')}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  displayMode === 'block' && align === 'right'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : displayMode === 'inline'
                      ? 'text-muted-foreground/40'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
                aria-label="右对齐"
                disabled={displayMode === 'inline'}
              >
                <AlignRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-muted/30 p-1">
              {QUICK_RESIZE_PRESETS.map((ratioPercent) => (
                <button
                  key={ratioPercent}
                  type="button"
                  onClick={() => handlePresetResize(ratioPercent)}
                  className="h-8 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {ratioPercent}%
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleFitToEditor}
              className="h-8 rounded-xl border border-border/70 bg-background/90 px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
            >
              适配宽度
            </button>
            <button
              type="button"
              onClick={() => handlePresetResize(100)}
              className="h-8 rounded-xl border border-border/70 bg-background/90 px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
            >
              原始尺寸
            </button>
          </div>
        )}

        {/* 调整大小的手柄 */}
        {showHandles && (
          <>
            {CORNER_HANDLES.map((handle) => (
              <div
                key={handle.direction}
                className={`absolute ${handle.positionClass} z-20 h-5 w-5 transition-transform hover:scale-105`}
                style={{ cursor: handle.cursor }}
                onMouseDown={(e) => handleMouseDown(e, handle.direction)}
              >
                <div
                  className={`h-full w-full border-white ${handle.shapeClass}`}
                  style={{
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.65))'
                  }}
                />
              </div>
            ))}
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default ResizableImageView
