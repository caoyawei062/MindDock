import React, { useState, useRef, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface TagItem {
  id: string
  name: string
  color?: string
}

interface TagInputDropdownProps {
  tags?: TagItem[]
  onTagsChange?: (tags: TagItem[]) => void
  children: React.ReactNode
  className?: string
  noteId?: string // 添加 noteId 参数
}

const TagInputDropdown: React.FC<TagInputDropdownProps> = ({
  tags = [],
  onTagsChange,
  children,
  className,
  noteId
}) => {
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [allTags, setAllTags] = useState<TagItem[]>([])

  // 加载所有标签
  useEffect(() => {
    if (isOpen) {
      loadAllTags()
    }
  }, [isOpen])

  const loadAllTags = async () => {
    try {
      const tags = await window.api.tagsGetAll()
      // 转换为 TagItem 格式
      const tagItems: TagItem[] = tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color
      }))
      setAllTags(tagItems)
    } catch (error) {
      console.error('Failed to load tags:', error)
    }
  }

  useEffect(() => {
    if (isOpen && inputRef.current) {
      // 延迟聚焦，确保下拉菜单已渲染
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  const handleAddTag = async () => {
    const trimmedValue = inputValue.trim()
    if (!trimmedValue) return

    // 检查是否已存在
    if (tags.some((tag) => tag.name.toLowerCase() === trimmedValue.toLowerCase())) {
      setInputValue('')
      return
    }

    try {
      // 创建新标签
      const newTag = await window.api.tagsCreate({
        name: trimmedValue,
        color: '#6366f1' // 使用默认颜色
      })

      const tagItem: TagItem = {
        id: newTag.id,
        name: newTag.name,
        color: newTag.color
      }

      // 如果有 noteId,添加到笔记
      if (noteId) {
        await window.api.tagsAddToNote(noteId, newTag.id)
      }

      onTagsChange?.([...tags, tagItem])
      setInputValue('')
      await loadAllTags() // 重新加载标签列表
    } catch (error) {
      console.error('Failed to create tag:', error)
    }
  }

  const handleToggleTag = async (tag: TagItem) => {
    const isSelected = tags.some((t) => t.id === tag.id)

    if (isSelected) {
      // 移除标签
      if (noteId) {
        await window.api.tagsRemoveFromNote(noteId, tag.id)
      }
      onTagsChange?.(tags.filter((t) => t.id !== tag.id))
    } else {
      // 添加标签
      if (noteId) {
        await window.api.tagsAddToNote(noteId, tag.id)
      }
      onTagsChange?.([...tags, tag])
    }
  }

  const handleRemoveTag = async (tagId: string) => {
    if (noteId) {
      await window.api.tagsRemoveFromNote(noteId, tagId)
    }
    onTagsChange?.(tags.filter((tag) => tag.id !== tagId))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
    if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      // 删除最后一个标签
      handleRemoveTag(tags[tags.length - 1].id)
    }
  }

  // 过滤标签
  const filteredTags = allTags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.some((t) => t.id === tag.id)
  )

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn('w-72 p-2', className)}>
        <div className="space-y-2">
          {/* 已添加的标签 */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-2 border-b">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                    tag.color || 'bg-accent text-accent-foreground'
                  )}
                  style={{
                    backgroundColor: tag.color ? `${tag.color}20` : undefined,
                    color: tag.color || undefined
                  }}
                >
                  {tag.name}
                  <button
                    onClick={() => handleRemoveTag(tag.id)}
                    className="hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* 输入框 */}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入标签名称..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={handleAddTag}
              disabled={!inputValue.trim()}
              className={cn(
                'p-1 rounded transition-colors',
                inputValue.trim()
                  ? 'text-primary hover:bg-primary/10'
                  : 'text-muted-foreground/50 cursor-not-allowed'
              )}
            >
              <Plus size={14} />
            </button>
          </div>

          {/* 可选择的已有标签 */}
          {filteredTags.length > 0 && (
            <>
              <div className="border-t pt-2">
                <p className="text-[10px] text-muted-foreground mb-1.5">选择已有标签</p>
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {filteredTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleToggleTag(tag)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-accent/50 transition-colors text-left'
                      )}
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1">{tag.name}</span>
                      <Plus size={12} className="text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 提示文本 */}
          <p className="text-[10px] text-muted-foreground">按 Enter 添加标签，Backspace 删除</p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default TagInputDropdown
