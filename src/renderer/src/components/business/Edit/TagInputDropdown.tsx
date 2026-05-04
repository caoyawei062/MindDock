import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Plus, Sparkles, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { AIModelConfig } from '@renderer/types/ai'

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
  noteId?: string
  noteContent?: string // 添加笔记内容用于 AI 生成标签
}

const TagInputDropdown: React.FC<TagInputDropdownProps> = ({
  tags = [],
  onTagsChange,
  children,
  className,
  noteId,
  noteContent = ''
}) => {
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [models, setModels] = useState<AIModelConfig[]>([])
  const currentResponseRef = useRef('')

  const loadModels = useCallback(async (): Promise<void> => {
    try {
      const enabledModels = await window.api.aiGetEnabledModels()
      setModels(enabledModels)
    } catch (error) {
      console.error('Failed to load models:', error)
    }
  }, [])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      // 延迟聚焦，确保下拉菜单已渲染
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  const handleAddTag = async (): Promise<void> => {
    const trimmedValue = inputValue.trim()
    if (!trimmedValue) return

    // 检查标签数量限制
    if (tags.length >= 3) {
      setInputValue('')
      return
    }

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
    } catch (error) {
      console.error('Failed to create tag:', error)
    }
  }

  const handleRemoveTag = async (tagId: string): Promise<void> => {
    if (noteId) {
      await window.api.tagsRemoveFromNote(noteId, tagId)
    }
    onTagsChange?.(tags.filter((tag) => tag.id !== tagId))
  }

  // AI 建议的标签（供用户选择）
  const [aiSuggestedTags, setAiSuggestedTags] = useState<TagItem[]>([])
  // 用户选中的 AI 建议标签
  const [selectedAiTags, setSelectedAiTags] = useState<Set<string>>(new Set())

  // AI 生成标签
  const handleAIGenerateTags = async (): Promise<void> => {
    if (!noteContent.trim() || isGenerating || models.length === 0) return

    setIsGenerating(true)
    setAiSuggestedTags([])
    setSelectedAiTags(new Set())
    currentResponseRef.current = ''

    try {
      // 使用 AI 生成更多标签供选择
      const prompt = `请根据以下内容生成6个最相关的标签,每个标签2-4个字,用逗号分隔,只返回标签名,不要其他内容:\n\n${noteContent.slice(0, 1000)}`

      const messages = [{ role: 'user' as const, content: prompt }]

      const sessionId = `tag-gen-${Date.now()}`
      const modelId = models[0].id

      // 设置监听器
      window.api.aiOnStreamChunk(sessionId, (chunk: string) => {
        currentResponseRef.current += chunk
      })

      window.api.aiOnStreamComplete(sessionId, async (): Promise<void> => {
        // 解析返回的标签
        const response = currentResponseRef.current
        const tagNames = response
          .split(',')
          .map((t: string) => t.trim())
          .filter((t: string) => t && t.length <= 6 && t.length >= 2)

        // 过滤掉已有的标签，创建候选列表
        const candidates: TagItem[] = []
        for (const tagName of tagNames.slice(0, 6)) {
          // 跳过已存在的标签
          if (tags.some((t) => t.name === tagName)) continue
          if (candidates.some((t) => t.name === tagName)) continue

          // 生成随机颜色
          const colors = [
            '#6366f1',
            '#8b5cf6',
            '#ec4899',
            '#f43f5e',
            '#f97316',
            '#eab308',
            '#22c55e',
            '#14b8a6',
            '#0ea5e9',
            '#3b82f6'
          ]
          const color = colors[Math.floor(Math.random() * colors.length)]

          candidates.push({
            id: `ai-${Date.now()}-${candidates.length}`, // 临时 ID
            name: tagName,
            color
          })
        }

        setAiSuggestedTags(candidates)
        setIsGenerating(false)
      })

      window.api.aiOnStreamError(sessionId, (error: string) => {
        console.error('AI generation error:', error)
        setIsGenerating(false)
      })

      // 调用流式生成
      await window.api.aiStreamCompletion(modelId, messages, {}, sessionId)
    } catch (error) {
      console.error('Failed to generate tags:', error)
      setIsGenerating(false)
    }
  }

  // 切换选中 AI 建议的标签
  const toggleAiTagSelection = (tagName: string): void => {
    const newSelected = new Set(selectedAiTags)
    if (newSelected.has(tagName)) {
      newSelected.delete(tagName)
    } else {
      // 检查是否超过限制
      if (tags.length + newSelected.size >= 3) return
      newSelected.add(tagName)
    }
    setSelectedAiTags(newSelected)
  }

  // 确认添加选中的 AI 标签
  const confirmAiTags = async (): Promise<void> => {
    const selectedTags = aiSuggestedTags.filter((t) => selectedAiTags.has(t.name))
    const newTags: TagItem[] = []

    for (const tag of selectedTags) {
      try {
        const newTag = await window.api.tagsCreate({
          name: tag.name,
          color: tag.color || '#6366f1'
        })
        const tagItem: TagItem = {
          id: newTag.id,
          name: newTag.name,
          color: newTag.color
        }
        if (noteId) {
          await window.api.tagsAddToNote(noteId, newTag.id)
        }
        newTags.push(tagItem)
      } catch {
        console.log('Tag may already exist:', tag.name)
      }

      // 达到限制
      if (tags.length + newTags.length >= 3) break
    }

    onTagsChange?.([...tags, ...newTags])
    setAiSuggestedTags([])
    setSelectedAiTags(new Set())
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
    if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      // 删除最后一个标签
      handleRemoveTag(tags[tags.length - 1].id)
    }
  }

  const handleOpenChange = (open: boolean): void => {
    setIsOpen(open)
    if (open) {
      void loadModels()
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
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
              placeholder={tags.length >= 3 ? '已达到标签上限' : '输入标签名称...'}
              disabled={tags.length >= 3}
              className={cn(
                'flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground',
                tags.length >= 3 && 'cursor-not-allowed opacity-50'
              )}
            />
            <button
              onClick={handleAddTag}
              disabled={!inputValue.trim() || tags.length >= 3}
              className={cn(
                'p-1 rounded transition-colors',
                inputValue.trim() && tags.length < 3
                  ? 'text-primary hover:bg-primary/10'
                  : 'text-muted-foreground/50 cursor-not-allowed'
              )}
            >
              <Plus size={14} />
            </button>
          </div>

          {/* AI 生成标签 */}
          {tags.length < 3 && (
            <div className="border-t pt-2">
              <Button
                onClick={handleAIGenerateTags}
                disabled={isGenerating || !noteContent.trim() || models.length === 0}
                variant="ghost"
                size="sm"
                className="w-full h-8 text-xs gap-1.5"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>AI 生成中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} className="text-purple-600" />
                    <span>AI 生成标签</span>
                  </>
                )}
              </Button>

              {/* AI 建议标签选择区域 */}
              {aiSuggestedTags.length > 0 && (
                <div className="mt-2 space-y-2">
                  <p className="text-[10px] text-muted-foreground">
                    点击选择标签（最多选择 {3 - tags.length} 个）
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {aiSuggestedTags.map((tag) => {
                      const isSelected = selectedAiTags.has(tag.name)
                      const canSelect = isSelected || tags.length + selectedAiTags.size < 3
                      return (
                        <button
                          key={tag.id}
                          onClick={() => toggleAiTagSelection(tag.name)}
                          disabled={!canSelect && !isSelected}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all',
                            isSelected
                              ? 'ring-2 ring-primary ring-offset-1'
                              : canSelect
                                ? 'hover:opacity-80 cursor-pointer'
                                : 'opacity-40 cursor-not-allowed'
                          )}
                          style={{
                            backgroundColor: `${tag.color}20`,
                            color: tag.color
                          }}
                        >
                          {tag.name}
                          {isSelected && <span className="ml-0.5">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                  {selectedAiTags.size > 0 && (
                    <Button onClick={confirmAiTags} size="sm" className="w-full h-7 text-xs">
                      添加 {selectedAiTags.size} 个标签
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 提示文本 */}
          <p className="text-[10px] text-muted-foreground">
            {tags.length >= 3 ? '最多添加3个标签' : '按 Enter 添加标签，Backspace 删除'}
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default TagInputDropdown
