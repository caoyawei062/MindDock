import React, { useState, useRef, useCallback, useEffect } from 'react'
import { NodeViewWrapper } from '@tiptap/react'

interface ResizableImageViewProps {
  node: {
    attrs: {
      src?: string
      alt?: string
      title?: string
      width?: number
      height?: number
    }
  }
  updateAttributes: (attributes: Record<string, unknown>) => void
  selected: boolean
}

const MIN_SIZE = 50

const ResizableImageView: React.FC<ResizableImageViewProps> = ({ node, updateAttributes, selected }) => {
  const { src, alt, title, width, height } = node.attrs
  const [isHovered, setIsHovered] = useState(false)
  const [tempSize, setTempSize] = useState<{ width: number; height: number } | null>(null)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

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

  // 使用本地状态避免闪烁
  const currentWidth = tempSize?.width || width || null
  const currentHeight = tempSize?.height || height || null

  const handleMouseDown = useCallback((e: React.MouseEvent, direction: 'se' | 'e' | 's') => {
    e.preventDefault()
    e.stopPropagation()

    const startX = e.clientX
    const startY = e.clientY
    const startWidth = imageRef.current?.offsetWidth || naturalSize.width || 300
    const startHeight = imageRef.current?.offsetHeight || naturalSize.height || 200

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY

      let newWidth = startWidth
      let newHeight = startHeight

      if (direction === 'se' || direction === 'e') {
        newWidth = Math.max(MIN_SIZE, startWidth + deltaX)
      }
      if (direction === 'se' || direction === 's') {
        newHeight = Math.max(MIN_SIZE, startHeight + deltaY)
      }

      // 使用临时状态，避免频繁更新 DOM
      setTempSize({ width: newWidth, height: newHeight })
    }

    const handleMouseUp = () => {
      // 只在鼠标释放时更新真实属性
      if (tempSize) {
        updateAttributes({
          width: tempSize.width,
          height: tempSize.height
        })
      }

      setTempSize(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [tempSize, naturalSize, updateAttributes])

  // 显示手柄的条件：选中或悬停
  const showHandles = selected || isHovered

  // 计算显示样式
  const imageStyle: any = {
    maxWidth: '100%',
    height: 'auto',
    userSelect: 'none',
    WebkitUserDrag: 'none',
    display: 'block'
  }

  // 如果有设置尺寸，使用 style 而不是 HTML 属性
  if (currentWidth) {
    imageStyle.width = `${currentWidth}px`
  }
  if (currentHeight) {
    imageStyle.height = `${currentHeight}px`
  }

  return (
    <NodeViewWrapper
      ref={containerRef}
      className="relative inline-block group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-block'
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'inline-block',
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

        {/* 调整大小的手柄 */}
        {showHandles && (
          <>

            {/* 右下角手柄 */}
            <div
              className="absolute bottom-0 right-0 w-4 h-4 bg-primary rounded-sm cursor-se-resize hover:bg-primary/80 transition-colors"
              style={{
                transform: 'translate(25%, 25%)',
                boxShadow: '0 0 0 2px white'
              }}
              onMouseDown={(e) => handleMouseDown(e, 'se')}
            />

            {/* 右边手柄 */}
            <div
              className="absolute top-1/2 right-0 w-1.5 h-8 bg-primary rounded-full cursor-e-resize hover:bg-primary/80 transition-colors"
              style={{
                transform: 'translate(50%, -50%)',
                boxShadow: '0 0 0 1px white'
              }}
              onMouseDown={(e) => handleMouseDown(e, 'e')}
            />

            {/* 底边手柄 */}
            <div
              className="absolute bottom-0 left-1/2 w-8 h-1.5 bg-primary rounded-full cursor-s-resize hover:bg-primary/80 transition-colors"
              style={{
                transform: 'translate(-50%, 50%)',
                boxShadow: '0 0 0 1px white'
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
