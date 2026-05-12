import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown, { Components } from 'react-markdown'
import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { AIMessage, AIModelConfig } from '@renderer/types/ai'
import ScrollArea from '@renderer/components/ui/scroll-area'
import { useEditorContext } from '@renderer/provider/EditorProvider'
import { useList } from '@renderer/provider/ListProvider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import {
  Bot,
  Bug,
  Check,
  ChevronDown,
  Clipboard,
  Copy,
  FilePenLine,
  Loader2,
  MessageSquareQuote,
  MoveDown,
  PencilRuler,
  Replace,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AgentChangePreview,
  AgentResponseParts,
  AgentToolCall,
  DiffLine,
  buildCodeAgentSystemPrompt,
  buildLineDiff,
  countDiffStats,
  extractBodyContent,
  getToolCallLabel,
  getToolCallSummary,
  isNonActionableToolCall,
  parseAgentResponse,
  resolveDraftDocument
} from './codeAgent'

interface AISidebarProps {
  className?: string
  editorMode?: 'word' | 'code'
  currentDocumentContent?: string
}

interface MarkdownCodeProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean
  className?: string
  children?: React.ReactNode
}

interface AISessionState {
  messages: SidebarMessage[]
  input: string
  contextText: string
  selectedModel: string
  interactionMode: AISidebarMode
  workspaceSession: CodeWorkspaceSession | null
}

type AISidebarMode = 'ask' | 'edit'

const SUPPORTED_AGENT_WRITE_TOOLS = new Set<AgentToolCall['name']>([
  'modify_current_file',
  'replace_current_file',
  'apply_patch',
  'apply_diff',
  'replace_file'
])

interface SidebarMessage extends AIMessage {
  id: string
  mode?: AISidebarMode
  sourceDocument?: string
  agentResult?: {
    kind: 'applied'
    added: number
    removed: number
    diffLines: DiffLine[]
    summaryLines: string[]
    toolSummary?: string
    prompt: string
    summaryStatus: 'loading' | 'ready' | 'failed'
    summaryText?: string
  }
}

interface SelectedCommand {
  label: string
  prompt: string
  icon: React.ComponentType<{ className?: string }>
}

interface MessageAction {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
  disabled?: boolean
  active?: boolean
}

interface MessageActionGroup {
  id: string
  actions: MessageAction[]
}

interface WorkspaceValidationState {
  status: 'idle' | 'running' | 'passed' | 'failed'
  output?: string
}

interface AgentToolEvent {
  id: string
  label: string
  detail?: string
  status: 'running' | 'done' | 'failed'
}

interface CodeWorkspaceSession {
  prompt: string
  status: 'idle' | 'generating' | 'ready' | 'applied' | 'failed'
  sourceDocument: string
  draftDocument: string
  responseContent: string
  summaryLines: string[]
  notes: string
  toolCall: AgentToolCall | null
  toolEvents: AgentToolEvent[]
  actionable: boolean
  changePreviews: AgentChangePreview[]
  previewIssue?: string
  diffLines: DiffLine[]
  error?: string
  validation: WorkspaceValidationState
}

function getCodeLanguage(className?: string): string {
  const match = className?.match(/language-([\w-]+)/)
  return match?.[1] || 'text'
}

function shouldRenderAsInlineCodeBlock(language: string, content: string): boolean {
  const normalizedLanguage = language.toLowerCase()
  const normalizedContent = content.trim()
  const isPlainText = normalizedLanguage === 'text' || normalizedLanguage === 'plain'

  return (
    isPlainText &&
    normalizedContent.length > 0 &&
    normalizedContent.length <= 80 &&
    !normalizedContent.includes('\n')
  )
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getModeLabel(mode: AISidebarMode): string {
  if (mode === 'edit') return 'EDIT'
  return 'ASK'
}

function normalizeSummaryMarkdown(content: string): string {
  return content
    .replace(/```[\w-]*\n([\s\S]*?)```/g, (_match, rawCode) => {
      const code = String(rawCode).trim()
      if (!code) return ''

      const singleLineCode = code.replace(/\n+/g, ' ').trim()
      if (singleLineCode.length <= 120) {
        return `\`${singleLineCode}\``
      }

      return code
    })
    .replace(/^\s*`([^`\n]{1,120})`\s*$/gm, '`$1`')
    .replace(/^( {4}|\t)(.+)$/gm, (_match, _indent, code) => `\`${String(code).trim()}\``)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildDiffPreview(diffLines: DiffLine[]): string {
  const preview = diffLines
    .filter((line) => line.type !== 'context')
    .slice(0, 3)
    .map((line) => line.content.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')

  return preview || '查看本次代码修改明细'
}

function buildAppliedSummaryPrompt(params: {
  userPrompt: string
  toolSummary?: string
  diffLines: DiffLine[]
  added: number
  removed: number
}): string {
  const { userPrompt, toolSummary, diffLines, added, removed } = params
  const diffPreview = diffLines
    .filter((line) => line.type !== 'context')
    .slice(0, 80)
    .map((line) => `${line.type === 'added' ? '+' : '-'} ${line.content}`)
    .join('\n')

  return [
    '请用中文简洁总结本次代码修改结果。',
    '要求：',
    '- 2 到 4 条要点',
    '- 直接说明改了什么、为什么改、用户现在可以验证什么',
    '- 不要输出寒暄，不要重复原始提示，不要输出 fenced code block',
    '- 提到字段名、字面量、标识符时，使用行内反引号，例如 `id`、`name`、`feature-1`',
    '',
    `用户原始诉求：${userPrompt}`,
    toolSummary ? `工具摘要：${toolSummary}` : '',
    `变更统计：+${added} / -${removed}`,
    'Diff 摘要：',
    diffPreview || '(无可用 diff 摘要)'
  ]
    .filter(Boolean)
    .join('\n')
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copied
  } catch (error) {
    console.error('Copy failed:', error)
    return false
  }
}

function StreamMarkdown({
  content,
  className,
  compactCodeBlocks = false
}: {
  content: string
  className?: string
  compactCodeBlocks?: boolean
}): React.JSX.Element {
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)
  const copyTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current)
      }
    }
  }, [])

  const components = useMemo<Components>(() => {
    return {
      code(props) {
        // eslint-disable-next-line react/prop-types
        const { inline, className, children, ...rest } = props as MarkdownCodeProps
        const codeContent = String(children ?? '').replace(/\n$/, '')
        const language = getCodeLanguage(className)

        if (inline) {
          return (
            <code className="rounded bg-muted px-1.5 py-0.5 text-[0.85em]" {...rest}>
              {children}
            </code>
          )
        }

        if (shouldRenderAsInlineCodeBlock(language, codeContent)) {
          return (
            <code className="rounded bg-muted px-1.5 py-0.5 text-[0.85em]" {...rest}>
              {codeContent}
            </code>
          )
        }

        if (compactCodeBlocks) {
          return (
            <code
              className="rounded-md bg-muted px-1.5 py-0.5 text-[0.9em] text-foreground/92"
              {...rest}
            >
              {codeContent.replace(/\n+/g, ' ')}
            </code>
          )
        }

        const codeId = `${language}:${codeContent.slice(0, 32)}:${codeContent.length}`
        const isCopied = copiedCodeId === codeId

        return (
          <div className="my-1.5 overflow-hidden rounded-md border bg-muted/12">
            <div className="flex items-center justify-between border-b bg-muted/38 px-2.5 py-1">
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {language}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px]"
                onClick={async () => {
                  const ok = await copyToClipboard(codeContent)
                  if (!ok) return
                  setCopiedCodeId(codeId)
                  if (copyTimerRef.current) {
                    window.clearTimeout(copyTimerRef.current)
                  }
                  copyTimerRef.current = window.setTimeout(() => {
                    setCopiedCodeId(null)
                  }, 1500)
                }}
              >
                {isCopied ? (
                  <>
                    <Check className="size-3.5" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    复制
                  </>
                )}
              </Button>
            </div>
            <ScrollArea className="max-h-[320px]" orientation="both">
              <div className="px-2.5 py-1.5 pr-4">
                <pre className="m-0 min-w-max text-[12.5px] leading-5">
                  <code className={cn('block', className)} {...rest}>
                    {codeContent}
                  </code>
                </pre>
              </div>
            </ScrollArea>
          </div>
        )
      }
    }
  }, [copiedCodeId])

  return (
    <div
      className={cn(
        [
          'prose prose-sm dark:prose-invert max-w-none',
          'prose-p:my-1.5 prose-p:leading-6',
          'prose-headings:my-3 prose-headings:leading-tight',
          'prose-ul:my-1.5 prose-ol:my-1.5',
          'prose-li:my-0.5',
          'prose-blockquote:my-2',
          'prose-pre:my-2 prose-pre:bg-transparent prose-pre:p-0',
          'prose-hr:my-3',
          '[&>:first-child]:mt-0 [&>:last-child]:mb-0'
        ],
        className
      )}
    >
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  )
}

export function AISidebar({
  className,
  editorMode = 'word',
  currentDocumentContent = ''
}: AISidebarProps): React.JSX.Element {
  const { selectedNote } = useList()
  const {
    editor,
    getAIInputText,
    clearAIInputText,
    getAIContextText,
    setAIContextText,
    clearAIContextText,
    aiPanelOpen,
    getCodeSelectionText,
    clearCodeSelectionText,
    getCodeEditorView,
    getCodeDocument,
    replaceCodeDocument
  } = useEditorContext()
  const [models, setModels] = useState<AIModelConfig[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [messages, setMessages] = useState<SidebarMessage[]>([])
  const [input, setInput] = useState('')
  const [contextText, setContextText] = useState('')
  const [interactionMode, setInteractionMode] = useState<AISidebarMode>('ask')
  const [streamingResponse, setStreamingResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const [workspaceSession, setWorkspaceSession] = useState<CodeWorkspaceSession | null>(null)
  const [copiedMessageKey, setCopiedMessageKey] = useState<string | null>(null)
  const [openDiffMessageKey, setOpenDiffMessageKey] = useState<string | null>(null)
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const [slashIndex, setSlashIndex] = useState(0)
  const [pendingCommand, setPendingCommand] = useState<SelectedCommand | null>(null)

  const messageEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const currentResponseRef = useRef('')
  const currentSessionIdRef = useRef<string | null>(null)
  const currentEditRunIdRef = useRef<string | null>(null)
  const copiedMessageTimerRef = useRef<number | null>(null)
  const sessionsRef = useRef<Record<string, AISessionState>>({})
  const currentNoteKey = selectedNote?.id ?? '__global__'
  const previousNoteKeyRef = useRef(currentNoteKey)
  const activeGeneratingRun = workspaceSession?.status === 'generating'

  const getSelectedEditorText = useMemo(() => {
    return (): string => {
      if (!editor) return ''
      const { from, to } = editor.state.selection
      if (from === to) return ''
      return editor.state.doc.textBetween(from, to).trim()
    }
  }, [editor])

  const getSelectedCodeText = useMemo(() => {
    return (): string => {
      return getCodeSelectionText()
    }
  }, [getCodeSelectionText])

  const getCurrentCodeDocument = (): string => {
    return currentDocumentContent || getCodeDocument() || selectedNote?.content || ''
  }

  const resolveCurrentContextText = (): string => {
    if (editorMode === 'code') {
      const currentCodeDocument = getCurrentCodeDocument().trim()
      const selectedCode = getSelectedCodeText().trim()
      if (selectedCode && currentCodeDocument.includes(selectedCode)) {
        return selectedCode
      }
      return currentCodeDocument
    }

    const selectedText = getSelectedEditorText()
    if (selectedText) return selectedText

    return getAIContextText()
  }

  useEffect(() => {
    const externalInput = getAIInputText()
    if (externalInput) {
      setInput(externalInput)
      clearAIInputText()
    }
  }, [aiPanelOpen, getAIInputText, clearAIInputText])

  useEffect(() => {
    if (!aiPanelOpen) return

    const nextContextText = resolveCurrentContextText()
    setContextText(nextContextText)
    if (nextContextText) {
      setAIContextText(nextContextText)
    } else {
      clearAIContextText()
    }
  }, [
    aiPanelOpen,
    currentNoteKey,
    currentDocumentContent,
    editorMode,
    getCodeDocument,
    getSelectedCodeText,
    getSelectedEditorText,
    clearAIContextText,
    setAIContextText
  ])

  useEffect(() => {
    if (editorMode !== 'word' || !editor || !aiPanelOpen) return

    const handleSelectionUpdate = (): void => {
      const selectedText = getSelectedEditorText()
      if (!selectedText) return
      setContextText(selectedText)
      setAIContextText(selectedText)
    }

    editor.on('selectionUpdate', handleSelectionUpdate)
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
    }
  }, [aiPanelOpen, currentNoteKey, editor, editorMode, getSelectedEditorText, setAIContextText])

  useEffect(() => {
    loadModels()
  }, [])

  useEffect(() => {
    sessionsRef.current[currentNoteKey] = {
      messages,
      input,
      contextText,
      selectedModel,
      interactionMode,
      workspaceSession
    }
  }, [
    currentNoteKey,
    messages,
    input,
    contextText,
    selectedModel,
    interactionMode,
    workspaceSession
  ])

  useEffect(() => {
    const previousNoteKey = previousNoteKeyRef.current
    if (previousNoteKey === currentNoteKey) return

    const activeSessionId = currentSessionIdRef.current
    if (activeSessionId) {
      void window.api.aiCancelStream(activeSessionId)
      currentSessionIdRef.current = null
      currentEditRunIdRef.current = null
    }

    sessionsRef.current[previousNoteKey] = {
      messages,
      input,
      contextText,
      selectedModel,
      interactionMode,
      workspaceSession
    }

    const nextSession = sessionsRef.current[currentNoteKey]
    setMessages(nextSession?.messages ?? [])
    setInput(nextSession?.input ?? '')
    setContextText('')
    setWorkspaceSession(nextSession?.workspaceSession ?? null)
    setStreamingResponse('')
    currentResponseRef.current = ''
    setIsLoading(false)

    if (nextSession?.selectedModel) {
      setSelectedModel(nextSession.selectedModel)
    }
    setInteractionMode(nextSession?.interactionMode === 'edit' ? 'edit' : 'ask')

    clearAIContextText()
    clearCodeSelectionText()

    previousNoteKeyRef.current = currentNoteKey
  }, [
    currentNoteKey,
    messages,
    input,
    contextText,
    selectedModel,
    interactionMode,
    workspaceSession,
    clearAIContextText,
    clearCodeSelectionText
  ])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, workspaceSession?.status])

  useEffect(() => {
    if (activeGeneratingRun) return
    if (!streamingResponse) return
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [streamingResponse, activeGeneratingRun])

  useEffect(() => {
    return () => {
      if (copiedMessageTimerRef.current) {
        window.clearTimeout(copiedMessageTimerRef.current)
      }
    }
  }, [])

  const loadModels = async (): Promise<void> => {
    try {
      const enabledModels = await window.api.aiGetEnabledModels()
      setModels(enabledModels)
      if (enabledModels.length > 0) {
        setSelectedModel(enabledModels[0].id)
      }
    } catch (error) {
      console.error('Failed to load models:', error)
    }
  }

  const handleConversationSend = async (
    prompt: string,
    options?: { baseMessages?: SidebarMessage[]; modeOverride?: AISidebarMode }
  ): Promise<void> => {
    const baseMessages = options?.baseMessages ?? messages
    const currentCodeDocument = editorMode === 'code' ? getCurrentCodeDocument() : ''
    const currentContextText = resolveCurrentContextText()
    const userMessage: SidebarMessage = {
      id: createMessageId('user'),
      role: 'user',
      content: prompt,
      mode: editorMode === 'code' ? (options?.modeOverride ?? interactionMode) : undefined
    }

    const referenceMessage = currentContextText
      ? [
          {
            role: 'system' as const,
            content: `当前编辑器${editorMode === 'code' ? '代码' : '文本'}引用如下，请优先结合它回答用户问题。\n\n${currentContextText}`
          }
        ]
      : []

    const requestMessages: AIMessage[] = [
      ...referenceMessage,
      ...baseMessages.map(({ role, content }) => ({ role, content })),
      { role: userMessage.role, content: userMessage.content }
    ]

    setMessages([...baseMessages, userMessage])
    setContextText(currentContextText)
    if (currentContextText) {
      setAIContextText(currentContextText)
    } else {
      clearAIContextText()
    }
    setInput('')
    setPendingCommand(null)
    setStreamingResponse('')
    currentResponseRef.current = ''
    setIsLoading(true)

    const sessionId = `stream-${Date.now()}`
    currentSessionIdRef.current = sessionId
    let unsubscribeChunk: (() => void) | undefined
    let unsubscribeComplete: (() => void) | undefined
    let unsubscribeError: (() => void) | undefined

    try {
      unsubscribeChunk = window.api.aiOnStreamChunk(sessionId, (chunk: string) => {
        if (currentSessionIdRef.current !== sessionId) return
        setStreamingResponse((prev) => {
          const next = prev + chunk
          currentResponseRef.current = next
          const parsedResponse = parseAgentResponse(next)
          setWorkspaceSession((current) =>
            current?.status === 'generating'
              ? {
                  ...current,
                  responseContent: next,
                  summaryLines: parsedResponse.summaryLines,
                  notes: parsedResponse.body,
                  toolCall: parsedResponse.toolCall,
                  changePreviews: parsedResponse.changePreviews
                }
              : current
          )
          return next
        })
      })

      unsubscribeComplete = window.api.aiOnStreamComplete(sessionId, () => {
        if (currentSessionIdRef.current !== sessionId) return
        const finalResponse = currentResponseRef.current.trim()
        if (finalResponse) {
          setMessages((prev) => [
            ...prev,
            {
              id: createMessageId('assistant'),
              role: 'assistant',
              content: finalResponse,
              mode: editorMode === 'code' ? (options?.modeOverride ?? interactionMode) : undefined,
              sourceDocument: currentCodeDocument || undefined
            }
          ])
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: createMessageId('assistant-error'),
              role: 'assistant',
              content: '模型没有返回内容。'
            }
          ])
        }

        setStreamingResponse('')
        currentResponseRef.current = ''
        currentSessionIdRef.current = null
        setIsLoading(false)
      })

      unsubscribeError = window.api.aiOnStreamError(sessionId, (error: string) => {
        if (currentSessionIdRef.current !== sessionId) return
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId('assistant-error'),
            role: 'assistant',
            content: `请求失败：${error}`
          }
        ])
        setStreamingResponse('')
        currentResponseRef.current = ''
        currentSessionIdRef.current = null
        setIsLoading(false)
      })

      const result = await window.api.aiStreamCompletion(selectedModel, requestMessages, {}, sessionId)
      if (!result.success) {
        throw new Error(result.error || 'AI stream failed')
      }
    } catch (error) {
      if (currentSessionIdRef.current !== sessionId) return
      console.error('Failed to send message:', error)
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId('assistant-error'),
          role: 'assistant',
          content: '请求失败，请稍后重试。'
        }
      ])
      setStreamingResponse('')
      currentResponseRef.current = ''
      currentSessionIdRef.current = null
      setIsLoading(false)
    } finally {
      unsubscribeChunk?.()
      unsubscribeComplete?.()
      unsubscribeError?.()
    }
  }

  const handleAgentRun = async (prompt: string): Promise<void> => {
    const editRunId = `edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    currentEditRunIdRef.current = editRunId
    const currentCodeDocument = getCurrentCodeDocument()
    const currentContextText = resolveCurrentContextText()
    const requestMessages: AIMessage[] = [
      {
        role: 'system',
        content: buildCodeAgentSystemPrompt({
          title: selectedNote?.title || '未命名内容',
          language: selectedNote?.language || 'plaintext',
          currentDocument: currentCodeDocument
        })
      },
      ...(currentContextText
        ? [
            {
              role: 'system' as const,
              content: `当前选中的代码引用如下，请在必要时优先参考它：\n\n${currentContextText}`
            }
          ]
        : []),
      { role: 'user', content: prompt }
    ]

    setMessages((prev) => [
      ...prev,
      { id: createMessageId('user'), role: 'user', content: prompt, mode: 'edit' as const }
    ])
    setInput('')
    setContextText(currentContextText)
    if (currentContextText) {
      setAIContextText(currentContextText)
    } else {
      clearAIContextText()
    }
    setPendingCommand(null)
    setStreamingResponse('')
    currentResponseRef.current = ''
    setWorkspaceSession({
      prompt,
      status: 'generating',
      sourceDocument: currentCodeDocument,
      draftDocument: '',
      responseContent: '',
      summaryLines: [],
      notes: '',
      toolCall: null,
      toolEvents: [],
      actionable: false,
      changePreviews: [],
      diffLines: [],
      validation: { status: 'idle' }
    })
    setIsLoading(true)

    const updateToolEvent = (event: AgentToolEvent): void => {
      setWorkspaceSession((prev) =>
        prev
          ? {
              ...prev,
              toolEvents: prev.toolEvents.some((item) => item.id === event.id)
                ? prev.toolEvents.map((item) => (item.id === event.id ? event : item))
                : [...prev.toolEvents, event]
            }
          : prev
      )
    }

    const streamAgentTurn = async (
      agentMessages: AIMessage[],
      eventId: string
    ): Promise<string> => {
      const sessionId = `edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const staleStreamMessage = '本次 Edit 生成已被新的请求或内容切换中断。'
      currentSessionIdRef.current = sessionId
      currentResponseRef.current = ''
      setStreamingResponse('')
      let responseBuffer = ''
      let unsubscribeChunk: (() => void) | undefined
      let unsubscribeComplete: (() => void) | undefined
      let unsubscribeError: (() => void) | undefined

      const completion = new Promise<string>((resolve, reject) => {
        unsubscribeChunk = window.api.aiOnStreamChunk(sessionId, (chunk: string) => {
          if (
            currentSessionIdRef.current !== sessionId ||
            currentEditRunIdRef.current !== editRunId
          ) {
            return
          }
          responseBuffer += chunk
          currentResponseRef.current = responseBuffer
          const parsedResponse = parseAgentResponse(responseBuffer)
          setWorkspaceSession((current) =>
            current?.status === 'generating'
              ? {
                  ...current,
                  responseContent: responseBuffer,
                  summaryLines: parsedResponse.summaryLines,
                  notes: parsedResponse.body,
                  toolCall: parsedResponse.toolCall,
                  changePreviews: parsedResponse.changePreviews
                }
              : current
          )

          if (parsedResponse.toolCall) {
            updateToolEvent({
              id: eventId,
              label: `正在调用 ${getToolCallLabel(parsedResponse.toolCall.name)}`,
              detail: getToolCallSummary(parsedResponse.toolCall) || undefined,
              status: 'running'
            })
          }
        })

        unsubscribeComplete = window.api.aiOnStreamComplete(sessionId, () => {
          if (
            currentSessionIdRef.current !== sessionId ||
            currentEditRunIdRef.current !== editRunId
          ) {
            reject(new Error(staleStreamMessage))
            return
          }
          resolve(responseBuffer.trim())
        })

        unsubscribeError = window.api.aiOnStreamError(sessionId, (error: string) => {
          if (
            currentSessionIdRef.current !== sessionId ||
            currentEditRunIdRef.current !== editRunId
          ) {
            reject(new Error(staleStreamMessage))
            return
          }
          reject(new Error(error))
        })
      })

      try {
        const result = await window.api.aiStreamCompletion(
          selectedModel,
          agentMessages,
          { toolMode: 'code-edit' },
          sessionId
        )
        if (!result.success) {
          throw new Error(result.error || 'AI stream failed')
        }
        return await completion
      } finally {
        unsubscribeChunk?.()
        unsubscribeComplete?.()
        unsubscribeError?.()
        if (currentSessionIdRef.current === sessionId) {
          currentResponseRef.current = ''
          currentSessionIdRef.current = null
          setStreamingResponse('')
        }
      }
    }

    try {
      const agentMessages = [...requestMessages]
      let lastError = '模型没有返回可执行结果。'
      let workingDraft = currentCodeDocument
      let lastResponse = ''
      let lastParsed: AgentResponseParts | null = null

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const eventId = `modify-current-file-${attempt}`
        updateToolEvent({
          id: eventId,
          label: attempt === 1 ? '正在分析请求' : `正在重新分析请求 ${attempt}`,
          status: 'running'
        })

        const finalResponse = await streamAgentTurn(agentMessages, eventId)
        const parsed = parseAgentResponse(finalResponse)
        const toolSummary = getToolCallSummary(parsed.toolCall)
        lastResponse = finalResponse
        lastParsed = parsed

        if (!parsed.toolCall) {
          if (workingDraft !== currentCodeDocument) {
            const diffLines = buildLineDiff(currentCodeDocument, workingDraft)
            setWorkspaceSession((prev) =>
              prev
                ? {
                    ...prev,
                    status: 'ready',
                    sourceDocument: currentCodeDocument,
                    draftDocument: workingDraft,
                    responseContent: finalResponse,
                    summaryLines: parsed.summaryLines,
                    notes: '',
                    toolCall: parsed.toolCall,
                    actionable: true,
                    changePreviews: parsed.changePreviews,
                    diffLines,
                    previewIssue: undefined,
                    error: undefined,
                    validation: { status: 'idle' }
                  }
                : prev
            )
            return
          }

          setWorkspaceSession(null)
          if (finalResponse) {
            setMessages((prev) => [
              ...prev,
              {
                id: createMessageId('assistant'),
                role: 'assistant',
                content: finalResponse,
                mode: 'edit',
                sourceDocument: currentCodeDocument || undefined
              }
            ])
          }
          return
        }

        if (isNonActionableToolCall(parsed.toolCall)) {
          lastError = toolSummary || '需要补充信息后才能继续。'
          setWorkspaceSession(null)
          setMessages((prev) => [
            ...prev,
            {
              id: createMessageId('assistant'),
              role: 'assistant',
              content: lastError,
              mode: 'edit',
              sourceDocument: currentCodeDocument || undefined
            }
          ])
          return
        }

        if (!SUPPORTED_AGENT_WRITE_TOOLS.has(parsed.toolCall.name)) {
          lastError =
            `未知工具：${getToolCallLabel(parsed.toolCall.name)}。` +
            '当前 Edit 模式仅支持单内容写入结果：modify_current_file、patch、diff 或完整内容替换。'
          updateToolEvent({
            id: eventId,
            label: '修改工具执行失败',
            detail: lastError,
            status: 'failed'
          })
          agentMessages.push(
            { role: 'assistant', content: finalResponse },
            {
              role: 'system',
              content:
                `tool_result:\n` +
                JSON.stringify(
                  {
                    tool: parsed.toolCall.name,
                    success: false,
                    error: lastError
                  },
                  null,
                  2
                ) +
                `\n请继续判断。如果可以普通回答结束，就不要再调用工具；如果仍需修改，请返回单文件写入结果：modify_current_file、patch、diff 或完整文件替换。`
            }
          )
          continue
        }

        const { draftDocument, previewIssue } = resolveDraftDocument(workingDraft, parsed)
        if (parsed.actionable && draftDocument) {
          workingDraft = draftDocument
          const diffLines = buildLineDiff(currentCodeDocument, workingDraft)
          updateToolEvent({
            id: eventId,
            label: '已生成修改草稿',
            detail: toolSummary || '修改草稿生成成功',
            status: 'done'
          })
          setWorkspaceSession((prev) =>
            prev
              ? {
                  ...prev,
                  status: 'ready',
                  sourceDocument: currentCodeDocument,
                  draftDocument: workingDraft,
                  responseContent: finalResponse,
                  summaryLines: parsed.summaryLines,
                  notes: '',
                  toolCall: parsed.toolCall,
                  actionable: true,
                  changePreviews: parsed.changePreviews,
                  diffLines,
                  previewIssue,
                  error: undefined,
                  validation: { status: 'idle' }
                }
              : prev
          )
          return
        }

        lastError = previewIssue || '修改工具没有生成可应用的结果。'
        updateToolEvent({
          id: eventId,
          label: '修改工具执行失败',
          detail: lastError,
          status: 'failed'
        })
        agentMessages.push(
          { role: 'assistant', content: finalResponse },
          {
            role: 'system',
            content:
              `工具结果：失败。\n` +
              `工具：${getToolCallLabel(parsed.toolCall.name)}\n` +
              `原因：${lastError}\n` +
              `当前草稿内容如下：\n\n${workingDraft}\n\n请判断是否还要继续。如果可以普通回答结束，就不要再调用工具；如果仍需修改，请返回单文件写入结果，且必须基于当前草稿内容。`
          }
        )
      }

      if (workingDraft !== currentCodeDocument) {
        const diffLines = buildLineDiff(currentCodeDocument, workingDraft)
        setWorkspaceSession((prev) =>
          prev
            ? {
                ...prev,
                status: 'ready',
                sourceDocument: currentCodeDocument,
                draftDocument: workingDraft,
                responseContent: lastResponse,
                summaryLines: lastParsed?.summaryLines ?? [],
                notes: '',
                toolCall: lastParsed?.toolCall ?? null,
                actionable: true,
                changePreviews: lastParsed?.changePreviews ?? [],
                diffLines,
                previewIssue: undefined,
                error: undefined,
                validation: { status: 'idle' }
              }
            : prev
        )
        return
      }

      setWorkspaceSession((prev) =>
        prev
          ? {
              ...prev,
              status: 'failed',
              actionable: false,
              previewIssue: lastError,
              error: lastError,
              validation: { status: 'idle' }
            }
          : prev
      )
    } catch (error) {
      if (currentEditRunIdRef.current !== editRunId) return
      console.error('Failed to run agent:', error)
      const errorMessage = error instanceof Error ? error.message : '请求失败，请稍后重试。'
      setWorkspaceSession((prev) =>
        prev
          ? {
              ...prev,
              status: 'failed',
              actionable: false,
              error: errorMessage,
              validation: { status: 'idle' }
            }
          : {
              prompt,
              status: 'failed',
              sourceDocument: currentCodeDocument,
              draftDocument: '',
              responseContent: '',
              summaryLines: [],
              notes: '',
              toolCall: null,
              toolEvents: [],
              actionable: false,
              changePreviews: [],
              diffLines: [],
              error: errorMessage,
              validation: { status: 'idle' }
            }
      )
    } finally {
      if (currentEditRunIdRef.current === editRunId) {
        setStreamingResponse('')
        currentResponseRef.current = ''
        currentSessionIdRef.current = null
        currentEditRunIdRef.current = null
        setIsLoading(false)
      }
    }
  }

  const handleSend = async (
    promptOverride?: string,
    options?: { baseMessages?: SidebarMessage[] }
  ): Promise<void> => {
    const prompt = (promptOverride ?? input).trim()
    if (!prompt || !selectedModel || isLoading) return

    if (editorMode === 'code' && interactionMode === 'edit') {
      await handleAgentRun(prompt)
      return
    }

    await handleConversationSend(prompt, options)
  }

  const handleStopGeneration = async (): Promise<void> => {
    const sessionId = currentSessionIdRef.current
    if (!sessionId || !isLoading) return
    const partialResponse = currentResponseRef.current.trim()
    const interruptedWorkspace = workspaceSession?.status === 'generating' ? workspaceSession : null

    try {
      await window.api.aiCancelStream(sessionId)
    } catch (error) {
      console.error('Failed to cancel AI stream:', error)
    } finally {
      currentSessionIdRef.current = null
      setIsLoading(false)
      setStreamingResponse('')
      currentResponseRef.current = ''
      currentEditRunIdRef.current = null

      if (interruptedWorkspace) {
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId('assistant-interrupted'),
            role: 'assistant',
            content: partialResponse
              ? `已停止 Edit 生成，本次没有应用任何修改。\n\n已生成的部分内容：\n\n${partialResponse}`
              : '已停止 Edit 生成，本次没有应用任何修改。',
            mode: 'edit',
            sourceDocument: interruptedWorkspace.sourceDocument || undefined
          }
        ])
        setWorkspaceSession(null)
        return
      }

      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId('assistant-interrupted'),
          role: 'assistant',
          content: partialResponse
            ? `已停止生成。\n\n已生成的部分内容：\n\n${partialResponse}`
            : '已停止生成。'
        }
      ])
    }
  }

  const handleClear = (): void => {
    setMessages([])
    setWorkspaceSession(null)
    setStreamingResponse('')
    currentResponseRef.current = ''
    setOpenDiffMessageKey(null)
  }

  const handleClearContext = (): void => {
    setContextText('')
    clearAIContextText()
  }

  const handleInsert = (content: string): void => {
    if (!editor || !content.trim()) return
    editor.chain().focus().insertContent(content).run()
  }

  const handleInsertBelow = (content: string): void => {
    if (!content.trim()) return

    if (editorMode === 'code') {
      const codeView = getCodeEditorView()
      if (!codeView) return

      const selection = codeView.state.selection.main
      const insertPos = selection.to
      const docText = codeView.state.doc.toString()
      const beforeText = docText.slice(0, insertPos)
      const afterText = docText.slice(insertPos)
      const needsLeadingNewLine = beforeText.length > 0 && !beforeText.endsWith('\n')
      const needsTrailingNewLine = afterText.length > 0 && !afterText.startsWith('\n')
      const insertion = `${needsLeadingNewLine ? '\n' : ''}${content}${needsTrailingNewLine ? '\n' : ''}`

      codeView.dispatch({
        changes: { from: insertPos, to: insertPos, insert: insertion },
        selection: { anchor: insertPos + insertion.length }
      })
      codeView.focus()
      return
    }

    if (!editor) return
    const insertPos = editor.state.selection.to
    const insertion = insertPos > 0 ? `\n\n${content}` : content
    editor.chain().focus().insertContentAt(insertPos, insertion).run()
  }

  const handleReplaceSelection = (content: string): void => {
    if (!content.trim()) return

    if (editorMode === 'code') {
      const codeView = getCodeEditorView()
      if (!codeView) return

      const selection = codeView.state.selection.main
      const from = selection.from
      const to = selection.to
      if (from === to) return

      codeView.dispatch({
        changes: { from, to, insert: content },
        selection: { anchor: from + content.length }
      })
      codeView.focus()
      return
    }

    if (!editor) return
    editor.chain().focus().insertContent(content).run()
  }

  const handleAcceptWorkspaceDraft = (): void => {
    if (!workspaceSession) return

    if (editorMode === 'code' && workspaceSession.draftDocument) {
      replaceCodeDocument(workspaceSession.draftDocument)
    }

    const diffStats = countDiffStats(workspaceSession.diffLines)
    const summaryLines = workspaceSession.summaryLines
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3)
    const toolSummary = getToolCallSummary(workspaceSession.toolCall)
    const messageId = createMessageId('assistant')
    const content =
      summaryLines.length > 0
        ? ['正在整理本次修改总结…', ...summaryLines.map((line) => `- ${line}`)].join('\n')
        : '正在整理本次修改总结…'

    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        role: 'assistant',
        content,
        mode: 'edit',
        sourceDocument: workspaceSession.sourceDocument || undefined,
        agentResult: {
          kind: 'applied',
          added: diffStats.added,
          removed: diffStats.removed,
          diffLines: workspaceSession.diffLines,
          summaryLines,
          toolSummary: toolSummary || undefined,
          prompt: workspaceSession.prompt,
          summaryStatus: 'loading'
        }
      }
    ])
    setOpenDiffMessageKey(messageId)
    setWorkspaceSession(null)
    void summarizeAppliedChanges(messageId, {
      userPrompt: workspaceSession.prompt,
      toolSummary: toolSummary || undefined,
      diffLines: workspaceSession.diffLines,
      added: diffStats.added,
      removed: diffStats.removed
    })
  }

  const handleDiscardWorkspaceDraft = (): void => {
    if (workspaceSession) {
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId('assistant-edit-closed'),
          role: 'assistant',
          content:
            workspaceSession.status === 'failed'
              ? `已关闭失败的 Edit 任务：${workspaceSession.error || '修改失败。'}`
              : '已关闭本次 Edit 任务，未应用任何修改。',
          mode: 'edit',
          sourceDocument: workspaceSession.sourceDocument || undefined
        }
      ])
    }
    setWorkspaceSession(null)
  }

  const handleRetryWorkspace = (): void => {
    if (!workspaceSession?.prompt || isLoading) return
    void handleAgentRun(workspaceSession.prompt)
  }

  const handleDiscardApplied = (): void => {
    if (workspaceSession) {
      const diffStats = countDiffStats(workspaceSession.diffLines)
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId('assistant-edit-discarded'),
          role: 'assistant',
          content: `已放弃本次 Edit 修改，未应用到当前代码。\n\n变更预览：+${diffStats.added} / -${diffStats.removed}`,
          mode: 'edit',
          sourceDocument: workspaceSession.sourceDocument || undefined
        }
      ])
    }
    setWorkspaceSession(null)
  }

  const handleRetry = (assistantMessageIndex: number): void => {
    const retryUserIndex = [...messages.keys()]
      .slice(0, assistantMessageIndex)
      .reverse()
      .find((index) => messages[index]?.role === 'user')

    if (retryUserIndex === undefined) return

    const retryPrompt = messages[retryUserIndex]?.content?.trim()
    if (!retryPrompt) return

    const baseMessages = messages.slice(0, retryUserIndex)
    void handleSend(retryPrompt, { baseMessages })
  }

  const quickActions = [
    {
      id: 'explain',
      label: editorMode === 'code' ? (interactionMode === 'edit' ? 'Audit' : 'Explain') : '总结',
      icon: MessageSquareQuote,
      prompt:
        editorMode === 'code'
          ? interactionMode === 'edit'
            ? '请审阅当前代码内容，先判断最值得处理的结构、缺陷和风险，再直接给出可应用的单内容修改结果。'
            : '请解释当前代码内容的作用、关键逻辑、潜在风险，并给出简短改进建议。'
          : '请总结这段内容的核心意思、结构和语气特点，并给出简短优化建议。'
    },
    {
      id: 'fix',
      label: editorMode === 'code' ? 'Fix' : 'Rewrite',
      icon: Bug,
      prompt:
        editorMode === 'code'
          ? '请直接修复当前代码内容里最明显的问题，返回可应用的单内容修改结果，并说明验证方式。'
          : '请保留原意重写这段内容，让表达更顺、更清晰。'
    },
    {
      id: 'optimize',
      label:
        editorMode === 'code' ? (interactionMode === 'edit' ? 'Edit' : 'Optimize') : '润色',
      icon: Sparkles,
      prompt:
        editorMode === 'code'
          ? interactionMode === 'edit'
            ? '请围绕当前代码内容的可维护性和清晰度做一次完整改造，返回结构化改动提示、最终 unified diff，并说明验证方式。'
            : '请优化这段代码的可读性、结构和性能，并给出改进后的版本。'
          : '请在不改变原意的前提下润色这段内容，让表达更凝练。'
    },
    {
      id: 'refactor',
      label: editorMode === 'code' ? 'Refactor' : '扩写',
      icon: FilePenLine,
      prompt:
        editorMode === 'code'
          ? '请重构当前代码内容，拆清职责并给出更易维护的版本。'
          : '请基于这段内容继续展开，补成更完整的一版。'
    }
  ] as const

  const filteredSlashCommands = quickActions.filter(
    (cmd) =>
      slashFilter === '' ||
      cmd.label.toLowerCase().includes(slashFilter) ||
      cmd.id.toLowerCase().includes(slashFilter)
  )

  const handleSlashSelect = (cmd: SelectedCommand): void => {
    const textarea = textareaRef.current
    const cursorPos = textarea?.selectionStart ?? input.length
    const textBeforeCursor = input.slice(0, cursorPos)
    const slashMatch = textBeforeCursor.match(/(^|\s)(\/\S*)$/)

    if (slashMatch) {
      const slashStart = cursorPos - slashMatch[2].length
      const newValue = input.slice(0, slashStart) + input.slice(cursorPos)
      setInput(newValue)
    }

    setPendingCommand(cmd)
    setSlashOpen(false)
    setSlashFilter('')
    setSlashIndex(0)

    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const handleSubmit = (): void => {
    if (pendingCommand) {
      const extra = input.trim()
      const combined = extra ? `${pendingCommand.prompt}\n\n${extra}` : pendingCommand.prompt
      setPendingCommand(null)
      void handleSend(combined)
    } else {
      void handleSend()
    }
  }

  const handleInputChange = (value: string, cursorPos: number): void => {
    setInput(value)
    const textBeforeCursor = value.slice(0, cursorPos)
    const slashMatch = textBeforeCursor.match(/(^|\s)(\/\S*)$/)
    if (slashMatch) {
      setSlashOpen(true)
      setSlashFilter(slashMatch[2].slice(1).toLowerCase())
      setSlashIndex(0)
    } else if (slashOpen) {
      setSlashOpen(false)
    }
  }

  const handleCopyMessage = async (content: string, key: string): Promise<void> => {
    const ok = await copyToClipboard(content)
    if (!ok) return
    setCopiedMessageKey(key)
    if (copiedMessageTimerRef.current) {
      window.clearTimeout(copiedMessageTimerRef.current)
    }
    copiedMessageTimerRef.current = window.setTimeout(() => {
      setCopiedMessageKey(null)
    }, 1500)
  }

  const updateSidebarMessage = (
    messageId: string,
    updater: (message: SidebarMessage) => SidebarMessage
  ): void => {
    setMessages((prev) => prev.map((message) => (message.id === messageId ? updater(message) : message)))
  }

  const summarizeAppliedChanges = async (
    messageId: string,
    params: {
      userPrompt: string
      toolSummary?: string
      diffLines: DiffLine[]
      added: number
      removed: number
    }
  ): Promise<void> => {
    if (!selectedModel) {
      updateSidebarMessage(messageId, (message) => ({
        ...message,
        agentResult: message.agentResult
          ? {
              ...message.agentResult,
              summaryStatus: 'failed'
            }
          : message.agentResult
      }))
      return
    }

    const summaryPrompt = buildAppliedSummaryPrompt(params)
    const result = await window.api.aiGenerateCompletion(
      selectedModel,
      [{ role: 'user', content: summaryPrompt }],
      {}
    )

    if (!result.success || !result.data?.content?.trim()) {
      updateSidebarMessage(messageId, (message) => ({
        ...message,
        agentResult: message.agentResult
          ? {
              ...message.agentResult,
              summaryStatus: 'failed'
            }
          : message.agentResult
      }))
      return
    }

    const summaryText = normalizeSummaryMarkdown(result.data.content.trim())
    updateSidebarMessage(messageId, (message) => ({
      ...message,
      content: summaryText,
      agentResult: message.agentResult
        ? {
            ...message.agentResult,
            summaryStatus: 'ready',
            summaryText
          }
        : message.agentResult
    }))
  }

  const selectedModelName = models.find((model) => model.id === selectedModel)?.name
  const hasContext = contextText.trim().length > 0
  const canApplyToWordEditor = editorMode === 'word' && Boolean(editor)
  const canApplyToCodeEditor = editorMode === 'code' && Boolean(getCodeEditorView())
  const canApplyResponse = canApplyToWordEditor || canApplyToCodeEditor
  const modeOptions: Array<{ id: AISidebarMode; label: string }> = [
    { id: 'ask', label: 'Ask' },
    { id: 'edit', label: 'Edit' }
  ]
  const regularMessages = messages
  const workspaceFileName = selectedNote?.title || '当前内容'
  const workspaceHasDiff =
    workspaceSession?.diffLines.some((line) => line.type !== 'context') ?? false
  const workspaceDiffStats = workspaceSession
    ? countDiffStats(workspaceSession.diffLines)
    : { added: 0, removed: 0 }

  return (
    <div
      className={cn(
        'flex h-full flex-col bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--primary)_6%,transparent),transparent_34%),linear-gradient(to_bottom,var(--background),color-mix(in_oklab,var(--muted)_26%,var(--background)))]',
        className
      )}
    >
      <div className="border-b border-border/70 bg-background/78 px-3 py-3 backdrop-blur-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-2xl border border-primary/15 bg-primary/8 p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
              <Sparkles className="size-4 text-primary" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold tracking-[0.01em]">AI 助手</h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-border/70 bg-background/82 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground/80">
                  {selectedModelName || '未选择模型'}
                </span>
                {editorMode === 'code' ? (
                  <span className="rounded-full border border-primary/20 bg-primary/8 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-primary">
                    {getModeLabel(interactionMode)}
                  </span>
                ) : null}
                <span className="text-[11px] text-muted-foreground">
                  {editorMode === 'code'
                    ? '生成可审阅修改，可 Accept 或 Retry'
                    : hasContext
                      ? '已附带选中文本引用'
                      : '可直接分析当前选中内容'}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (isLoading) {
                void handleStopGeneration()
                return
              }
              handleClear()
            }}
            className="h-8 shrink-0 rounded-full border border-border/70 bg-background/65 px-3 backdrop-blur"
          >
            {isLoading ? <X className="size-4" /> : <Trash2 className="size-4" />}
            {isLoading ? '停止' : '清空'}
          </Button>
        </div>

        {models.length === 0 ? (
          <p className="text-xs text-destructive">没有可用模型，请先在设置中启用模型。</p>
        ) : null}

        {hasContext ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-border/75 bg-background/70 shadow-[0_18px_48px_rgba(0,0,0,0.04)]">
            <div className="h-px w-full bg-gradient-to-r from-primary/35 via-primary/10 to-transparent" />
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <PencilRuler className="size-3.5" />
                  当前引用
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs"
                  onClick={handleClearContext}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              <p className="line-clamp-5 whitespace-pre-wrap text-xs leading-5 text-foreground/90">
                {contextText}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {regularMessages.length === 0 && !workspaceSession && !streamingResponse ? (
            <div className="rounded-[22px] border border-border/70 bg-background/82 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.05)] backdrop-blur">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Bot className="size-4 text-primary" />
                {editorMode === 'code' && interactionMode === 'edit'
                  ? '开始 Edit 代码修改'
                  : '开始一个侧边对话'}
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {editorMode === 'code'
                    ? interactionMode === 'edit'
                      ? 'Edit 会围绕当前代码生成结构化修改和最终 diff，待你审批后再应用。'
                      : 'Ask 会围绕当前代码内容直接解释、分析、修改或优化。'
                    : '可以像 VS Code 侧栏 AI 一样直接围绕当前文档工作。'}
                </p>
                <div className="grid gap-2">
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/22 px-3 py-2.5">
                    {editorMode === 'code'
                      ? 'Ask: 解释当前代码内容、定位问题或直接给出修改建议'
                      : '解释当前选中的一段文字'}
                  </div>
                  <div className="rounded-xl border border-dashed border-primary/25 bg-primary/6 px-3 py-2.5">
                    {editorMode === 'code'
                      ? 'Edit: 生成可审阅 diff，确认后应用到当前代码'
                      : '按当前语气续写或重写内容'}
                  </div>
                  {editorMode !== 'code' ? (
                    <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2">
                      让 AI 基于引用给出结构化建议
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {regularMessages.map((message) => {
            const isUser = message.role === 'user'
            const messageKey = message.id
            const messageIndex = messages.findIndex((item) => item.id === messageKey)
            const bodyContent = isUser ? '' : extractBodyContent(message.content)
            const canRetry =
              !isUser &&
              messageIndex >= 0 &&
              messages.slice(0, messageIndex).some((item) => item.role === 'user')
            const isAppliedAgentResult =
              !isUser &&
              editorMode === 'code' &&
              message.mode === 'edit' &&
              message.agentResult?.kind === 'applied'
            const isDiffOpen = openDiffMessageKey === messageKey
            const copyActions: MessageAction[] = isUser
              ? []
              : [
                  {
                    id: 'copy',
                    label: copiedMessageKey === messageKey ? '已复制' : '复制',
                    icon: copiedMessageKey === messageKey ? Check : Clipboard,
                    onClick: () => {
                      void handleCopyMessage(message.content, messageKey)
                    },
                    active: copiedMessageKey === messageKey
                  }
                ]
            const applyActions: MessageAction[] = isUser
              ? []
              : editorMode === 'code'
                ? []
                : [
                    {
                      id: 'insert-full',
                      label: '插入全文',
                      icon: FilePenLine,
                      onClick: () => handleInsert(message.content),
                      disabled: !canApplyToWordEditor
                    },
                    ...(bodyContent
                      ? [
                          {
                            id: 'apply-body',
                            label: '应用正文',
                            icon: MessageSquareQuote,
                            onClick: () => handleInsertBelow(bodyContent),
                            disabled: !canApplyResponse
                          }
                        ]
                      : []),
                    {
                      id: 'rewrite-selection',
                      label: '改写选区',
                      icon: Replace,
                      onClick: () => handleReplaceSelection(message.content),
                      disabled: !canApplyResponse || !hasContext
                    },
                    {
                      id: 'append-below',
                      label: '插入下方',
                      icon: MoveDown,
                      onClick: () => handleInsertBelow(message.content),
                      disabled: !canApplyResponse
                    }
                  ]
            const sessionActions: MessageAction[] = isUser
              ? []
              : [
                  {
                    id: 'retry',
                    label: 'Retry',
                    icon: RotateCcw,
                    onClick: () => handleRetry(messageIndex),
                    disabled: !canRetry || isLoading
                  }
                ]
            const messageActionGroups: MessageActionGroup[] = [
              { id: 'copy', actions: copyActions },
              { id: 'apply', actions: applyActions },
              { id: 'session', actions: sessionActions }
            ].filter((group) => group.actions.length > 0)

            return (
              <div
                key={messageKey}
                className={cn('flex items-start gap-2', isUser ? 'justify-end' : 'justify-start')}
              >
                {!isUser ? (
                  <div className="mt-1 self-start rounded-2xl border border-primary/15 bg-primary/10 p-1.5 text-primary">
                    <Bot className="size-3.5" />
                  </div>
                ) : null}

                <div
                  className={cn(
                    'max-w-[88%] rounded-[20px] border px-3 py-2.5 text-sm shadow-[0_14px_38px_rgba(0,0,0,0.04)]',
                    isUser
                      ? 'border-primary/45 bg-primary text-primary-foreground'
                      : 'border-border/75 bg-background/88 backdrop-blur'
                  )}
                >
                  {isUser ? (
                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                  ) : (
                    <>
                      {isAppliedAgentResult ? (
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                                Applied
                              </div>
                              <div className="text-sm font-medium text-foreground">
                                已应用到当前内容
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5 text-[11px] font-medium tabular-nums">
                                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                                  +{message.agentResult?.added ?? 0}
                                </span>
                                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-600 dark:text-rose-400">
                                  -{message.agentResult?.removed ?? 0}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {copyActions.map((action) => {
                                  const Icon = action.icon
                                  return (
                                    <Tooltip key={action.id}>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon-sm"
                                          className={cn(
                                            'size-7 rounded-full',
                                            action.active && 'bg-accent text-foreground'
                                          )}
                                          onClick={action.onClick}
                                          disabled={action.disabled}
                                        >
                                          <Icon className="size-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        <p>{action.label}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )
                                })}
                                {sessionActions.map((action) => {
                                  const Icon = action.icon
                                  return (
                                    <Tooltip key={action.id}>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon-sm"
                                          className="size-7 rounded-full"
                                          onClick={action.onClick}
                                          disabled={action.disabled}
                                        >
                                          <Icon className="size-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        <p>{action.label}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )
                                })}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border/70 bg-muted/18 px-3 py-2.5">
                            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Summary
                            </div>
                            {message.agentResult?.summaryStatus === 'loading' ? (
                              <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                                <Loader2 className="size-3.5 animate-spin" />
                                正在生成本次修改总结...
                              </div>
                            ) : null}
                            {message.agentResult?.summaryStatus !== 'loading' &&
                            message.agentResult?.summaryText ? (
                              <StreamMarkdown
                                content={message.agentResult.summaryText}
                                className="text-[13px] leading-5"
                                compactCodeBlocks
                              />
                            ) : null}
                            {message.agentResult?.summaryStatus === 'failed' &&
                            !message.agentResult?.summaryText ? (
                              <div className="space-y-1.5 text-[13px] leading-5 text-foreground/88">
                                {message.agentResult?.summaryLines?.length ? (
                                  message.agentResult.summaryLines.map((line, index) => (
                                    <div
                                      key={`${messageKey}-summary-${index}`}
                                      className="flex gap-2"
                                    >
                                      <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-primary/55" />
                                      <span>{line}</span>
                                    </div>
                                  ))
                                ) : message.agentResult?.toolSummary ? (
                                  <div>{message.agentResult.toolSummary}</div>
                                ) : (
                                  <div>本次修改已应用。</div>
                                )}
                              </div>
                            ) : null}
                          </div>

                          <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/75">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                              onClick={() =>
                                setOpenDiffMessageKey((current) =>
                                  current === messageKey ? null : messageKey
                                )
                              }
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-foreground">代码 Diff</div>
                                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                  {buildDiffPreview(message.agentResult?.diffLines ?? [])}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <div className="flex items-center gap-1.5 text-[11px] font-medium tabular-nums">
                                  <span className="text-emerald-600 dark:text-emerald-400">
                                    +{message.agentResult?.added ?? 0}
                                  </span>
                                  <span className="text-rose-500 dark:text-rose-400">
                                    -{message.agentResult?.removed ?? 0}
                                  </span>
                                </div>
                                <ChevronDown
                                  className={cn(
                                    'size-4 text-muted-foreground transition-transform',
                                    isDiffOpen && 'rotate-180'
                                  )}
                                />
                              </div>
                            </button>

                            {isDiffOpen ? (
                              <ScrollArea
                                className="max-h-[280px] border-t border-border/60"
                                orientation="both"
                              >
                                <div className="font-mono text-[11px] leading-5">
                                  {message.agentResult?.diffLines.map((line, index) => (
                                    <div
                                      key={`${messageKey}-diff-${index}`}
                                      className={cn(
                                        'flex min-w-max gap-2 px-3 py-px',
                                        line.type === 'added' &&
                                          'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
                                        line.type === 'removed' &&
                                          'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                                      )}
                                    >
                                      <span className="w-3 shrink-0 select-none text-center opacity-50">
                                        {line.type === 'added'
                                          ? '+'
                                          : line.type === 'removed'
                                            ? '-'
                                            : ' '}
                                      </span>
                                      <span className="whitespace-pre">{line.content || ' '}</span>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <StreamMarkdown content={message.content} />
                      )}
                      {!isAppliedAgentResult ? (
                        <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-2">
                          {messageActionGroups.map((group, groupIndex) => (
                            <div key={group.id} className="flex items-center gap-1.5">
                              {group.actions.map((action) => {
                                const Icon = action.icon
                                return (
                                  <Tooltip key={action.id}>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className={cn(
                                          'size-8 rounded-lg',
                                          action.active && 'bg-accent text-foreground'
                                        )}
                                        onClick={action.onClick}
                                        disabled={action.disabled}
                                      >
                                        <Icon className="size-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p>{action.label}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )
                              })}
                              {groupIndex < messageActionGroups.length - 1 ? (
                                <div className="mx-0.5 h-4 w-px bg-border/80" />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                {isUser ? (
                  <div className="mt-1 self-start rounded-2xl border border-border/70 bg-muted/55 p-1.5 text-muted-foreground">
                    <UserRound className="size-3.5" />
                  </div>
                ) : null}
              </div>
            )
          })}

          {workspaceSession ? (
            <div className="flex items-start gap-2">
              <div className="mt-1 shrink-0 rounded-full bg-primary/10 p-1.5 text-primary">
                <Bot className="size-3.5" />
              </div>

              <div className="min-w-0 flex-1">
                {workspaceSession.status === 'generating' ? (
                  <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                    <span className="truncate">
                      {workspaceSession.toolCall
                        ? getToolCallSummary(workspaceSession.toolCall) || '正在生成修改草稿...'
                        : '正在分析请求...'}
                    </span>
                  </div>
                ) : null}

                {workspaceSession.status === 'ready' && workspaceSession.actionable ? (
                  <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/90 shadow-sm">
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <FilePenLine className="size-3.5 shrink-0 text-primary" />
                        <span className="truncate text-sm font-medium">{workspaceFileName}</span>
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          待确认
                        </span>
                      </div>
                      {workspaceHasDiff ? (
                        <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium tabular-nums">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +{workspaceDiffStats.added}
                          </span>
                          <span className="text-rose-500 dark:text-rose-400">
                            -{workspaceDiffStats.removed}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {workspaceHasDiff ? (
                      <ScrollArea className="max-h-[300px] border-t border-border/60" orientation="both">
                        <div className="font-mono text-[11px] leading-5">
                          {workspaceSession.diffLines.map((line, i) => (
                            <div
                              key={`dl-${i}`}
                              className={cn(
                                'flex min-w-max gap-2 px-3 py-px',
                                line.type === 'added' && 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
                                line.type === 'removed' && 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                              )}
                            >
                              <span className="w-3 shrink-0 select-none text-center opacity-50">
                                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                              </span>
                              <span className="whitespace-pre">{line.content || ' '}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : null}

                    <div className="flex items-center gap-1.5 border-t border-border/60 px-2.5 py-2">
                      <Button
                        size="sm"
                        className="h-7 rounded-full px-3 text-xs"
                        onClick={handleAcceptWorkspaceDraft}
                      >
                        <Check className="mr-1 size-3" />
                        Accept
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-full px-3 text-xs"
                        onClick={handleRetryWorkspace}
                        disabled={isLoading}
                      >
                        <RotateCcw className="mr-1 size-3" />
                        Retry
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-full px-3 text-xs text-muted-foreground"
                        onClick={handleDiscardApplied}
                      >
                        <Trash2 className="mr-1 size-3" />
                        Close
                      </Button>
                    </div>
                  </div>
                ) : null}

                {workspaceSession.status === 'failed' ? (
                  <div className="overflow-hidden rounded-2xl border border-rose-500/20 bg-rose-500/5">
                    <div className="px-3 py-2.5 text-xs text-rose-600 dark:text-rose-400">
                      <pre className="whitespace-pre-wrap break-words">
                        {workspaceSession.error || '修改失败，请重试。'}
                      </pre>
                    </div>
                    <div className="flex gap-1.5 border-t border-rose-500/15 px-2.5 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-full px-3 text-xs"
                        onClick={handleRetryWorkspace}
                        disabled={isLoading}
                      >
                        <RotateCcw className="mr-1 size-3" />
                        Retry
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-full px-3 text-xs text-muted-foreground"
                        onClick={handleDiscardWorkspaceDraft}
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {(streamingResponse || isLoading) && !activeGeneratingRun ? (
            <div className="flex items-start justify-start gap-2">
              <div className="mt-1 self-start rounded-2xl border border-primary/15 bg-primary/10 p-1.5 text-primary">
                <Bot className="size-3.5" />
              </div>
              <div className="max-w-[88%] rounded-[20px] border border-border/75 bg-background/88 px-3 py-2.5 text-sm shadow-[0_14px_38px_rgba(0,0,0,0.04)]">
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  AI 正在思考...
                </div>
                {streamingResponse ? <StreamMarkdown content={streamingResponse} /> : null}
              </div>
            </div>
          ) : null}

          <div ref={messageEndRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border/70 bg-background/72 p-3 backdrop-blur-xl">
        {slashOpen && filteredSlashCommands.length > 0 && (
          <div className="mb-2 overflow-hidden rounded-2xl border border-border/70 bg-popover/96 shadow-[0_28px_80px_rgba(0,0,0,0.12)] backdrop-blur-xl">
            {filteredSlashCommands.map((cmd, index) => {
              const Icon = cmd.icon
              return (
                <button
                  key={cmd.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                    index === slashIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50 text-foreground'
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSlashSelect({ label: cmd.label, prompt: cmd.prompt, icon: cmd.icon })
                  }}
                  onMouseEnter={() => setSlashIndex(index)}
                >
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{cmd.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground truncate max-w-[120px]">
                    {cmd.prompt.slice(0, 28)}…
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="rounded-[24px] border border-border/75 bg-background/92 shadow-[0_22px_64px_rgba(0,0,0,0.08)] backdrop-blur">
          {pendingCommand && (
            <div className="flex items-center gap-2 px-3 pt-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                <pendingCommand.icon className="size-3" />
                {pendingCommand.label}
                <button
                  type="button"
                  onClick={() => setPendingCommand(null)}
                  className="ml-0.5 rounded-full hover:text-primary/70 transition-colors"
                >
                  <X className="size-2.5" />
                </button>
              </span>
              <span className="text-xs text-muted-foreground">可添加更多上下文</span>
            </div>
          )}
          <Textarea
            ref={textareaRef}
            placeholder={
              pendingCommand
                ? '补充更多上下文（可选）...'
                : hasContext
                  ? `基于当前${editorMode === 'code' ? '代码引用' : '引用'}提问... (/ 呼出命令)`
                  : '输入消息... (/ 呼出命令，Enter 发送)'
            }
            value={input}
            onChange={(e) =>
              handleInputChange(e.target.value, e.target.selectionStart ?? e.target.value.length)
            }
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={(e) => {
              setIsComposing(false)
              handleInputChange(
                e.currentTarget.value,
                e.currentTarget.selectionStart ?? e.currentTarget.value.length
              )
            }}
            onKeyDown={(e) => {
              if (slashOpen) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setSlashIndex((i) => Math.min(i + 1, filteredSlashCommands.length - 1))
                  return
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setSlashIndex((i) => Math.max(i - 1, 0))
                  return
                }
                if (e.key === 'Enter' && !isComposing) {
                  e.preventDefault()
                  const cmd = filteredSlashCommands[slashIndex]
                  if (cmd)
                    handleSlashSelect({ label: cmd.label, prompt: cmd.prompt, icon: cmd.icon })
                  return
                }
                if (e.key === 'Escape') {
                  setSlashOpen(false)
                  return
                }
              }
              if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            className="min-h-[76px] max-h-[150px] resize-none border-0 text-sm shadow-none focus-visible:ring-0 rounded-none rounded-t-xl px-3 pt-3 pb-2"
            disabled={isLoading || !selectedModel}
          />
          <div className="flex items-center justify-between gap-2 border-t border-border/70 px-2.5 py-2">
            <div className="flex items-center gap-1">
              {editorMode === 'code' ? (
                <div className="flex items-center gap-0.5 rounded-full border border-border/70 bg-muted/24 p-0.5">
                  {modeOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-medium transition-all',
                        interactionMode === option.id
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                      onClick={() => setInteractionMode(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors"
                  onClick={() => {
                    const textarea = textareaRef.current
                    if (!textarea) return
                    const pos = textarea.selectionStart ?? input.length
                    const newVal = input.slice(0, pos) + '/' + input.slice(pos)
                    handleInputChange(newVal, pos + 1)
                    requestAnimationFrame(() => {
                      if (!textareaRef.current) return
                      textareaRef.current.focus()
                      textareaRef.current.setSelectionRange(pos + 1, pos + 1)
                    })
                  }}
                >
                  <span className="font-mono font-semibold">/</span>
                  <span>命令</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {models.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 max-w-[158px] justify-between gap-1.5 rounded-full border border-border/70 bg-muted/24 px-3 text-xs hover:bg-muted/45"
                    >
                      <span className="truncate">{selectedModelName || '选择模型'}</span>
                      <ChevronDown className="size-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" side="top">
                    {models.map((model) => (
                      <DropdownMenuItem
                        key={model.id}
                        onClick={() => setSelectedModel(model.id)}
                        className={cn(model.id === selectedModel && 'bg-accent')}
                      >
                        {model.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <p className="text-xs text-destructive">没有可用模型</p>
              )}
              <Button
                onClick={handleSubmit}
                disabled={(!input.trim() && !pendingCommand) || !selectedModel || isLoading}
                size="icon"
                className="size-8 shrink-0 rounded-full shadow-sm"
              >
                {isLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
