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
  BadgeCheck,
  Bot,
  Bug,
  CodeXml,
  Check,
  ChevronDown,
  Clipboard,
  Copy,
  Eye,
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

interface AISidebarProps {
  className?: string
  editorMode?: 'word' | 'code'
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
  agentRuns: AgentRun[]
}

type AISidebarMode = 'ask' | 'edit' | 'agent'

interface SidebarMessage extends AIMessage {
  id: string
  mode?: AISidebarMode
  sourceDocument?: string
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

interface DiffLine {
  type: 'context' | 'removed' | 'added'
  content: string
}

interface SearchReplaceBlock {
  search: string
  replace: string
}

interface FencedCodeBlock {
  language: string
  content: string
}

interface AgentResponseParts {
  summaryLines: string[]
  code: string
  body: string
  patches: SearchReplaceBlock[]
  unifiedDiff: string
}

interface AgentRun {
  id: string
  prompt: string
  status: 'planning' | 'generating' | 'proposed' | 'checking' | 'passed' | 'failed'
  proposalMessageId?: string
  output?: string
}

type AgentRunStepState = 'done' | 'active' | 'pending' | 'error'

function getCodeLanguage(className?: string): string {
  const match = className?.match(/language-([\w-]+)/)
  return match?.[1] || 'text'
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function extractFencedCodeBlocks(content: string): FencedCodeBlock[] {
  const matches = content.matchAll(/```([\w-]*)\n?([\s\S]*?)```/g)
  return Array.from(matches, (match) => ({
    language: match[1]?.trim() ?? '',
    content: match[2].trim()
  })).filter((item) => item.content.length > 0)
}

function extractCodeBlocks(content: string): string[] {
  return extractFencedCodeBlocks(content).map((item) => item.content)
}

function extractBodyContent(content: string): string {
  return content
    .replace(/```[\w-]*\n?[\s\S]*?```/g, '')
    .replace(/<<<<<<< SEARCH\r?\n[\s\S]*?\r?\n=======\r?\n[\s\S]*?\r?\n>>>>>>> REPLACE/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractSearchReplaceBlocks(content: string): SearchReplaceBlock[] {
  const matches = content.matchAll(
    /<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> REPLACE/g
  )

  return Array.from(matches, (match) => ({
    search: match[1],
    replace: match[2]
  })).filter((item) => item.search.length > 0 || item.replace.length > 0)
}

function extractUnifiedDiff(content: string): string {
  const diffBlock = extractFencedCodeBlocks(content).find((block) => block.language === 'diff')
  if (diffBlock) return diffBlock.content

  const body = extractBodyContent(content)
  const hunkMatch = body.match(/@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@[\s\S]*/)
  return hunkMatch?.[0]?.trim() ?? ''
}

function parseAgentResponse(content: string): AgentResponseParts {
  const code = extractCodeBlocks(content)[0] ?? ''
  const body = extractBodyContent(content)
  const patches = extractSearchReplaceBlocks(content)
  const unifiedDiff = extractUnifiedDiff(content)
  const summaryLines = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*•]\s+/.test(line))
    .map((line) => line.replace(/^[-*•]\s+/, ''))
    .slice(0, 6)

  return {
    summaryLines,
    code,
    body,
    patches,
    unifiedDiff
  }
}

function applyUnifiedDiff(source: string, diffText: string): string {
  const lines = diffText.replace(/\r/g, '').split('\n')
  const hunks: Array<{ oldStart: number; lines: string[] }> = []
  let currentHunk: { oldStart: number; lines: string[] } | null = null

  lines.forEach((line) => {
    const headerMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (headerMatch) {
      if (currentHunk) hunks.push(currentHunk)
      currentHunk = {
        oldStart: Number(headerMatch[1]),
        lines: []
      }
      return
    }

    if (!currentHunk) return
    if (line.startsWith('\\ No newline at end of file')) return
    if (/^[ +-]/.test(line)) {
      currentHunk.lines.push(line)
    }
  })

  if (currentHunk) {
    hunks.push(currentHunk)
  }

  if (hunks.length === 0) {
    throw new Error('未找到可应用的 unified diff hunk。')
  }

  const sourceLines = source.replace(/\r/g, '').split('\n')
  const result: string[] = []
  let sourceIndex = 0

  hunks.forEach((hunk, hunkIndex) => {
    const hunkStart = Math.max(0, hunk.oldStart - 1)
    while (sourceIndex < hunkStart) {
      result.push(sourceLines[sourceIndex])
      sourceIndex += 1
    }

    hunk.lines.forEach((line) => {
      const prefix = line[0]
      const contentLine = line.slice(1)

      if (prefix === ' ') {
        if (sourceLines[sourceIndex] !== contentLine) {
          throw new Error(`第 ${hunkIndex + 1} 个 diff hunk 的上下文与当前文件不匹配。`)
        }
        result.push(contentLine)
        sourceIndex += 1
        return
      }

      if (prefix === '-') {
        if (sourceLines[sourceIndex] !== contentLine) {
          throw new Error(`第 ${hunkIndex + 1} 个 diff hunk 的删除行与当前文件不匹配。`)
        }
        sourceIndex += 1
        return
      }

      if (prefix === '+') {
        result.push(contentLine)
      }
    })
  })

  while (sourceIndex < sourceLines.length) {
    result.push(sourceLines[sourceIndex])
    sourceIndex += 1
  }

  return result.join('\n')
}

function countOccurrences(source: string, needle: string): number {
  if (!needle) return 0

  let count = 0
  let index = 0
  while (index <= source.length) {
    const nextIndex = source.indexOf(needle, index)
    if (nextIndex === -1) break
    count += 1
    index = nextIndex + needle.length
  }
  return count
}

function applySearchReplaceBlocks(source: string, patches: SearchReplaceBlock[]): string {
  let nextSource = source

  patches.forEach((patch, index) => {
    const occurrences = countOccurrences(nextSource, patch.search)
    if (occurrences === 0) {
      throw new Error(`第 ${index + 1} 个补丁的 SEARCH 块未在当前文件中找到。`)
    }
    if (occurrences > 1) {
      throw new Error(`第 ${index + 1} 个补丁的 SEARCH 块在当前文件中出现了多次，无法安全应用。`)
    }
    nextSource = nextSource.replace(patch.search, patch.replace)
  })

  return nextSource
}

function buildLineDiff(previousText: string, nextText: string): DiffLine[] {
  const previousLines = previousText.split('\n')
  const nextLines = nextText.split('\n')

  let prefix = 0
  while (
    prefix < previousLines.length &&
    prefix < nextLines.length &&
    previousLines[prefix] === nextLines[prefix]
  ) {
    prefix += 1
  }

  let suffix = 0
  while (
    suffix < previousLines.length - prefix &&
    suffix < nextLines.length - prefix &&
    previousLines[previousLines.length - 1 - suffix] === nextLines[nextLines.length - 1 - suffix]
  ) {
    suffix += 1
  }

  const diff: DiffLine[] = []

  previousLines.slice(0, prefix).forEach((line) => {
    diff.push({ type: 'context', content: line })
  })
  previousLines.slice(prefix, previousLines.length - suffix).forEach((line) => {
    diff.push({ type: 'removed', content: line })
  })
  nextLines.slice(prefix, nextLines.length - suffix).forEach((line) => {
    diff.push({ type: 'added', content: line })
  })
  nextLines.slice(nextLines.length - suffix).forEach((line) => {
    diff.push({ type: 'context', content: line })
  })

  return diff
}

function getAgentRunStepState(
  runStatus: AgentRun['status'],
  step: 'request' | 'proposal' | 'apply' | 'check',
  hasProposal: boolean
): AgentRunStepState {
  if (runStatus === 'failed') {
    if (hasProposal) {
      if (step === 'check') return 'error'
      return 'done'
    }
    if (step === 'request') return 'done'
    if (step === 'proposal') return 'error'
    return 'pending'
  }

  const order: Array<AgentRun['status']> = ['planning', 'generating', 'proposed', 'checking', 'passed']
  const currentIndex = order.indexOf(runStatus)
  const stepIndexMap: Record<'request' | 'proposal' | 'apply' | 'check', number> = {
    request: 1,
    proposal: 2,
    apply: 3,
    check: 4
  }
  const stepIndex = stepIndexMap[step]

  if (runStatus === 'planning' && step === 'request') return 'active'
  if (currentIndex > stepIndex) return 'done'
  if (currentIndex === stepIndex) return 'active'
  return 'pending'
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

function StreamMarkdown({ content }: { content: string }): React.JSX.Element {
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

        if (inline) {
          return (
            <code className="rounded bg-muted px-1.5 py-0.5 text-[0.85em]" {...rest}>
              {children}
            </code>
          )
        }

        const language = getCodeLanguage(className)
        const codeId = `${language}:${codeContent.slice(0, 32)}:${codeContent.length}`
        const isCopied = copiedCodeId === codeId

        return (
          <div className="my-3 overflow-hidden rounded-lg border bg-muted/25">
            <div className="flex items-center justify-between border-b bg-muted/60 px-3 py-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {language}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
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
            <ScrollArea className="max-h-[360px]" orientation="both">
              <div className="px-4 py-4 pr-6">
                <pre className="m-0 min-w-max text-[13px] leading-6">
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
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-7 prose-pre:bg-transparent prose-pre:p-0">
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  )
}

export function AISidebar({
  className,
  editorMode = 'word'
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
    getCodeEditorView
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
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([])
  const [copiedMessageKey, setCopiedMessageKey] = useState<string | null>(null)
  const [openDiffMessageKey, setOpenDiffMessageKey] = useState<string | null>(null)

  const messageEndRef = useRef<HTMLDivElement>(null)
  const currentResponseRef = useRef('')
  const copiedMessageTimerRef = useRef<number | null>(null)
  const sessionsRef = useRef<Record<string, AISessionState>>({})
  const currentNoteKey = selectedNote?.id ?? '__global__'
  const previousNoteKeyRef = useRef(currentNoteKey)

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

  useEffect(() => {
    const externalInput = getAIInputText()
    if (externalInput) {
      setInput(externalInput)
      clearAIInputText()
    }
  }, [aiPanelOpen, getAIInputText, clearAIInputText])

  useEffect(() => {
    if (!aiPanelOpen) return

    const externalContext = getAIContextText()
    if (externalContext) {
      setContextText(externalContext)
      return
    }

    const selectedText =
      editorMode === 'code' ? getSelectedCodeText() : getSelectedEditorText()
    if (selectedText) {
      setContextText(selectedText)
      setAIContextText(selectedText)
    }
  }, [
    aiPanelOpen,
    editorMode,
    getAIContextText,
    getSelectedCodeText,
    getSelectedEditorText,
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
  }, [aiPanelOpen, editor, editorMode, getSelectedEditorText, setAIContextText])

  useEffect(() => {
    if (editorMode !== 'code' || !aiPanelOpen) return

    const selectedCode = getSelectedCodeText()
    if (!selectedCode) return

    setContextText(selectedCode)
    setAIContextText(selectedCode)
  }, [aiPanelOpen, editorMode, getSelectedCodeText, setAIContextText])

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
      agentRuns
    }
  }, [currentNoteKey, messages, input, contextText, selectedModel, interactionMode, agentRuns])

  useEffect(() => {
    const previousNoteKey = previousNoteKeyRef.current
    if (previousNoteKey === currentNoteKey) return

    sessionsRef.current[previousNoteKey] = {
      messages,
      input,
      contextText,
      selectedModel,
      interactionMode,
      agentRuns
    }

    const nextSession = sessionsRef.current[currentNoteKey]
    setMessages(nextSession?.messages ?? [])
    setInput(nextSession?.input ?? '')
    setContextText(nextSession?.contextText ?? '')
    setAgentRuns(nextSession?.agentRuns ?? [])
    setStreamingResponse('')
    currentResponseRef.current = ''
    setIsLoading(false)

    if (nextSession?.selectedModel) {
      setSelectedModel(nextSession.selectedModel)
    }
    setInteractionMode(nextSession?.interactionMode ?? 'ask')

    if (nextSession?.contextText) {
      setAIContextText(nextSession.contextText)
    } else {
      clearAIContextText()
    }

    previousNoteKeyRef.current = currentNoteKey
  }, [
    currentNoteKey,
    messages,
    input,
    contextText,
    selectedModel,
    interactionMode,
    agentRuns,
    setAIContextText,
    clearAIContextText
  ])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, streamingResponse])

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

  const getCurrentCodeDocument = (): string => {
    const codeView = getCodeEditorView()
    if (codeView) {
      return codeView.state.doc.toString()
    }
    return selectedNote?.content ?? ''
  }

  const handleSend = async (
    promptOverride?: string,
    options?: { baseMessages?: SidebarMessage[] }
  ): Promise<void> => {
    const prompt = (promptOverride ?? input).trim()
    if (!prompt || !selectedModel || isLoading) return
    const baseMessages = options?.baseMessages ?? messages
    const currentCodeDocument = editorMode === 'code' ? getCurrentCodeDocument() : ''
    const isAgentRun = editorMode === 'code' && interactionMode === 'agent'
    const agentRunId = isAgentRun ? createMessageId('agent-run') : undefined

    const userMessage: SidebarMessage = {
      id: createMessageId('user'),
      role: 'user',
      content: prompt,
      mode: editorMode === 'code' ? interactionMode : undefined
    }

    const referenceMessage = contextText
      ? [
          {
            role: 'system' as const,
            content: `当前编辑器选中的${editorMode === 'code' ? '代码' : '文本'}引用如下，请优先结合它回答用户问题。\n\n${contextText}`
          }
        ]
      : []

    const modeMessages: AIMessage[] =
      editorMode === 'code' && interactionMode === 'agent'
        ? [
            {
              role: 'system',
              content:
                `你现在处于代码 Agent 模式。` +
                `当前文件标题：${selectedNote?.title || '未命名文件'}；语言：${selectedNote?.language || 'plaintext'}。\n\n` +
                `下面是当前文件的完整内容，请基于它进行修改，而不是只围绕选区做局部回答：\n\n` +
                `${getCurrentCodeDocument()}\n\n` +
                `回复要求：\n` +
                `1. 先用 2-4 条简短 bullet 说明你的修改计划或改动点。\n` +
                `2. 优先提供一个或多个 SEARCH/REPLACE 修改块，格式必须严格如下：\n` +
                `<<<<<<< SEARCH\n原代码\n=======\n新代码\n>>>>>>> REPLACE\n` +
                `3. 如果更适合，也可以提供一个 \`\`\`diff fenced code block，使用 unified diff hunk 格式。\n` +
                `4. 如果改动范围很大，再额外提供一个完整的最终文件代码块，使用三反引号包裹。\n` +
                `5. 如果当前引用不足以完成修改，要明确指出缺失信息。`
            }
          ]
        : editorMode === 'code' && interactionMode === 'edit'
          ? [
              {
                role: 'system',
                content:
                  `你现在处于代码 Edit 模式。优先根据当前引用给出可直接应用的代码修改结果。` +
                  `如果适合，请返回一个 fenced code block 供直接应用。`
              }
            ]
          : []

    const requestMessages: AIMessage[] = [
      ...modeMessages,
      ...referenceMessage,
      ...baseMessages.map(({ role, content }) => ({ role, content })),
      { role: userMessage.role, content: userMessage.content }
    ]
    setMessages([...baseMessages, userMessage])
    if (agentRunId) {
      setAgentRuns((prev) => [
        ...prev,
        {
          id: agentRunId,
          prompt,
          status: 'generating'
        }
      ])
    }
    if (!promptOverride) {
      setInput('')
    }
    setStreamingResponse('')
    currentResponseRef.current = ''
    setIsLoading(true)

    const sessionId = `stream-${Date.now()}`
    let unsubscribeChunk: (() => void) | undefined
    let unsubscribeComplete: (() => void) | undefined
    let unsubscribeError: (() => void) | undefined

    try {
      unsubscribeChunk = window.api.aiOnStreamChunk(sessionId, (chunk: string) => {
        setStreamingResponse((prev) => {
          const next = prev + chunk
          currentResponseRef.current = next
          return next
        })
      })

      unsubscribeComplete = window.api.aiOnStreamComplete(sessionId, () => {
        const finalResponse = currentResponseRef.current.trim()
        if (finalResponse) {
          const assistantMessageId = createMessageId('assistant')
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMessageId,
              role: 'assistant',
              content: finalResponse,
              mode: editorMode === 'code' ? interactionMode : undefined,
              sourceDocument: currentCodeDocument || undefined
            }
          ])
          if (agentRunId) {
            setAgentRuns((prev) =>
              prev.map((run) =>
                run.id === agentRunId
                  ? {
                      ...run,
                      status: 'proposed',
                      proposalMessageId: assistantMessageId
                    }
                  : run
              )
            )
          }
          if (
            isAgentRun &&
            (
              extractCodeBlocks(finalResponse)[0] ||
              extractSearchReplaceBlocks(finalResponse).length > 0 ||
              extractUnifiedDiff(finalResponse)
            )
          ) {
            setOpenDiffMessageKey(assistantMessageId)
          }
        } else if (agentRunId) {
          setAgentRuns((prev) =>
            prev.map((run) =>
              run.id === agentRunId
                ? {
                    ...run,
                    status: 'failed',
                    output: '模型没有返回可执行结果。'
                  }
                : run
            )
          )
        }
        setStreamingResponse('')
        currentResponseRef.current = ''
        setIsLoading(false)
      })

      unsubscribeError = window.api.aiOnStreamError(sessionId, (error: string) => {
        const errorMessage = `请求失败：${error}`
        if (agentRunId) {
          setAgentRuns((prev) =>
            prev.map((run) =>
              run.id === agentRunId
                ? {
                    ...run,
                    status: 'failed',
                    output: errorMessage
                  }
                : run
            )
          )
        } else {
          setMessages((prev) => [
            ...prev,
            { id: createMessageId('assistant-error'), role: 'assistant', content: errorMessage }
          ])
        }
        setStreamingResponse('')
        currentResponseRef.current = ''
        setIsLoading(false)
      })

      await window.api.aiStreamCompletion(selectedModel, requestMessages, {}, sessionId)
    } catch (error) {
      console.error('Failed to send message:', error)
      if (agentRunId) {
        setAgentRuns((prev) =>
          prev.map((run) =>
            run.id === agentRunId
              ? {
                  ...run,
                  status: 'failed',
                  output: '请求失败，请稍后重试。'
                }
              : run
          )
        )
      } else {
        setMessages((prev) => [
          ...prev,
          { id: createMessageId('assistant-error'), role: 'assistant', content: '请求失败，请稍后重试。' }
        ])
      }
      setStreamingResponse('')
      currentResponseRef.current = ''
      setIsLoading(false)
    } finally {
      unsubscribeChunk?.()
      unsubscribeComplete?.()
      unsubscribeError?.()
    }
  }

  const handleClear = (): void => {
    setMessages([])
    setAgentRuns([])
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

  const handleReplaceWholeFile = (content: string): void => {
    if (!content.trim() || editorMode !== 'code') return

    const codeView = getCodeEditorView()
    if (!codeView) return

    const docLength = codeView.state.doc.length
    codeView.dispatch({
      changes: { from: 0, to: docLength, insert: content },
      selection: { anchor: 0 }
    })
    codeView.focus()
  }

  const handleApplyPatch = async (runId: string, patches: SearchReplaceBlock[]): Promise<void> => {
    if (!patches.length || editorMode !== 'code') return

    const codeView = getCodeEditorView()
    if (!codeView) return

    try {
      const currentDocument = codeView.state.doc.toString()
      const nextDocument = applySearchReplaceBlocks(currentDocument, patches)
      handleReplaceWholeFile(nextDocument)
      setAgentRuns((prev) =>
        prev.map((run) =>
          run.id === runId
            ? {
                ...run,
                status: 'checking',
                output: undefined
              }
            : run
        )
      )
      await runProposalTypecheck(runId)
    } catch (error) {
      const output = error instanceof Error ? error.message : '补丁应用失败'
      setAgentRuns((prev) =>
        prev.map((run) =>
          run.id === runId
            ? {
                ...run,
                status: 'failed',
                output
              }
            : run
        )
      )
    }
  }

  const handleApplyUnifiedDiff = async (runId: string, diffText: string): Promise<void> => {
    if (!diffText.trim() || editorMode !== 'code') return

    const codeView = getCodeEditorView()
    if (!codeView) return

    try {
      const currentDocument = codeView.state.doc.toString()
      const nextDocument = applyUnifiedDiff(currentDocument, diffText)
      handleReplaceWholeFile(nextDocument)
      setAgentRuns((prev) =>
        prev.map((run) =>
          run.id === runId
            ? {
                ...run,
                status: 'checking',
                output: undefined
              }
            : run
        )
      )
      await runProposalTypecheck(runId)
    } catch (error) {
      const output = error instanceof Error ? error.message : 'diff 应用失败'
      setAgentRuns((prev) =>
        prev.map((run) =>
          run.id === runId
            ? {
                ...run,
                status: 'failed',
                output
              }
            : run
        )
      )
    }
  }

  const runProposalTypecheck = async (runId: string): Promise<void> => {
    try {
      const result = await window.api.runTypecheck()
      setAgentRuns((prev) =>
        prev.map((run) =>
          run.id === runId
            ? {
                ...run,
                status: result.success ? 'passed' : 'failed',
                output: result.output
              }
            : run
        )
      )
    } catch (error) {
      const output = error instanceof Error ? error.message : 'Typecheck failed'
      setAgentRuns((prev) =>
        prev.map((run) =>
          run.id === runId
            ? {
                ...run,
                status: 'failed',
                output
              }
            : run
        )
      )
    }
  }

  const handleApplyProposal = async (runId: string, content: string): Promise<void> => {
    handleReplaceWholeFile(content)
    setAgentRuns((prev) =>
      prev.map((run) =>
        run.id === runId
          ? {
              ...run,
              status: 'checking',
              output: undefined
            }
          : run
      )
    )
    await runProposalTypecheck(runId)
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

  const getMessageMode = (message: SidebarMessage): AISidebarMode => {
    if (editorMode !== 'code') return 'ask'
    return message.mode ?? 'ask'
  }

  const quickActions = [
    {
      id: 'explain',
      label: editorMode === 'code' ? 'Explain' : '总结',
      icon: MessageSquareQuote,
      prompt:
        editorMode === 'code'
          ? '请解释这段代码的作用、关键逻辑、潜在风险，并给出简短改进建议。'
          : '请总结这段内容的核心意思、结构和语气特点，并给出简短优化建议。'
    },
    {
      id: 'fix',
      label: editorMode === 'code' ? 'Fix' : 'Rewrite',
      icon: Bug,
      prompt:
        editorMode === 'code'
          ? '请检查这段代码的问题，给出修复后的版本，并说明修改点。'
          : '请保留原意重写这段内容，让表达更顺、更清晰。'
    },
    {
      id: 'optimize',
      label: editorMode === 'code' ? 'Optimize' : '润色',
      icon: Sparkles,
      prompt:
        editorMode === 'code'
          ? '请优化这段代码的可读性、结构和性能，并给出改进后的版本。'
          : '请在不改变原意的前提下润色这段内容，让表达更凝练。'
    },
    {
      id: 'refactor',
      label: editorMode === 'code' ? 'Refactor' : '扩写',
      icon: FilePenLine,
      prompt:
        editorMode === 'code'
          ? '请重构这段代码，拆清职责并给出更易维护的版本。'
          : '请基于这段内容继续展开，补成更完整的一版。'
    }
  ] as const

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

  const selectedModelName = models.find((model) => model.id === selectedModel)?.name
  const hasContext = contextText.trim().length > 0
  const canRunQuickActions =
    Boolean(selectedModel) &&
    !isLoading &&
    (hasContext || (editorMode === 'code' && interactionMode === 'agent'))
  const canApplyToWordEditor = editorMode === 'word' && Boolean(editor)
  const canApplyToCodeEditor = editorMode === 'code' && Boolean(getCodeEditorView())
  const canApplyResponse = canApplyToWordEditor || canApplyToCodeEditor
  const modeOptions: Array<{ id: AISidebarMode; label: string }> = [
    { id: 'ask', label: 'Ask' },
    { id: 'edit', label: 'Edit' },
    { id: 'agent', label: 'Agent' }
  ]
  const regularMessages = messages.filter(
    (message) => !(editorMode === 'code' && getMessageMode(message) === 'agent')
  )
  const activeGeneratingRun = agentRuns.find((run) => run.status === 'generating')
  const proposalMessageMap = new Map(
    messages
      .filter((message) => message.role === 'assistant')
      .map((message) => [message.id, message] as const)
  )

  return (
    <div className={cn('flex h-full flex-col bg-gradient-to-b from-background to-muted/20', className)}>
      <div className="border-b bg-background/92 px-3 py-3 backdrop-blur">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Sparkles className="size-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">AI 助手</h2>
              <p className="text-xs text-muted-foreground">
                {selectedModelName || '未选择模型'}
                {hasContext
                  ? ` · 已附带选中${editorMode === 'code' ? '代码' : '文本'}引用`
                  : ` · 可直接分析当前选中${editorMode === 'code' ? '代码' : '内容'}`}
                {editorMode === 'code' ? ` · ${interactionMode.toUpperCase()}` : ''}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClear} className="h-8 shrink-0 px-2.5">
            <Trash2 className="size-4" />
            清空
          </Button>
        </div>

        {models.length === 0 ? (
          <p className="text-xs text-destructive">没有可用模型，请先在设置中启用模型。</p>
        ) : null}

        {hasContext ? (
          <div className="mt-3 rounded-xl border bg-muted/40 p-3">
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
        ) : null}

      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {regularMessages.length === 0 && agentRuns.length === 0 && !streamingResponse ? (
            <div className="rounded-2xl border bg-background/75 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Bot className="size-4 text-primary" />
                开始一个侧边对话
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {editorMode === 'code'
                    ? '可以像 VS Code 侧栏 AI 一样直接围绕当前代码工作。'
                    : '可以像 VS Code 侧栏 AI 一样直接围绕当前文档工作。'}
                </p>
                <div className="grid gap-2">
                  <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2">
                    {editorMode === 'code' ? '解释当前选中的代码片段' : '解释当前选中的一段文字'}
                  </div>
                  <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2">
                    {editorMode === 'code' ? '基于当前代码补全或重构实现' : '按当前语气续写或重写内容'}
                  </div>
                  <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2">
                    {editorMode === 'code'
                      ? '让 AI 基于引用给出调试或优化建议'
                      : '让 AI 基于引用给出结构化建议'}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {agentRuns.map((run) => {
            const proposalMessage = run.proposalMessageId
              ? proposalMessageMap.get(run.proposalMessageId)
              : undefined
            const agentParts = proposalMessage ? parseAgentResponse(proposalMessage.content) : null
            const diffSourceDocument = proposalMessage?.sourceDocument ?? getCurrentCodeDocument()
            const patchPreviewDocument =
              agentParts?.patches.length
                ? (() => {
                    try {
                      return applySearchReplaceBlocks(diffSourceDocument, agentParts.patches)
                    } catch {
                      return ''
                    }
                  })()
                : ''
            const unifiedDiffPreviewDocument =
              agentParts?.unifiedDiff
                ? (() => {
                    try {
                      return applyUnifiedDiff(diffSourceDocument, agentParts.unifiedDiff)
                    } catch {
                      return ''
                    }
                  })()
                : ''
            const codeDiff =
              patchPreviewDocument
                ? buildLineDiff(diffSourceDocument, patchPreviewDocument)
                : unifiedDiffPreviewDocument
                  ? buildLineDiff(diffSourceDocument, unifiedDiffPreviewDocument)
                : agentParts?.code
                  ? buildLineDiff(diffSourceDocument, agentParts.code)
                  : []
            const hasCodeDiff = codeDiff.some((line) => line.type !== 'context')
            const proposalMessageIndex = proposalMessage
              ? messages.findIndex((item) => item.id === proposalMessage.id)
              : -1
            const canRetry =
              proposalMessageIndex >= 0 &&
              messages.slice(0, proposalMessageIndex).some((item) => item.role === 'user')
            const runSteps: Array<{
              id: 'request' | 'proposal' | 'apply' | 'check'
              label: string
            }> = [
              { id: 'request', label: 'Request' },
              { id: 'proposal', label: 'Proposal' },
              { id: 'apply', label: 'Apply' },
              { id: 'check', label: 'Check' }
            ]

            return (
              <div key={run.id} className="rounded-2xl border bg-background shadow-sm">
                <div className="flex items-start justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <BadgeCheck className="size-4 text-primary" />
                      <p className="text-sm font-semibold">Agent Run</p>
                      <span className="rounded-full border bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground">
                        {run.status === 'generating'
                          ? 'GENERATING'
                          : run.status === 'proposed'
                            ? 'PROPOSED'
                            : run.status === 'checking'
                              ? 'CHECKING'
                              : run.status === 'passed'
                                ? 'PASSED'
                                : run.status === 'failed'
                                  ? 'FAILED'
                                  : 'PLANNING'}
                      </span>
                    </div>
                    <p className="line-clamp-2 whitespace-pre-wrap text-sm text-foreground/90">
                      {run.prompt}
                    </p>
                  </div>
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    {run.status === 'generating' || run.status === 'checking' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                  </div>
                </div>

                <div className="border-b bg-muted/10 px-4 py-3">
                  <div className="grid grid-cols-4 gap-2">
                    {runSteps.map((step) => {
                      const stepState = getAgentRunStepState(
                        run.status,
                        step.id,
                        Boolean(proposalMessage)
                      )
                      return (
                        <div key={`${run.id}-${step.id}`} className="space-y-1">
                          <div
                            className={cn(
                              'h-1.5 rounded-full',
                              stepState === 'done' && 'bg-primary/80',
                              stepState === 'active' && 'bg-primary',
                              stepState === 'pending' && 'bg-muted',
                              stepState === 'error' && 'bg-rose-500'
                            )}
                          />
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                'size-2 rounded-full',
                                stepState === 'done' && 'bg-primary/80',
                                stepState === 'active' && 'bg-primary shadow-[0_0_0_3px_rgba(59,130,246,0.18)]',
                                stepState === 'pending' && 'bg-muted-foreground/30',
                                stepState === 'error' && 'bg-rose-500'
                              )}
                            />
                            <span
                              className={cn(
                                'text-[11px] font-medium',
                                stepState === 'pending'
                                  ? 'text-muted-foreground'
                                  : 'text-foreground'
                              )}
                            >
                              {step.label}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {run.status === 'generating'
                      ? 'Agent 正在读取当前文件并生成修改提案。'
                      : run.status === 'proposed'
                        ? '提案已经生成，可以先看 diff，再决定是否应用。'
                        : run.status === 'checking'
                          ? '修改已应用，正在执行 typecheck 校验结果。'
                          : run.status === 'passed'
                            ? '修改和校验都已完成，这一轮 run 结束。'
                            : run.status === 'failed'
                              ? proposalMessage
                                ? '修改已经应用，但校验失败，需要继续修正。'
                                : 'Agent 在生成提案阶段失败，可以直接重试。'
                              : 'Agent 正在准备本轮执行。'}
                  </p>
                </div>

                {run.status === 'generating' ? (
                  <div className="space-y-3 px-4 py-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin text-primary" />
                      <span>正在分析当前文件并生成修改提案...</span>
                    </div>
                    {streamingResponse ? (
                      <div className="rounded-xl border bg-muted/15 p-3">
                        <StreamMarkdown content={streamingResponse} />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {agentParts?.summaryLines.length ? (
                  <div className="border-b px-4 py-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      修改计划
                    </p>
                    <div className="space-y-1.5">
                      {agentParts.summaryLines.map((line, summaryIndex) => (
                        <div key={`${run.id}-summary-${summaryIndex}`} className="flex gap-2 text-sm">
                          <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-primary/70" />
                          <span className="text-foreground/90">{line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {proposalMessage && openDiffMessageKey === proposalMessage.id && hasCodeDiff ? (
                  <div className="border-b">
                    <div className="flex items-center justify-between px-4 py-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Diff 预览
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setOpenDiffMessageKey(null)}
                      >
                        收起
                      </Button>
                    </div>
                    <ScrollArea className="max-h-[280px]" orientation="both">
                      <div className="font-mono text-[12px] leading-6">
                        {codeDiff.map((line, lineIndex) => (
                          <div
                            key={`${run.id}-diff-${lineIndex}`}
                            className={cn(
                              'flex min-w-max gap-3 px-4',
                              line.type === 'added' &&
                                'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
                              line.type === 'removed' &&
                                'bg-rose-500/12 text-rose-700 dark:text-rose-300'
                            )}
                          >
                            <span className="w-4 shrink-0 text-center text-muted-foreground">
                              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                            </span>
                            <span className="whitespace-pre">{line.content || ' '}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : null}

                {proposalMessage &&
                (agentParts?.code || agentParts?.patches.length || agentParts?.unifiedDiff) ? (
                  <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                    {agentParts.patches.length ? (
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          void handleApplyPatch(run.id, agentParts.patches)
                        }}
                        disabled={!canApplyToCodeEditor || run.status === 'checking' || !patchPreviewDocument}
                      >
                        <Replace className="size-3.5" />
                        应用补丁
                      </Button>
                    ) : null}
                    {agentParts.unifiedDiff ? (
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          void handleApplyUnifiedDiff(run.id, agentParts.unifiedDiff)
                        }}
                        disabled={
                          !canApplyToCodeEditor || run.status === 'checking' || !unifiedDiffPreviewDocument
                        }
                      >
                        <CodeXml className="size-3.5" />
                        应用 Diff
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        void handleApplyProposal(run.id, agentParts.code)
                      }}
                      disabled={!canApplyToCodeEditor || run.status === 'checking' || !agentParts.code}
                    >
                      <FilePenLine className="size-3.5" />
                      应用整个文件
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() =>
                        setOpenDiffMessageKey((prev) =>
                          prev === proposalMessage.id ? null : proposalMessage.id
                        )
                      }
                      disabled={!hasCodeDiff}
                    >
                      <Eye className="size-3.5" />
                      {openDiffMessageKey === proposalMessage.id ? '隐藏 Diff' : '查看 Diff'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => handleCopyMessage(agentParts.code, `${run.id}-code`)}
                    >
                      <Copy className="size-3.5" />
                      复制代码
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => handleRetry(proposalMessageIndex)}
                      disabled={!canRetry || isLoading}
                    >
                      <RotateCcw className="size-3.5" />
                      Retry
                    </Button>
                  </div>
                ) : null}

                {(run.status === 'checking' ||
                  run.status === 'passed' ||
                  (run.status === 'failed' && proposalMessage)) ? (
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      {run.status === 'checking' ? (
                        <>
                          <Loader2 className="size-4 animate-spin text-primary" />
                          <span>正在运行 typecheck...</span>
                        </>
                      ) : run.status === 'passed' ? (
                        <>
                          <BadgeCheck className="size-4 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400">
                            已应用，typecheck 通过
                          </span>
                        </>
                      ) : (
                        <>
                          <Bug className="size-4 text-rose-500" />
                          <span className="text-rose-600 dark:text-rose-400">
                            已应用，但 typecheck 失败
                          </span>
                        </>
                      )}
                    </div>
                    {run.output ? (
                      <ScrollArea className="mt-2 max-h-[160px]" orientation="both">
                        <pre className="rounded-md border bg-muted/25 p-3 text-[11px] leading-5 text-muted-foreground">
                          {run.output}
                        </pre>
                      </ScrollArea>
                    ) : null}
                  </div>
                ) : null}

                {proposalMessage && agentParts?.patches.length ? (
                  <div className="border-b px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Patch 提案
                      </p>
                      <span className="rounded-full border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
                        {agentParts.patches.length} blocks
                      </span>
                    </div>
                    <div className="mt-2 space-y-2">
                      {agentParts.patches.slice(0, 3).map((patch, patchIndex) => (
                        <div key={`${run.id}-patch-${patchIndex}`} className="rounded-lg border bg-muted/15 p-3">
                          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Patch {patchIndex + 1}
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            <div className="rounded-md bg-rose-500/8 p-2">
                              <div className="mb-1 text-[10px] uppercase tracking-wide text-rose-600 dark:text-rose-300">
                                Search
                              </div>
                              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-muted-foreground">
                                {patch.search}
                              </pre>
                            </div>
                            <div className="rounded-md bg-emerald-500/8 p-2">
                              <div className="mb-1 text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                                Replace
                              </div>
                              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-muted-foreground">
                                {patch.replace}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                      {agentParts.patches.length > 3 ? (
                        <p className="text-xs text-muted-foreground">
                          仅预览前 3 个 patch，实际应用时会按全部 patch 执行。
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {proposalMessage && agentParts?.unifiedDiff ? (
                  <div className="border-b px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Unified Diff
                      </p>
                      <span className="rounded-full border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
                        Hunk
                      </span>
                    </div>
                    <ScrollArea className="mt-2 max-h-[220px]" orientation="both">
                      <pre className="rounded-lg border bg-muted/15 p-3 font-mono text-[11px] leading-5 text-muted-foreground">
                        {agentParts.unifiedDiff}
                      </pre>
                    </ScrollArea>
                  </div>
                ) : null}

                {proposalMessage && agentParts?.body && agentParts.summaryLines.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-muted-foreground">
                    <StreamMarkdown content={agentParts.body} />
                  </div>
                ) : null}

                {run.status === 'failed' && run.output ? (
                  <div className="px-4 py-4">
                    <div className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
                      <Bug className="size-4" />
                      <span>Agent 运行失败</span>
                    </div>
                    <pre className="mt-2 rounded-md border bg-muted/25 p-3 text-[11px] leading-5 text-muted-foreground">
                      {run.output}
                    </pre>
                  </div>
                ) : null}
              </div>
            )
          })}

          {regularMessages.map((message) => {
            const isUser = message.role === 'user'
            const messageKey = message.id
            const messageIndex = messages.findIndex((item) => item.id === messageKey)
            const messageMode = getMessageMode(message)
            const codeBlocks = isUser ? [] : extractCodeBlocks(message.content)
            const firstCodeBlock = codeBlocks[0] ?? ''
            const bodyContent = isUser ? '' : extractBodyContent(message.content)
            const agentParts = !isUser && messageMode === 'agent' ? parseAgentResponse(message.content) : null
            const diffSourceDocument =
              editorMode === 'code' ? message.sourceDocument ?? getCurrentCodeDocument() : ''
            const codeDiff =
              editorMode === 'code' && (agentParts?.code || firstCodeBlock)
                ? buildLineDiff(diffSourceDocument, agentParts?.code || firstCodeBlock)
                : []
            const hasCodeDiff = codeDiff.some((line) => line.type !== 'context')
            const canRetry =
              !isUser && messageIndex >= 0 && messages.slice(0, messageIndex).some((item) => item.role === 'user')
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
                ? messageMode === 'agent'
                  ? [
                      ...(firstCodeBlock
                        ? [
                            {
                              id: 'preview-diff',
                              label: openDiffMessageKey === messageKey ? '收起 diff' : '预览 diff',
                              icon: Eye,
                              onClick: () => {
                                setOpenDiffMessageKey((prev) =>
                                  prev === messageKey ? null : messageKey
                                )
                              },
                              active: openDiffMessageKey === messageKey,
                              disabled: !hasCodeDiff
                            },
                            {
                              id: 'apply-file',
                              label: '应用整个文件',
                              icon: FilePenLine,
                              onClick: () => handleReplaceWholeFile(agentParts?.code || firstCodeBlock),
                              disabled: !canApplyToCodeEditor
                            }
                          ]
                        : [])
                    ]
                  : messageMode === 'edit'
                    ? [
                        ...(firstCodeBlock
                          ? [
                              {
                                id: 'apply-code',
                                label: '应用代码块',
                                icon: CodeXml,
                                onClick: () => handleReplaceSelection(firstCodeBlock),
                                disabled: !canApplyResponse || !hasContext
                              }
                            ]
                          : []),
                        {
                          id: 'replace',
                          label: '替换选区',
                          icon: Replace,
                          onClick: () => handleReplaceSelection(message.content),
                          disabled: !canApplyResponse || !hasContext
                        },
                        {
                          id: 'insert-below',
                          label: '插入下方',
                          icon: MoveDown,
                          onClick: () => handleInsertBelow(message.content),
                          disabled: !canApplyResponse
                        }
                      ]
                    : [
                        {
                          id: 'insert-below',
                          label: '插入下方',
                          icon: MoveDown,
                          onClick: () => handleInsertBelow(message.content),
                          disabled: !canApplyResponse
                        }
                      ]
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
                  <div className="mt-1 self-start rounded-full bg-primary/10 p-1.5 text-primary">
                    <Bot className="size-3.5" />
                  </div>
                ) : null}

                <div className={cn('max-w-[88%] rounded-xl border px-3 py-2.5 text-sm', isUser ? 'bg-primary text-primary-foreground border-primary/50' : 'bg-background')}>
                  {isUser ? (
                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                  ) : (
                    <>
                      <StreamMarkdown content={message.content} />
                      {messageMode !== 'agent' && openDiffMessageKey === messageKey && hasCodeDiff ? (
                        <div className="mt-3 overflow-hidden rounded-lg border bg-muted/20">
                          <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                            当前文件 Diff 预览
                          </div>
                          <ScrollArea className="max-h-[260px]" orientation="both">
                            <div className="font-mono text-[12px] leading-6">
                              {codeDiff.map((line, lineIndex) => (
                                <div
                                  key={`${messageKey}-diff-${lineIndex}`}
                                  className={cn(
                                    'flex min-w-max gap-3 px-3',
                                    line.type === 'added' && 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
                                    line.type === 'removed' && 'bg-rose-500/12 text-rose-700 dark:text-rose-300'
                                  )}
                                >
                                  <span className="w-4 shrink-0 text-center text-muted-foreground">
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
                        </div>
                      ) : null}
                      <div className="mt-3 flex items-center gap-2 border-t pt-2">
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
                    </>
                  )}
                </div>

                {isUser ? (
                  <div className="mt-1 self-start rounded-full bg-muted p-1.5 text-muted-foreground">
                    <UserRound className="size-3.5" />
                  </div>
                ) : null}
              </div>
            )
          })}

          {(streamingResponse || isLoading) && !activeGeneratingRun ? (
            <div className="flex items-start justify-start gap-2">
              <div className="mt-1 self-start rounded-full bg-primary/10 p-1.5 text-primary">
                <Bot className="size-3.5" />
              </div>
              <div className="max-w-[88%] rounded-xl border bg-background px-3 py-2.5 text-sm">
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

      <div className="relative border-t bg-background/95 p-3">
        <div className="-mt-[3.25rem] mb-3 flex flex-wrap gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full border border-white/10 border-b-border/80 bg-gradient-to-b from-white/12 via-background to-background px-3 text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_8px_22px_rgba(0,0,0,0.22),0_2px_6px_rgba(0,0,0,0.14)] backdrop-blur supports-[backdrop-filter]:bg-background/92"
                onClick={() => {
                  void handleSend(action.prompt)
                }}
                disabled={!canRunQuickActions}
              >
                <Icon className="size-3.5" />
                {action.label}
              </Button>
            )
          })}
        </div>
        <div className="mb-2 flex items-center justify-between gap-2">
          {editorMode === 'code' ? (
            <div className="flex items-center gap-1 rounded-full border bg-background/80 p-1">
              {modeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                    interactionMode === option.id
                      ? 'bg-accent text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setInteractionMode(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : (
            <div />
          )}
          {models.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 max-w-[180px] justify-between gap-2 rounded-full border bg-muted/35 px-3 text-xs hover:bg-muted/55"
                >
                  <span className="truncate">{selectedModelName || '选择模型'}</span>
                  <ChevronDown className="size-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start" side="top">
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
        </div>
        <div className="flex gap-2">
          <Textarea
            placeholder={
              hasContext
                ? `基于当前${editorMode === 'code' ? '代码引用' : '引用'}继续提问... (Enter 发送)`
                : '输入消息... (Enter 发送, Shift+Enter 换行)'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={(e) => {
              setIsComposing(false)
              setInput(e.currentTarget.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
                e.preventDefault()
                handleSend()
              }
            }}
            className="min-h-[76px] max-h-[150px] flex-1 resize-none text-sm"
            disabled={isLoading || !selectedModel}
          />
          <Button
            onClick={() => {
              void handleSend()
            }}
            disabled={!input.trim() || !selectedModel || isLoading}
            size="icon"
            className="size-10 self-end"
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
