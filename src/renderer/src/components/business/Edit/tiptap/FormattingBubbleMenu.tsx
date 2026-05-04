import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Quote,
  Sparkles,
  Strikethrough
} from 'lucide-react'
import {
  AI_ACTIONS,
  QUICK_ACTIONS,
  type AIAction,
  buildAIPrompt,
  parseAIResultToContent
} from './ai'

interface FormattingBubbleMenuProps {
  editor: Editor
}

interface PreviewState {
  active: boolean
  generatedText: string
}

interface FormatButton {
  id: string
  title: string
  icon: React.ComponentType<{ size?: number }>
  active: () => boolean
  run: () => void
}

export function FormattingBubbleMenu({ editor }: FormattingBubbleMenuProps): React.JSX.Element {
  const [showDropdown, setShowDropdown] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [previewState, setPreviewState] = useState<PreviewState | null>(null)
  const [panelPlacement, setPanelPlacement] = useState<'top' | 'bottom'>('bottom')
  const cleanupRef = useRef<Array<() => void>>([])
  const selectionRef = useRef<{ from: number; to: number } | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const formatButtons: FormatButton[] = [
    {
      id: 'bold',
      title: '加粗',
      icon: Bold,
      active: () => editor.isActive('bold'),
      run: () => editor.chain().focus().toggleBold().run()
    },
    {
      id: 'italic',
      title: '斜体',
      icon: Italic,
      active: () => editor.isActive('italic'),
      run: () => editor.chain().focus().toggleItalic().run()
    },
    {
      id: 'strike',
      title: '删除线',
      icon: Strikethrough,
      active: () => editor.isActive('strike'),
      run: () => editor.chain().focus().toggleStrike().run()
    },
    {
      id: 'code',
      title: '行内代码',
      icon: Code,
      active: () => editor.isActive('code'),
      run: () => editor.chain().focus().toggleCode().run()
    },
    {
      id: 'h1',
      title: '标题 1',
      icon: Heading1,
      active: () => editor.isActive('heading', { level: 1 }),
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run()
    },
    {
      id: 'h2',
      title: '标题 2',
      icon: Heading2,
      active: () => editor.isActive('heading', { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run()
    },
    {
      id: 'h3',
      title: '标题 3',
      icon: Heading3,
      active: () => editor.isActive('heading', { level: 3 }),
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run()
    },
    {
      id: 'bulletList',
      title: '无序列表',
      icon: List,
      active: () => editor.isActive('bulletList'),
      run: () => editor.chain().focus().toggleBulletList().run()
    },
    {
      id: 'orderedList',
      title: '有序列表',
      icon: ListOrdered,
      active: () => editor.isActive('orderedList'),
      run: () => editor.chain().focus().toggleOrderedList().run()
    },
    {
      id: 'blockquote',
      title: '引用',
      icon: Quote,
      active: () => editor.isActive('blockquote'),
      run: () => editor.chain().focus().toggleBlockquote().run()
    }
  ]

  const getSelectedText = (): string => {
    const { from, to } = editor.state.selection
    if (from === to) return ''
    return editor.state.doc.textBetween(from, to)
  }

  const cleanupListeners = (): void => {
    cleanupRef.current.forEach((cleanup) => cleanup())
    cleanupRef.current = []
  }

  const handleAIAction = async (action: AIAction): Promise<void> => {
    const selectedText = getSelectedText()
    if (!selectedText || aiLoading || previewState?.active) return

    const actionItem = AI_ACTIONS.find((item) => item.id === action)
    if (!actionItem) return

    setShowDropdown(false)
    setAiLoading(true)
    setAiResult('')
    selectionRef.current = {
      from: editor.state.selection.from,
      to: editor.state.selection.to
    }
    cleanupListeners()

    try {
      const models = await window.api.aiGetEnabledModels()
      if (models.length === 0) {
        setAiResult('错误：没有可用的 AI 模型，请先在设置中配置。')
        setAiLoading(false)
        return
      }

      const sessionId = `ai-menu-${Date.now()}`
      const unsubscribeChunk = window.api.aiOnStreamChunk(sessionId, (chunk: string) => {
        setAiResult((prev) => prev + chunk)
      })
      const unsubscribeComplete = window.api.aiOnStreamComplete(sessionId, () => {
        cleanupListeners()
        setAiLoading(false)
        const finalResult = aiResultRef.current.trim()
        if (!finalResult) {
          return
        }
        setPreviewState({
          active: true,
          generatedText: finalResult
        })
      })
      const unsubscribeError = window.api.aiOnStreamError(sessionId, (error: string) => {
        cleanupListeners()
        setAiResult(`错误：${error}`)
        setAiLoading(false)
      })

      cleanupRef.current = [unsubscribeChunk, unsubscribeComplete, unsubscribeError]

      await window.api.aiStreamCompletion(
        models[0].id,
        [{ role: 'user', content: buildAIPrompt(actionItem.prompt, selectedText) }],
        {},
        sessionId
      )
    } catch (error) {
      console.error('AI action failed:', error)
      cleanupListeners()
      setAiResult('错误：请求失败，请重试。')
      setAiLoading(false)
    }
  }

  const handleApplyResult = (): void => {
    if (!previewState?.generatedText || !selectionRef.current) return
    editor
      .chain()
      .focus()
      .setTextSelection(selectionRef.current)
      .deleteSelection()
      .insertContent(parseAIResultToContent(previewState.generatedText))
      .run()
    setPreviewState(null)
    setShowDropdown(false)
    setAiResult('')
    selectionRef.current = null
  }

  const handleRejectPreview = (): void => {
    if (!previewState?.active) return
    setPreviewState(null)
    setShowDropdown(false)
    setAiResult('')
    selectionRef.current = null
  }

  const aiResultRef = useRef('')

  useEffect(() => {
    aiResultRef.current = aiResult
  }, [aiResult])

  useEffect(() => {
    const handleSelectionUpdate = (): void => {
      if (showDropdown && !previewState?.active && !aiLoading) {
        setShowDropdown(false)
      }
    }

    editor.on('selectionUpdate', handleSelectionUpdate)
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
      cleanupListeners()
    }
  }, [editor, showDropdown, previewState?.active, aiLoading])

  useEffect(() => {
    if (!aiLoading && !previewState?.active) return

    const updatePlacement = (): void => {
      if (!wrapperRef.current) return
      const rect = wrapperRef.current.getBoundingClientRect()
      const estimatedPanelHeight = 360
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      setPanelPlacement(
        spaceBelow < estimatedPanelHeight && spaceAbove > spaceBelow ? 'top' : 'bottom'
      )
    }

    updatePlacement()
    window.addEventListener('resize', updatePlacement)
    window.addEventListener('scroll', updatePlacement, true)

    return () => {
      window.removeEventListener('resize', updatePlacement)
      window.removeEventListener('scroll', updatePlacement, true)
    }
  }, [aiLoading, previewState?.active])

  const panelPositionClass =
    panelPlacement === 'top' ? 'bottom-full mb-2 left-0' : 'top-full mt-2 left-0'

  return (
    <BubbleMenu
      editor={editor}
      updateDelay={500}
      pluginKey="format-bubble-menu"
      shouldShow={({ from, to }) =>
        from !== to ||
        showDropdown ||
        aiLoading ||
        Boolean(aiResult) ||
        Boolean(previewState?.active)
      }
    >
      <div ref={wrapperRef} className="relative">
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-popover px-1 py-1 shadow-lg">
          {formatButtons.slice(0, 4).map((button) => {
            const Icon = button.icon
            return (
              <button
                key={button.id}
                onClick={button.run}
                className={`rounded p-1.5 transition-colors hover:bg-accent ${
                  button.active() ? 'bg-accent text-foreground' : 'text-muted-foreground'
                }`}
                title={button.title}
                disabled={Boolean(previewState?.active)}
              >
                <Icon size={14} />
              </button>
            )
          })}
          <div className="mx-1 h-4 w-px bg-border" />
          {formatButtons.slice(4, 7).map((button) => {
            const Icon = button.icon
            return (
              <button
                key={button.id}
                onClick={button.run}
                className={`rounded p-1.5 transition-colors hover:bg-accent ${
                  button.active() ? 'bg-accent text-foreground' : 'text-muted-foreground'
                }`}
                title={button.title}
                disabled={Boolean(previewState?.active)}
              >
                <Icon size={14} />
              </button>
            )
          })}
          <div className="mx-1 h-4 w-px bg-border" />
          {formatButtons.slice(7).map((button) => {
            const Icon = button.icon
            return (
              <button
                key={button.id}
                onClick={button.run}
                className={`rounded p-1.5 transition-colors hover:bg-accent ${
                  button.active() ? 'bg-accent text-foreground' : 'text-muted-foreground'
                }`}
                title={button.title}
                disabled={Boolean(previewState?.active)}
              >
                <Icon size={14} />
              </button>
            )
          })}
          <div className="mx-1 h-4 w-px bg-border" />
          <button
            onClick={() => setShowDropdown((prev) => !prev)}
            className="rounded p-1.5 text-purple-600 transition-colors hover:bg-accent"
            title="AI 助手"
            disabled={Boolean(previewState?.active)}
          >
            <Sparkles size={14} />
          </button>
        </div>

        {showDropdown ? (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[150px] rounded-lg border border-border bg-popover shadow-lg">
            <div className="p-1">
              {QUICK_ACTIONS.map((actionId) => {
                const action = AI_ACTIONS.find((item) => item.id === actionId)
                if (!action) return null
                return (
                  <button
                    key={action.id}
                    onClick={() => void handleAIAction(action.id)}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
                    title={action.label}
                  >
                    <span className="h-1 w-1 rounded-full bg-purple-600" />
                    <span>{action.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {aiLoading ? (
          <div
            className={`absolute z-50 flex w-80 max-w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-lg ${panelPositionClass}`}
          >
            <div className="border-b bg-muted/30 px-3 py-2 text-sm font-medium">AI 预览生成中</div>
            <div className="max-h-[min(50vh,18rem)] overflow-auto px-3 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                <span>正在生成...</span>
              </div>
              <div className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm leading-6 text-foreground/85">
                {aiResult || '正在生成...'}
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse align-middle bg-purple-600" />
              </div>
            </div>
          </div>
        ) : null}

        {previewState?.active ? (
          <div
            className={`absolute z-50 flex w-80 max-w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-lg ${panelPositionClass}`}
          >
            <div className="border-b bg-muted/30 px-3 py-2">
              <div className="text-sm font-medium">AI 预览</div>
              <div className="mt-1 text-xs text-muted-foreground">
                先确认结果，再决定是否替换当前选区。
              </div>
            </div>
            <div className="max-h-[min(50vh,18rem)] overflow-auto px-3 py-3">
              <div className="whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm leading-6 text-foreground/85">
                {previewState.generatedText}
              </div>
            </div>
            <div className="flex items-center gap-2 border-t bg-background px-3 py-3">
              <button
                onClick={handleRejectPreview}
                className="flex-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
              >
                不接受
              </button>
              <button
                onClick={handleApplyResult}
                className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                接受修改
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </BubbleMenu>
  )
}
