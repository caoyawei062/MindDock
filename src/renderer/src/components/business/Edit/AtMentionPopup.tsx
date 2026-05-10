import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import type { Note } from '@renderer/provider/ListProvider'

const MAX_VISIBLE_ITEMS = 8

interface AtMentionCoords {
  left: number
  bottom: number
}

interface Props {
  query: string
  coords: AtMentionCoords
  candidates: Note[]
  loading: boolean
  onSelect: (note: Note) => void
  onClose: () => void
}

export const AtMentionPopup: React.FC<Props> = ({
  query,
  coords,
  candidates,
  loading,
  onSelect,
  onClose
}) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    const item = listRef.current?.children[activeIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setActiveIndex((i) => Math.min(i + 1, candidates.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setActiveIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        const selected = candidates[activeIndex]
        if (selected) onSelect(selected)
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [candidates, activeIndex, onSelect, onClose])

  const visible = candidates.slice(0, MAX_VISIBLE_ITEMS)

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: coords.left,
        top: coords.bottom + 4,
        zIndex: 9999
      }}
      className="w-64 rounded-md border bg-popover text-popover-foreground shadow-lg overflow-hidden"
    >
      {loading ? (
        <div className="px-3 py-4 text-sm text-muted-foreground">加载中...</div>
      ) : visible.length === 0 ? (
        <div className="px-3 py-4 text-sm text-muted-foreground">没有匹配的文章</div>
      ) : (
        <div ref={listRef} className="max-h-60 overflow-y-auto divide-y divide-border">
          {visible.map((note, index) => (
            <button
              key={note.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(note)}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                'flex w-full items-center px-3 py-2 text-left text-sm transition-colors',
                index === activeIndex ? 'bg-accent text-accent-foreground' : ''
              )}
            >
              <span className="truncate font-medium">{note.title || '未命名文档'}</span>
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  )
}
