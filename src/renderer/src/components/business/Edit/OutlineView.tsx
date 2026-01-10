import React from 'react'
import { ChevronRight, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import ScrollArea from '@renderer/components/ui/scroll-area'

export interface OutlineItem {
  id: string
  title: string
  level: number // 1-6 对应 h1-h6
  emoji?: string
}

interface OutlineViewProps {
  items: OutlineItem[]
  activeId?: string
  onItemClick?: (id: string) => void
  className?: string
}

const OutlineView: React.FC<OutlineViewProps> = ({ items, activeId, onItemClick, className }) => {
  // 根据层级计算缩进
  const getIndent = (level: number) => {
    return `${(level - 1) * 12}px`
  }

  if (items.length === 0) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground text-sm', className)}>
        <FileText className="mx-auto mb-2 size-8 opacity-50" />
        <p>暂无大纲</p>
        <p className="text-xs mt-1">添加标题以生成大纲</p>
      </div>
    )
  }

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="p-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemClick?.(item.id)}
            className={cn(
              'w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors',
              'hover:bg-accent/50 flex items-center gap-1.5',
              activeId === item.id && 'bg-accent text-accent-foreground'
            )}
            style={{ paddingLeft: `calc(8px + ${getIndent(item.level)})` }}
          >
            <ChevronRight
              size={12}
              className={cn(
                'shrink-0 text-muted-foreground transition-transform',
                item.level === 1 && 'rotate-90'
              )}
            />
            {item.emoji && <span className="shrink-0">{item.emoji}</span>}
            <span className="truncate">{item.title || '无标题'}</span>
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}

export default OutlineView
