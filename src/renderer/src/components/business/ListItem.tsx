import React, { memo, useState } from 'react'
import { File, Tag, CodeXml, Pin, Trash2, MoreVertical } from 'lucide-react'
import { Note } from '@renderer/provider/ListProvider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { useList } from '@renderer/provider/ListProvider'

interface ListItemProps {
  note: Note
  isSelected: boolean
  onSelect: (note: Note) => void
  filterType: 'all' | 'document' | 'snippet' | 'trash'
}
// 语言映射简写
const languageMap: { [key: string]: string } = {
  javascript: 'JS',
  typescript: 'TS',
  python: 'Py',
  java: 'Java',
  csharp: 'C#',
  cpp: 'C++',
  ruby: 'Rb',
  go: 'Go',
  php: 'PHP',
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
  markdown: 'MD',
  shell: 'SH',
  sql: 'SQL'
}

const ListItem: React.FC<ListItemProps> = memo(({ note, isSelected, onSelect, filterType }) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const { deleteNote, restoreNote } = useList()

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

  const handleDelete = async () => {
    const success = await deleteNote(note.id)
    if (success) {
      setDeleteDialogOpen(false)
    }
  }

  const handleRestore = async () => {
    await restoreNote(note.id)
  }

  return (
    <>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{filterType === 'trash' ? '彻底删除笔记' : '移到废纸篓'}</DialogTitle>
            <DialogDescription>
              {filterType === 'trash'
                ? '此操作将永久删除该笔记,无法恢复。确定要继续吗?'
                : '该笔记将被移到废纸篓,可以在废纸篓中恢复或彻底删除。'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant={filterType === 'trash' ? 'destructive' : 'default'}
              onClick={handleDelete}
            >
              {filterType === 'trash' ? '彻底删除' : '移到废纸篓'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div
        onClick={handleClick}
        className={`w-full mx-2 my-1 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 ${isSelected
            ? 'bg-primary/10 border border-primary/30 shadow-sm'
            : 'bg-card/50 border border-border/30 hover:bg-accent/50 hover:border-border/50'
          }`}
        style={{ width: 'calc(100% - 16px)' }}
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreVertical size={14} className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {filterType === 'trash' ? (
                <>
                  <DropdownMenuItem onClick={handleRestore}>恢复笔记</DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeleteDialogOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 size={14} className="mr-2" />
                    彻底删除
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 size={14} className="mr-2" />
                  移到废纸篓
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 内容预览区域 - 移到中间 */}
        <div className="mb-1.5">
          <p className="text-xs text-muted-foreground line-clamp-2 select-text">
            {note.content
              ? note.content.substring(0, 80) + (note.content.length > 80 ? '...' : '')
              : '暂无内容'}
          </p>
        </div>

        {/* 标签显示区域 - 移到底部 */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex items-center gap-1 mb-1.5 flex-wrap">
            {note.type === 'snippet' && note.language && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-black/10 text-primary">
                <CodeXml size={10} className="text-primary" />
                <span className="text-primary/80 select-text">{languageMap[note.language]}</span>
              </div>
            )}
            {note.tags.slice(0, 3).map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color
                }}
              >
                <Tag size={8} />
                <span className="select-text">{tag.name}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2"></div>
          <span className="text-muted-foreground/70 select-text shrink-0">
            {formatDate(note.updated_at)}
          </span>
        </div>
      </div>
    </>
  )
})

ListItem.displayName = 'ListItem'

export default ListItem
