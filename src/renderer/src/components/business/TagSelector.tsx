import { useState, useEffect } from 'react'
import { X, Tag, Plus } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@renderer/components/ui/popover'
import { Tag as TagType } from '@renderer/provider/ListProvider'

interface TagSelectorProps {
  noteId: string
  selectedTags: TagType[]
  onTagsChange: (tags: TagType[]) => void
}

export function TagSelector({ noteId, selectedTags, onTagsChange }: TagSelectorProps) {
  const [allTags, setAllTags] = useState<TagType[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadAllTags()
  }, [])

  const loadAllTags = async () => {
    try {
      const tags = await window.api.tagsGetAll()
      setAllTags(tags)
    } catch (error) {
      console.error('Failed to load tags:', error)
    }
  }

  const handleToggleTag = async (tag: TagType) => {
    const isSelected = selectedTags.some((t) => t.id === tag.id)

    if (isSelected) {
      // 移除标签
      await window.api.tagsRemoveFromNote(noteId, tag.id)
      onTagsChange(selectedTags.filter((t) => t.id !== tag.id))
    } else {
      // 添加标签
      await window.api.tagsAddToNote(noteId, tag.id)
      onTagsChange([...selectedTags, tag])
    }
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return

    try {
      const newTag = await window.api.tagsCreate({
        name: newTagName.trim(),
        color: '#6366f1' // 默认紫色
      })

      // 添加到笔记
      await window.api.tagsAddToNote(noteId, newTag.id)
      onTagsChange([...selectedTags, newTag])

      // 重新加载所有标签
      await loadAllTags()

      setNewTagName('')
    } catch (error) {
      console.error('Failed to create tag:', error)
    }
  }

  const filteredTags = allTags.filter((tag) =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {selectedTags.map((tag) => (
        <div
          key={tag.id}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs"
          style={{
            backgroundColor: `${tag.color}20`,
            color: tag.color
          }}
        >
          <Tag size={12} />
          <span>{tag.name}</span>
        </div>
      ))}

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 px-2">
            <Plus size={14} className="mr-1" />
            添加标签
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-3">
            {/* 创建新标签 */}
            <div className="flex gap-2">
              <Input
                placeholder="新标签名称"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCreateTag()
                  }
                }}
                className="h-8 text-sm"
              />
              <Button size="sm" onClick={handleCreateTag} className="h-8" disabled={!newTagName.trim()}>
                创建
              </Button>
            </div>

            {/* 搜索标签 */}
            <Input
              placeholder="搜索标签..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-sm"
            />

            {/* 标签列表 */}
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredTags.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-2">
                  {searchTerm ? '没有找到匹配的标签' : '暂无标签'}
                </div>
              ) : (
                filteredTags.map((tag) => {
                  const isSelected = selectedTags.some((t) => t.id === tag.id)
                  return (
                    <div
                      key={tag.id}
                      onClick={() => handleToggleTag(tag)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent transition-colors"
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 text-sm">{tag.name}</span>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <X size={10} className="text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
