import React from 'react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'

interface ScrollAreaProps {
  children: React.ReactNode
  className?: string
  orientation?: 'vertical' | 'horizontal' | 'both'
  theme?: 'default' | 'editor'
}

const ScrollArea: React.FC<ScrollAreaProps> = ({
  children,
  className,
  orientation = 'vertical',
  theme = 'default'
}) => {
  const overflowOptions = {
    vertical: { x: 'hidden' as const, y: 'scroll' as const },
    horizontal: { x: 'scroll' as const, y: 'hidden' as const },
    both: { x: 'scroll' as const, y: 'scroll' as const }
  }

  return (
    <OverlayScrollbarsComponent
      className={className}
      options={{
        scrollbars: {
          autoHide: 'leave', // 鼠标离开时自动隐藏
          autoHideDelay: 400, // 隐藏延迟 400ms
          theme: theme === 'editor' ? 'os-theme-editor' : 'os-theme-custom' // 使用自定义主题
        },
        overflow: overflowOptions[orientation]
      }}
      defer
    >
      {children}
    </OverlayScrollbarsComponent>
  )
}

export default ScrollArea
