/* eslint-disable react/prop-types */
import React, { memo, useState } from 'react'
import { File, Tag, CodeXml, Pin, Trash2, MoreVertical, Star } from 'lucide-react'
import { FilterType, Note } from '@renderer/provider/ListProvider'
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
import { useI18n } from '@renderer/provider/I18nProvider'

interface ListItemProps {
  note: Note
  isSelected: boolean
  onSelect: (note: Note) => void
  filterType: FilterType
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

const stripHtml = (html: string): string => {
  return html
    .replace(/<img\b[^>]*>/gi, '[图片]')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const ListItem: React.FC<ListItemProps> = memo(({ note, isSelected, onSelect, filterType }) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [emptyTrashDialogOpen, setEmptyTrashDialogOpen] = useState(false)
  const { deleteNote, restoreNote, updateNote, togglePin, emptyTrash } = useList()
  const { localeTag, t } = useI18n()

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const diffDays = (today - dateDay) / (1000 * 60 * 60 * 24)

    if (diffDays === 0) {
      return date.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return t('listItem.yesterday')
    } else if (diffDays < 7) {
      return t('listItem.daysAgo', { count: diffDays })
    } else {
      return date.toLocaleDateString(localeTag, { month: 'short', day: 'numeric' })
    }
  }

  const handleClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    onSelect(note)
  }

  const handleDelete = async (): Promise<void> => {
    const success = await deleteNote(note.id)
    if (success) {
      setDeleteDialogOpen(false)
    }
  }

  const handleRestore = async (): Promise<void> => {
    await restoreNote(note.id)
  }

  const handleToggleFavorite = async (event: React.MouseEvent): Promise<void> => {
    event.stopPropagation()
    await updateNote(note.id, { is_favorite: note.is_favorite === 1 ? 0 : 1 })
  }

  const handleTogglePin = async (event: React.MouseEvent): Promise<void> => {
    event.stopPropagation()
    await togglePin(note.id)
  }

  const handleEmptyTrash = async (): Promise<void> => {
    const success = await emptyTrash()
    if (success) {
      setEmptyTrashDialogOpen(false)
    }
  }

  return (
    <>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {filterType === 'trash'
                ? t('listItem.deleteDialog.trashTitle')
                : t('listItem.deleteDialog.defaultTitle')}
            </DialogTitle>
            <DialogDescription>
              {filterType === 'trash'
                ? t('listItem.deleteDialog.trashDescription')
                : t('listItem.deleteDialog.defaultDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={filterType === 'trash' ? 'destructive' : 'default'}
              onClick={handleDelete}
            >
              {filterType === 'trash' ? t('common.deleteForever') : t('common.moveToTrash')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emptyTrashDialogOpen} onOpenChange={setEmptyTrashDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('listItem.emptyTrashDialog.title')}</DialogTitle>
            <DialogDescription>{t('listItem.emptyTrashDialog.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmptyTrashDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleEmptyTrash}>
              {t('common.emptyTrash')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div
        onClick={handleClick}
        className={`w-full mx-2 my-1 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
          isSelected
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
            {note.title || t('listItem.untitled')}
          </span>
          {filterType !== 'trash' && note.is_favorite === 1 && (
            <button
              type="button"
              onClick={handleToggleFavorite}
              title={note.is_favorite === 1 ? t('common.unfavorite') : t('common.favorite')}
              className={`h-6 w-6 rounded-md inline-flex items-center justify-center transition-colors ${
                note.is_favorite === 1
                  ? 'text-amber-500 hover:bg-amber-500/10'
                  : 'text-muted-foreground hover:text-amber-500 hover:bg-accent'
              }`}
            >
              <Star size={12} className={note.is_favorite === 1 ? 'fill-current' : undefined} />
            </button>
          )}
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
                  <DropdownMenuItem onClick={handleRestore}>
                    {t('common.restoreNote')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeleteDialogOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 size={14} className="mr-2" />
                    {t('common.deleteForever')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setEmptyTrashDialogOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 size={14} className="mr-2" />
                    {t('common.emptyTrash')}
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={handleTogglePin}>
                    <Pin
                      size={14}
                      className={`mr-2 ${note.is_pinned === 1 ? 'fill-current text-primary' : ''}`}
                    />
                    {note.is_pinned === 1 ? t('common.unpin') : t('common.pin')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleToggleFavorite}>
                    <Star
                      size={14}
                      className={`mr-2 ${note.is_favorite === 1 ? 'fill-current text-amber-500' : ''}`}
                    />
                    {note.is_favorite === 1 ? t('common.unfavorite') : t('common.favorite')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeleteDialogOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 size={14} className="mr-2" />
                    {t('common.moveToTrash')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 内容预览区域 - 移到中间 */}
        <div className="mb-1.5">
          <p className="text-xs text-muted-foreground line-clamp-2 select-text">
            {note.content
              ? (() => {
                  const plain = stripHtml(note.content)
                  return plain.substring(0, 80) + (plain.length > 80 ? '...' : '')
                })()
              : t('listItem.noContent')}
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
