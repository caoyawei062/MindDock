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
}

// 预设颜色
const TAG_COLORS = [
  'bg-red-500/20 text-red-600 dark:text-red-400',
  'bg-orange-500/20 text-orange-600 dark:text-orange-400',
  'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
  'bg-lime-500/20 text-lime-600 dark:text-lime-400',
  'bg-green-500/20 text-green-600 dark:text-green-400',
  'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  'bg-teal-500/20 text-teal-600 dark:text-teal-400',
  'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
  'bg-sky-500/20 text-sky-600 dark:text-sky-400',
  'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
  'bg-violet-500/20 text-violet-600 dark:text-violet-400',
  'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  'bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400',
  'bg-pink-500/20 text-pink-600 dark:text-pink-400'
]

const getRandomColor = () => TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]

const TagInputDropdown: React.FC<TagInputDropdownProps> = ({
  tags = [],
  onTagsChange,
  children,
  className
}) => {
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      // 延迟聚焦，确保下拉菜单已渲染
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  const handleAddTag = () => {
    const trimmedValue = inputValue.trim()
    if (!trimmedValue) return

    // 检查是否已存在
    if (tags.some((tag) => tag.name.toLowerCase() === trimmedValue.toLowerCase())) {
      setInputValue('')
      return
    }

    const newTag: TagItem = {
      id: `tag-${Date.now()}`,
      name: trimmedValue,
      color: getRandomColor()
    }

    onTagsChange?.([...tags, newTag])
    setInputValue('')
  }

  const handleRemoveTag = (tagId: string) => {
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

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn('w-64 p-2', className)}>
        <div className="space-y-2">
          {/* 已添加的标签 */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                    tag.color || 'bg-accent text-accent-foreground'
                  )}
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

          {/* 提示文本 */}
          <p className="text-[10px] text-muted-foreground">按 Enter 添加标签，Backspace 删除</p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default TagInputDropdown
