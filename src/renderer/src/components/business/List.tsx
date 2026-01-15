import React from 'react'
import ListItem from './ListItem'
import { useList } from '@renderer/provider/ListProvider'
import { FileText, Loader2, Inbox } from 'lucide-react'

const List: React.FC = () => {
  const { notes, filteredNotes, searchQuery, isLoading, filterType, selectedNote, setSelectedNote } = useList()

  const handleClick = () => {
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
  const getEmptyText = () => {
    switch (filterType) {
      case 'all':
        return '暂无内容，点击 + 创建新笔记'
      case 'document':
        return '暂无文档'
      case 'snippet':
        return '暂无代码片段'
      case 'trash':
        return '回收站为空'
      default:
        return '暂无内容'
    }
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <span className="text-sm">加载中...</span>
        </div>
      </div>
    )
  }

  // 空状态
  if (filteredNotes.length === 0) {
    // 搜索无结果
    if (searchQuery && notes.length > 0) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Inbox className="size-10 opacity-50" />
            <span className="text-sm">未找到匹配 "{searchQuery}" 的结果</span>
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
    <div
      className="h-full min-h-full"
      onClick={() => {
        handleClick
      }}
    >
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
