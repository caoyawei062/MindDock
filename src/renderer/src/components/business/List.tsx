import React from 'react'
import ListItem from './ListItem'
import { useList } from '@renderer/provider/ListProvider'
import { FileText, Loader2, Inbox } from 'lucide-react'
import { useI18n } from '@renderer/provider/I18nProvider'

const List: React.FC = () => {
  const { filteredNotes, searchQuery, isLoading, filterType, selectedNote, setSelectedNote } =
    useList()
  const { t } = useI18n()

  const handleClick = (): void => {
    setSelectedNote(null)
  }

  // 使用 useCallback 保持稳定引用
  const handleSelectNote = React.useCallback(
    (note: typeof selectedNote) => {
      setSelectedNote(note)
    },
    [setSelectedNote]
  )
  // 获取空状态提示文本
  const getEmptyText = (): string => {
    switch (filterType) {
      case 'all':
        return t('list.empty.all')
      case 'document':
        return t('list.empty.document')
      case 'snippet':
        return t('list.empty.snippet')
      case 'favorite':
        return t('list.empty.favorite')
      case 'trash':
        return t('list.empty.trash')
      default:
        return t('common.noContent')
    }
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <span className="text-sm">{t('common.loading')}</span>
        </div>
      </div>
    )
  }

  // 空状态
  if (filteredNotes.length === 0) {
    if (searchQuery) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Inbox className="size-10 opacity-50" />
            <span className="text-sm">{t('list.searchResults', { query: searchQuery })}</span>
          </div>
        </div>
      )
    }
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          {filterType === 'trash' ? (
            <Inbox className="size-10 opacity-50" />
          ) : (
            <FileText className="size-10 opacity-50" />
          )}
          <span className="text-sm">{getEmptyText()}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mr-1" onClick={handleClick}>
      {filteredNotes.map((note) => (
        <ListItem
          key={note.id}
          note={note}
          isSelected={selectedNote?.id === note.id}
          onSelect={handleSelectNote}
          filterType={filterType}
        />
      ))}
    </div>
  )
}

export default List
