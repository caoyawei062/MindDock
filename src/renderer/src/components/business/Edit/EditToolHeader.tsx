import { ChartNoAxesGantt, Copy, Tag, Trash2, Save, PenTool } from 'lucide-react'
import React, { useState, useRef, useEffect } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useEditorContext } from '@renderer/provider/EditorProvider'
import { cn } from '@/lib/utils'

const EditToolHeader: React.FC = () => {
  const { title, setTitle, outlineOpen, toggleOutline, toolbarOpen, toggleToolbar } =
    useEditorContext()
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setEditValue(title)
  }, [title])

  const handleTitleClick = () => {
    setEditValue(title)
    setIsEditing(true)
  }

  const handleTitleBlur = () => {
    setIsEditing(false)
    const newTitle = editValue.trim() || '未命名文档'
    setTitle(newTitle)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false)
      const newTitle = editValue.trim() || '未命名文档'
      setTitle(newTitle)
    }
    if (e.key === 'Escape') {
      setIsEditing(false)
      setEditValue(title)
    }
  }

  return (
    <div className="relative flex items-center justify-between px-2 py-1.5 border-b border-border/50 drag">
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1.5 rounded-md hover:bg-accent transition-colors">
              <Copy size={16} className="text-muted-foreground hover:text-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>复制内容</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleOutline}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                outlineOpen
                  ? 'bg-accent text-foreground'
                  : 'hover:bg-accent text-muted-foreground hover:text-foreground'
              )}
            >
              <ChartNoAxesGantt size={16} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{outlineOpen ? '收起大纲' : '大纲视图'}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1.5 rounded-md hover:bg-accent transition-colors">
              <Tag size={16} className="text-muted-foreground hover:text-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>添加标签</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleToolbar}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                toolbarOpen
                  ? 'bg-accent text-foreground'
                  : 'hover:bg-accent text-muted-foreground hover:text-foreground'
              )}
            >
              <PenTool size={16} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{toolbarOpen ? '隐藏工具栏' : '显示工具栏'}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* 可编辑标题 */}
      <div className="absolute left-1/2 -translate-x-1/2 no-drag">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleKeyDown}
            className="bg-accent/30 text-center text-sm font-medium text-foreground outline-none ring-1 ring-primary/50 rounded px-4 py-1.5 min-w-[200px] max-w-[400px] selection:bg-primary/20"
          />
        ) : (
          <button
            onClick={handleTitleClick}
            title={title}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1 rounded hover:bg-accent/50 truncate max-w-[300px]"
          >
            {title}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors">
              <Trash2 size={16} className="text-muted-foreground hover:text-destructive" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>删除</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1.5 rounded-md hover:bg-primary/10 transition-colors">
              <Save size={16} className="text-muted-foreground hover:text-primary" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>保存</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

export default EditToolHeader
