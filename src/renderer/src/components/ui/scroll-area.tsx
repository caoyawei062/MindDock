import React from 'react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'

interface ScrollAreaProps {
  children: React.ReactNode
  className?: string
}

const ScrollArea: React.FC<ScrollAreaProps> = ({ children, className }) => {
  return (
    <OverlayScrollbarsComponent
      className={className}
      options={{
        scrollbars: {
          autoHide: 'leave', // 鼠标离开时自动隐藏
          autoHideDelay: 400, // 隐藏延迟 400ms
          theme: 'os-theme-custom' // 使用自定义主题
        },
        overflow: {
          x: 'hidden',
          y: 'scroll'
        }
      }}
      defer
    >
      {children}
    </OverlayScrollbarsComponent>
  )
}

export default ScrollArea
