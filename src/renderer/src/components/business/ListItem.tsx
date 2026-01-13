import React, { memo } from 'react'
import { File, Tag, CodeXml, Pin } from 'lucide-react'
import { Note } from '@renderer/provider/ListProvider'

interface ListItemProps {
  note: Note
  isSelected: boolean
  onSelect: (note: Note) => void
}

const ListItem: React.FC<ListItemProps> = memo(({ note, isSelected, onSelect }) => {
  // 格式化时间
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return '昨天'
    } else if (days < 7) {
      return `${days}天前`
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(note)
  }

  return (
    <div
      onClick={handleClick}
      className={`w-full px-3 py-2.5 border-b border-border/50 cursor-pointer transition-colors duration-200 ${
        isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-accent/50'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {note.type === 'snippet' ? (
          <CodeXml size={16} className="text-muted-foreground shrink-0" />
        ) : (
          <File size={16} className="text-muted-foreground shrink-0" />
        )}
        <span className="font-medium text-sm truncate select-text flex-1">
          {note.title || '无标题'}
        </span>
        {note.is_pinned === 1 && <Pin size={12} className="text-primary shrink-0" />}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {note.type === 'snippet' && note.language ? (
          <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-primary/10">
            <Tag size={10} className="text-primary" />
            <span className="text-primary/80 select-text">{note.language}</span>
          </div>
        ) : (
          <span className="text-muted-foreground/70 select-text truncate max-w-[120px]">
            {note.content
              ? note.content.substring(0, 30) + (note.content.length > 30 ? '...' : '')
              : '暂无内容'}
          </span>
        )}
        <span className="text-muted-foreground/70 select-text shrink-0">
          {formatDate(note.updated_at)}
        </span>
      </div>
    </div>
  )
})

ListItem.displayName = 'ListItem'

export default ListItem
