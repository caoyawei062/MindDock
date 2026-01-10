import { ChartNoAxesGantt, Copy, Tag, Trash2, Save, PenTool, LucideIcon } from 'lucide-react'
import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useEditorContext } from '@renderer/provider/EditorProvider'
import { cn } from '@/lib/utils'
import {
  type EditorMode,
  type LanguageConfig,
  type CodeMirrorConfig,
  DEFAULT_LANGUAGES,
  DEFAULT_CODEMIRROR_CONFIG
} from './types'
import LanguageSelector from './LanguageSelector'
import CodeMirrorSettings from './CodeMirrorSettings'
import TagInputDropdown, { type TagItem } from './TagInputDropdown'

export type { EditorMode, LanguageConfig, CodeMirrorConfig } from './types'

// 按钮配置类型
interface ToolButtonConfig {
  id: string
  icon: LucideIcon
  tooltip: string | (() => string)
  onClick?: () => void
  isActive?: boolean | (() => boolean)
  variant?: 'default' | 'destructive' | 'primary'
  // 支持的模式，不设置表示所有模式都支持
  modes?: EditorMode[]
}

// 按钮组配置
interface ToolButtonGroupConfig {
  position: 'left' | 'right'
  buttons: ToolButtonConfig[]
}

interface EditToolHeaderProps {
  mode?: EditorMode
  onModeChange?: (mode: EditorMode) => void
  languages?: LanguageConfig[]
  selectedLanguage?: string
  onLanguageChange?: (langId: string) => void
  codeMirrorConfig?: CodeMirrorConfig
  onCodeMirrorConfigChange?: (config: CodeMirrorConfig) => void
  tags?: TagItem[]
  onTagsChange?: (tags: TagItem[]) => void
}

const EditToolHeader: React.FC<EditToolHeaderProps> = ({
  mode = 'word',
  onModeChange: _onModeChange,
  languages = DEFAULT_LANGUAGES,
  selectedLanguage = 'javascript',
  onLanguageChange,
  codeMirrorConfig = DEFAULT_CODEMIRROR_CONFIG,
  onCodeMirrorConfigChange,
  tags = [],
  onTagsChange
}) => {
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

  // 按钮配置
  const buttonGroups: ToolButtonGroupConfig[] = useMemo(
    () => [
      {
        position: 'left',
        buttons: [
          {
            id: 'copy',
            icon: Copy,
            tooltip: '复制内容'
          },
          {
            id: 'outline',
            icon: ChartNoAxesGantt,
            tooltip: () => (outlineOpen ? '收起大纲' : '大纲视图'),
            onClick: toggleOutline,
            isActive: () => outlineOpen,
            modes: ['word']
          },
          {
            id: 'tag',
            icon: Tag,
            tooltip: '添加标签'
          },
          {
            id: 'toolbar',
            icon: PenTool,
            tooltip: () => (toolbarOpen ? '隐藏工具栏' : '显示工具栏'),
            onClick: toggleToolbar,
            isActive: () => toolbarOpen,
            modes: ['word']
          }
        ]
      },
      {
        position: 'right',
        buttons: [
          {
            id: 'delete',
            icon: Trash2,
            tooltip: '删除',
            variant: 'destructive'
          },
          {
            id: 'save',
            icon: Save,
            tooltip: '保存',
            variant: 'primary'
          }
        ]
      }
    ],
    [outlineOpen, toggleOutline, toolbarOpen, toggleToolbar]
  )

  // 根据模式过滤按钮
  const filterButtonsByMode = (buttons: ToolButtonConfig[]) => {
    return buttons.filter((btn) => !btn.modes || btn.modes.includes(mode))
  }

  // 渲染单个按钮
  const renderButton = (btn: ToolButtonConfig) => {
    const Icon = btn.icon
    const tooltipText = typeof btn.tooltip === 'function' ? btn.tooltip() : btn.tooltip
    const isActive = typeof btn.isActive === 'function' ? btn.isActive() : btn.isActive

    const getButtonClassName = () => {
      if (isActive) {
        return 'bg-accent text-foreground'
      }

      switch (btn.variant) {
        case 'destructive':
          return 'hover:bg-destructive/10 text-muted-foreground hover:text-destructive'
        case 'primary':
          return 'hover:bg-primary/10 text-muted-foreground hover:text-primary'
        default:
          return 'hover:bg-accent text-muted-foreground hover:text-foreground'
      }
    }

    return (
      <Tooltip key={btn.id}>
        <TooltipTrigger asChild>
          <button
            onClick={btn.onClick}
            className={cn('p-1.5 rounded-md transition-colors', getButtonClassName())}
          >
            <Icon size={16} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  const leftButtons = filterButtonsByMode(
    buttonGroups.find((g) => g.position === 'left')?.buttons || []
  )
  const rightButtons = filterButtonsByMode(
    buttonGroups.find((g) => g.position === 'right')?.buttons || []
  )

  // 渲染带 TagInputDropdown 的按钮
  const renderTagButton = (btn: ToolButtonConfig) => {
    const Icon = btn.icon
    const tooltipText = typeof btn.tooltip === 'function' ? btn.tooltip() : btn.tooltip
    const isActive = tags.length > 0

    return (
      <TagInputDropdown key={btn.id} tags={tags} onTagsChange={onTagsChange}>
        <button
          className={cn(
            'p-1.5 rounded-md transition-colors relative',
            isActive
              ? 'bg-accent text-foreground'
              : 'hover:bg-accent text-muted-foreground hover:text-foreground'
          )}
          title={tooltipText}
        >
          <Icon size={16} />
          {isActive && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
      </TagInputDropdown>
    )
  }

  // 渲染按钮（根据类型选择不同渲染方式）
  const renderButtonByType = (btn: ToolButtonConfig) => {
    if (btn.id === 'tag') {
      return renderTagButton(btn)
    }
    return renderButton(btn)
  }

  return (
    <div className="relative flex items-center justify-between px-2 py-1.5 border-b border-border/50 drag">
      <div className="flex items-center gap-1">
        {leftButtons.map(renderButtonByType)}
        {mode === 'code' && (
          <>
            <LanguageSelector
              languages={languages}
              selectedLanguage={selectedLanguage}
              onLanguageChange={onLanguageChange}
            />
            <CodeMirrorSettings
              config={codeMirrorConfig}
              onConfigChange={onCodeMirrorConfigChange}
            />
          </>
        )}
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

      <div className="flex items-center gap-1">{rightButtons.map(renderButton)}</div>
    </div>
  )
}

export default EditToolHeader
