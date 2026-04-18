import React, { useState, useCallback, useMemo } from 'react'
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

/**
 * 判断某个 item 是否有子项（后续存在比它 level 更深的项，直到遇到同级或更浅的项）
 */
const hasChildren = (items: OutlineItem[], index: number): boolean => {
  const currentLevel = items[index].level
  for (let i = index + 1; i < items.length; i++) {
    if (items[i].level <= currentLevel) return false
    if (items[i].level > currentLevel) return true
  }
  return false
}

/**
 * 判断某个 item 是否因为祖先折叠而被隐藏
 */
const isItemVisible = (
  items: OutlineItem[],
  index: number,
  collapsedSet: Set<string>
): boolean => {
  const currentLevel = items[index].level
  // 向前查找所有祖先，检查是否有被折叠的
  for (let i = index - 1; i >= 0; i--) {
    if (items[i].level < currentLevel) {
      // 找到了一个祖先
      if (collapsedSet.has(items[i].id)) return false
      // 继续向上找更高层级的祖先
      return isItemVisible(items, i, collapsedSet)
    }
  }
  return true
}

const OutlineView: React.FC<OutlineViewProps> = ({ items, activeId, onItemClick, className }) => {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  const toggleCollapse = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const visibleItems = useMemo(() => {
    return items.map((item, index) => ({
      item,
      index,
      visible: isItemVisible(items, index, collapsedIds),
      expandable: hasChildren(items, index),
      collapsed: collapsedIds.has(item.id)
    }))
  }, [items, collapsedIds])

  const getIndent = (level: number): string => {
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
        {visibleItems.map(
          ({ item, visible, expandable, collapsed }) =>
            visible && (
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
                {expandable ? (
                  <span
                    role="button"
                    onClick={(e) => toggleCollapse(item.id, e)}
                    className="shrink-0 p-0.5 -ml-0.5 rounded hover:bg-accent"
                  >
                    <ChevronRight
                      size={12}
                      className={cn(
                        'text-muted-foreground transition-transform duration-150',
                        !collapsed && 'rotate-90'
                      )}
                    />
                  </span>
                ) : (
                  <span className="shrink-0 w-[16px]" />
                )}
                {item.emoji && <span className="shrink-0">{item.emoji}</span>}
                <span className="truncate">{item.title || '无标题'}</span>
              </button>
            )
        )}
      </div>
    </ScrollArea>
  )
}

export default OutlineView
