import {
  ChartNoAxesGantt,
  Copy,
  Tag,
  Trash2,
  Save,
  PenTool,
  Download,
  LucideIcon,
  Bot
} from 'lucide-react'
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useEditorContext } from '@renderer/provider/EditorProvider'
import { useExport } from '@renderer/provider/ExportProvider'
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
import { useList } from '@renderer/provider/ListProvider'

export type { EditorMode, LanguageConfig, CodeMirrorConfig } from './types'

// 按钮配置类型
interface ToolButtonConfig {
  id: string
  icon: LucideIcon
  tooltip: string | (() => string)
  onClick?: () => void
  isActive?: boolean | (() => boolean)
  disabled?: boolean
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
  title: string
  onTitleChange: (title: string) => void
  mode?: EditorMode
  onModeChange?: (mode: EditorMode) => void
  languages?: LanguageConfig[]
  selectedLanguage?: string
  onLanguageChange?: (langId: string) => void
  codeMirrorConfig?: CodeMirrorConfig
  onCodeMirrorConfigChange?: (config: CodeMirrorConfig) => void
  tags?: TagItem[]
  onTagsChange?: (tags: TagItem[]) => void
  noteId?: string
  noteContent?: string // 添加笔记内容用于 AI 生成标签
  onExport?: () => Promise<void>
  noteType?: 'document' | 'snippet'
}

const EditToolHeader: React.FC<EditToolHeaderProps> = ({
  title,
  onTitleChange,
  mode = 'word',
  onModeChange: _onModeChange,
  languages = DEFAULT_LANGUAGES,
  selectedLanguage = 'javascript',
  onLanguageChange,
  codeMirrorConfig = DEFAULT_CODEMIRROR_CONFIG,
  onCodeMirrorConfigChange,
  tags = [],
  onTagsChange,
  noteId,
  noteContent = '',
  noteType = 'document'
}) => {
  const {
    outlineOpen,
    toggleOutline,
    toolbarOpen,
    toggleToolbar,
    aiPanelOpen,
    toggleAiPanel,
    editor,
    setAIInputText
  } = useEditorContext()
  const { exportToPDF, exportToImage, exportToMarkdown } = useExport()
  const { deleteNote } = useList()
  const [isExporting, setIsExporting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editValue, setEditValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  // 处理 AI 按钮点击
  const handleAIButtonClick = useCallback(() => {
    if (editor) {
      const { from, to } = editor.state.selection
      if (from !== to) {
        const selectedText = editor.state.doc.textBetween(from, to)
        setAIInputText(selectedText)
      }
    }
    toggleAiPanel()
  }, [editor, setAIInputText, toggleAiPanel])

  // 处理导出为 PDF
  const handleExportPDF = useCallback(async () => {
    if (!noteId || isExporting) return

    try {
      setIsExporting(true)
      await exportToPDF(noteId)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }, [noteId, isExporting, exportToPDF])

  // 处理导出为图片
  const handleExportImage = useCallback(async () => {
    if (!noteId || isExporting) return

    try {
      setIsExporting(true)
      await exportToImage(noteId)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }, [noteId, isExporting, exportToImage])

  // 处理导出为 Markdown (主要用于代码片段)
  const handleExportMarkdown = useCallback(async () => {
    if (!noteId || isExporting) return

    try {
      setIsExporting(true)
      await exportToMarkdown(noteId)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }, [noteId, isExporting, exportToMarkdown])

  // 处理删除笔记
  const handleDelete = useCallback(async () => {
    if (!noteId) return
    const success = await deleteNote(noteId)
    if (success) {
      setDeleteDialogOpen(false)
    }
  }, [noteId, deleteNote])

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
    onTitleChange(newTitle)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false)
      const newTitle = editValue.trim() || '未命名文档'
      onTitleChange(newTitle)
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
            id: 'ai',
            icon: Bot,
            tooltip: () => (aiPanelOpen ? '收起AI助手' : 'AI助手'),
            onClick: handleAIButtonClick,
            isActive: () => aiPanelOpen
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
            id: 'export',
            icon: Download,
            tooltip: '导出',
            disabled: !noteId || isExporting
          },
          {
            id: 'delete',
            icon: Trash2,
            tooltip: '删除',
            variant: 'destructive',
            onClick: () => setDeleteDialogOpen(true)
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
    [
      outlineOpen,
      toggleOutline,
      toolbarOpen,
      toggleToolbar,
      aiPanelOpen,
      handleAIButtonClick,
      handleExportPDF,
      handleExportImage,
      handleExportMarkdown,
      noteId,
      isExporting
    ]
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
    const isDisabled = btn.disabled || false

    const getButtonClassName = () => {
      if (isDisabled) {
        return 'opacity-50 cursor-not-allowed text-muted-foreground'
      }
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
            disabled={isDisabled}
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
    // const isActive = tags.length > 0

    return (
      <TagInputDropdown
        key={btn.id}
        tags={tags}
        onTagsChange={onTagsChange}
        noteId={noteId}
        noteContent={noteContent}
      >
        <button
          className={cn(
            'p-1.5 rounded-md transition-colors relative',
            'hover:bg-accent text-muted-foreground hover:text-foreground'
          )}
          title={tooltipText}
        >
          <Icon size={16} />
        </button>
      </TagInputDropdown>
    )
  }

  // 渲染按钮（根据类型选择不同渲染方式）
  const renderButtonByType = (btn: ToolButtonConfig) => {
    if (btn.id === 'tag') {
      return renderTagButton(btn)
    }
    if (btn.id === 'export') {
      const Icon = btn.icon
      const isDisabled = btn.disabled || false

      return (
        <DropdownMenu key={btn.id}>
          <DropdownMenuTrigger asChild>
            <button
              disabled={isDisabled || isExporting}
              className={cn(
                'p-1.5 rounded-md transition-colors relative',
                isDisabled || isExporting
                  ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                  : 'hover:bg-accent text-muted-foreground hover:text-foreground'
              )}
            >
              {isExporting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
              ) : (
                <Icon size={16} />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {noteType === 'document' ? (
              <>
                <DropdownMenuItem onClick={handleExportPDF} disabled={isExporting}>
                  导出为 PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportImage} disabled={isExporting}>
                  导出为图片
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={handleExportMarkdown} disabled={isExporting}>
                导出为 Markdown
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
    return renderButton(btn)
  }

  return (
    <>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>移到废纸篓</DialogTitle>
            <DialogDescription>
              该笔记将被移到废纸篓,可以在废纸篓中恢复或彻底删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="default" onClick={handleDelete}>
              移到废纸篓
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

        <div className="flex items-center gap-1">{rightButtons.map(renderButtonByType)}</div>
      </div>
    </>
  )
}

export default EditToolHeader
