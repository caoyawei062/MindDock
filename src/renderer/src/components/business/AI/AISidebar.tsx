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
  workspaceSession: CodeWorkspaceSession | null
}

type AISidebarMode = 'ask' | 'plan' | 'agent'

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

interface AgentToolCall {
  name: 'apply_patch' | 'apply_diff' | 'replace_file' | 'needs_input'
  summary?: string
}

interface AgentResponseParts {
  summaryLines: string[]
  code: string
  body: string
  patches: SearchReplaceBlock[]
  unifiedDiff: string
  toolCall: AgentToolCall | null
  actionable: boolean
}

interface WorkspaceValidationState {
  status: 'idle' | 'running' | 'passed' | 'failed'
  output?: string
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
  actionable: boolean
  previewIssue?: string
  diffLines: DiffLine[]
  error?: string
  validation: WorkspaceValidationState
}

type AgentRunStepState = 'done' | 'active' | 'pending' | 'error'
type BuildEventTone = 'default' | 'muted' | 'success' | 'error'

interface BuildEventRowProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description?: string
  badge?: string
  tone?: BuildEventTone
  children?: React.ReactNode
  actions?: React.ReactNode
}

function BuildEventRow({
  icon: Icon,
  label,
  description,
  badge,
  tone = 'default',
  children,
  actions
}: BuildEventRowProps): React.JSX.Element {
  return (
    <div className="flex gap-2.5">
      <div
        className={cn(
          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border',
          tone === 'default' && 'border-primary/20 bg-primary/8 text-primary',
          tone === 'muted' && 'border-border bg-muted/20 text-muted-foreground',
          tone === 'success' &&
            'border-emerald-500/25 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400',
          tone === 'error' && 'border-rose-500/25 bg-rose-500/8 text-rose-600 dark:text-rose-400'
        )}
      >
        <Icon className="size-3" />
      </div>
      <div className="min-w-0 flex-1 border-l border-border/50 pl-2.5 pb-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </div>
            {description ? (
              <div className="mt-0.5 text-[13px] leading-5 text-foreground/90">{description}</div>
            ) : null}
          </div>
          {badge ? (
            <span className="shrink-0 rounded-md border bg-background/70 px-1.5 py-0.5 text-[10px] text-foreground/75">
              {badge}
            </span>
          ) : null}
        </div>
        {children ? <div className="mt-1.5">{children}</div> : null}
        {actions ? <div className="mt-1.5">{actions}</div> : null}
      </div>
    </div>
  )
}

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

function extractExecutableCodeBlocks(content: string): string[] {
  return extractFencedCodeBlocks(content)
    .filter((item) => item.language !== 'tool_call' && item.language !== 'diff')
    .map((item) => item.content)
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

function extractToolCall(content: string): AgentToolCall | null {
  const jsonBlock = extractFencedCodeBlocks(content).find((block) => block.language === 'tool_call')
  if (jsonBlock) {
    try {
      const parsed = JSON.parse(jsonBlock.content) as AgentToolCall
      if (
        parsed &&
        (parsed.name === 'apply_patch' ||
          parsed.name === 'apply_diff' ||
          parsed.name === 'replace_file' ||
          parsed.name === 'needs_input')
      ) {
        return parsed
      }
    } catch (error) {
      console.error('Failed to parse tool_call block:', error)
    }
  }

  if (extractSearchReplaceBlocks(content).length > 0) {
    return { name: 'apply_patch', summary: 'Apply search/replace patch blocks' }
  }
  if (extractUnifiedDiff(content)) {
    return { name: 'apply_diff', summary: 'Apply unified diff hunks' }
  }
  if (extractCodeBlocks(content)[0]) {
    return { name: 'replace_file', summary: 'Replace current file with generated output' }
  }

  return null
}

function isNonActionableToolCall(toolCall: AgentToolCall | null): boolean {
  if (!toolCall) return false
  if (toolCall.name === 'needs_input') return true
  const summary = toolCall.summary?.trim() ?? ''
  if (!summary) return false

  return /等待用户|请提供|需要更多|缺少|缺失|不足以|补充|进一步信息|更多信息/.test(summary)
}

function parseAgentResponse(content: string): AgentResponseParts {
  const code = extractExecutableCodeBlocks(content)[0] ?? ''
  const body = extractBodyContent(content)
  const patches = extractSearchReplaceBlocks(content)
  const unifiedDiff = extractUnifiedDiff(content)
  const toolCall = extractToolCall(content)
  const summaryLines = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*•]\s+/.test(line))
    .map((line) => line.replace(/^[-*•]\s+/, ''))
    .slice(0, 6)
  const actionable =
    !isNonActionableToolCall(toolCall) &&
    (patches.length > 0 || Boolean(unifiedDiff) || Boolean(code))

  return {
    summaryLines,
    code,
    body,
    patches,
    unifiedDiff,
    toolCall,
    actionable
  }
}

function resolveDraftDocument(
  source: string,
  response: AgentResponseParts
): { draftDocument: string | null; previewIssue?: string } {
  if (response.toolCall?.name === 'needs_input') {
    return {
      draftDocument: null,
      previewIssue: response.toolCall.summary || '需要补充信息后才能继续。'
    }
  }

  const attempts: Array<() => string> = []
  const errors: string[] = []

  const pushPatchAttempt = (): void => {
    if (!response.patches.length) return
    attempts.push(() => applySearchReplaceBlocks(source, response.patches))
  }

  const pushDiffAttempt = (): void => {
    if (!response.unifiedDiff) return
    attempts.push(() => applyUnifiedDiff(source, response.unifiedDiff))
  }

  const pushReplaceAttempt = (): void => {
    if (!response.code) return
    attempts.push(() => response.code)
  }

  switch (response.toolCall?.name) {
    case 'apply_patch':
      pushPatchAttempt()
      pushDiffAttempt()
      pushReplaceAttempt()
      break
    case 'apply_diff':
      pushDiffAttempt()
      pushPatchAttempt()
      pushReplaceAttempt()
      break
    case 'replace_file':
      pushReplaceAttempt()
      pushPatchAttempt()
      pushDiffAttempt()
      break
    default:
      pushPatchAttempt()
      pushDiffAttempt()
      pushReplaceAttempt()
      break
  }

  for (const attempt of attempts) {
    try {
      return { draftDocument: attempt() }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : '无法解析当前草稿。')
    }
  }

  return {
    draftDocument: null,
    previewIssue: errors[0] || '模型没有返回可应用的单文件修改结果。'
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

function getWorkspaceStepState(
  session: CodeWorkspaceSession,
  step: 'request' | 'proposal' | 'apply' | 'check'
): AgentRunStepState {
  if (session.status === 'generating') {
    return step === 'request' ? 'active' : 'pending'
  }

  if (session.status === 'failed') {
    if (session.responseContent) {
      if (step === 'request' || step === 'proposal') return 'done'
      if (step === 'apply' || step === 'check') return 'error'
      return 'pending'
    }
    if (step === 'request') return 'done'
    if (step === 'proposal') return 'error'
    return 'pending'
  }

  if (session.status === 'ready') {
    if (step === 'request' || step === 'proposal') return 'done'
    if (step === 'apply') return 'active'
    return 'pending'
  }

  if (session.status === 'applied') {
    if (step === 'request' || step === 'proposal' || step === 'apply') return 'done'
    if (session.validation.status === 'failed') return 'error'
    if (session.validation.status === 'running') return 'active'
    return session.validation.status === 'passed' ? 'done' : 'active'
  }

  return step === 'request' ? 'active' : 'pending'
}

function getModeLabel(mode: AISidebarMode): string {
  if (mode === 'plan') return 'PLAN'
  if (mode === 'agent') return 'AGENT'
  return 'ASK'
}

function getToolCallLabel(name: AgentToolCall['name']): string {
  if (name === 'apply_patch') return 'Patch'
  if (name === 'apply_diff') return 'Diff'
  if (name === 'needs_input') return 'Reply'
  return 'Replace File'
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
  className
}: {
  content: string
  className?: string
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
          <div className="my-2 overflow-hidden rounded-lg border bg-muted/20">
            <div className="flex items-center justify-between border-b bg-muted/55 px-3 py-1.5">
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
            <ScrollArea className="max-h-[320px]" orientation="both">
              <div className="px-3 py-2.5 pr-5">
                <pre className="m-0 min-w-max text-[13px] leading-[1.35rem]">
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
        'prose prose-sm dark:prose-invert max-w-none prose-p:leading-7 prose-pre:bg-transparent prose-pre:p-0',
        className
      )}
    >
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  )
}

export function AISidebar({ className, editorMode = 'word' }: AISidebarProps): React.JSX.Element {
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
    getCodeEditorView,
    getCodeDocument,
    replaceCodeDocument
  } = useEditorContext()
  const [models, setModels] = useState<AIModelConfig[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [messages, setMessages] = useState<SidebarMessage[]>([])
  const [input, setInput] = useState('')
  const [contextText, setContextText] = useState('')
  const [interactionMode, setInteractionMode] = useState<AISidebarMode>('plan')
  const [streamingResponse, setStreamingResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const [workspaceSession, setWorkspaceSession] = useState<CodeWorkspaceSession | null>(null)
  const [copiedMessageKey, setCopiedMessageKey] = useState<string | null>(null)
  const [openDiffMessageKey, setOpenDiffMessageKey] = useState<string | null>(null)

  const messageEndRef = useRef<HTMLDivElement>(null)
  const currentResponseRef = useRef('')
  const currentSessionIdRef = useRef<string | null>(null)
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

    const selectedText = editorMode === 'code' ? getSelectedCodeText() : getSelectedEditorText()
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
    setContextText(nextSession?.contextText ?? '')
    setWorkspaceSession(nextSession?.workspaceSession ?? null)
    setStreamingResponse('')
    currentResponseRef.current = ''
    setIsLoading(false)

    if (nextSession?.selectedModel) {
      setSelectedModel(nextSession.selectedModel)
    }
    setInteractionMode(nextSession?.interactionMode ?? 'plan')

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
    workspaceSession,
    setAIContextText,
    clearAIContextText
  ])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, workspaceSession?.status, workspaceSession?.validation.status])

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

  const getCurrentCodeDocument = (): string => {
    return getCodeDocument() || selectedNote?.content || ''
  }

  const handleConversationSend = async (
    prompt: string,
    options?: { baseMessages?: SidebarMessage[] }
  ): Promise<void> => {
    const baseMessages = options?.baseMessages ?? messages
    const currentCodeDocument = editorMode === 'code' ? getCurrentCodeDocument() : ''
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
      editorMode === 'code' && interactionMode === 'plan'
        ? [
            {
              role: 'system',
              content:
                `你现在处于代码 Plan 模式。` +
                `请基于当前文件给出简短计划、关键风险、实现步骤和验证方式。` +
                `不要直接返回补丁、diff 或完整代码。`
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
    setInput('')
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
        setStreamingResponse((prev) => {
          const next = prev + chunk
          currentResponseRef.current = next
          return next
        })
      })

      unsubscribeComplete = window.api.aiOnStreamComplete(sessionId, () => {
        const finalResponse = currentResponseRef.current.trim()
        if (finalResponse) {
          setMessages((prev) => [
            ...prev,
            {
              id: createMessageId('assistant'),
              role: 'assistant',
              content: finalResponse,
              mode: editorMode === 'code' ? interactionMode : undefined,
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

      await window.api.aiStreamCompletion(selectedModel, requestMessages, {}, sessionId)
    } catch (error) {
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
    const currentCodeDocument = getCurrentCodeDocument()
    const requestMessages: AIMessage[] = [
      {
        role: 'system',
        content:
          `你现在处于代码 Agent 模式。` +
          `当前文件标题：${selectedNote?.title || '未命名文件'}；语言：${selectedNote?.language || 'plaintext'}。\n\n` +
          `下面是当前文件的完整内容，你的工作对象只有这个文件：\n\n` +
          `${currentCodeDocument}\n\n` +
          `回复要求：\n` +
          `1. 第一段必须返回一个 \`\`\`tool_call JSON code block，格式是：{"name":"apply_patch"|"apply_diff"|"replace_file"|"needs_input","summary":"一句话说明"}。\n` +
          `2. 然后用 2-4 条简短 bullet 说明本次改动计划。\n` +
          `3. 优先返回 patch、diff 或完整文件三者之一，让结果可以被归一成单文件草稿。\n` +
          `4. 如果信息不足，就把 tool_call.name 设为 "needs_input"，并明确说明缺什么。`
      },
      ...(contextText
        ? [
            {
              role: 'system' as const,
              content: `当前选中的代码引用如下，请在必要时优先参考它：\n\n${contextText}`
            }
          ]
        : []),
      { role: 'user', content: prompt }
    ]

    setInput('')
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
      actionable: false,
      diffLines: [],
      validation: { status: 'idle' }
    })
    setOpenDiffMessageKey('workspace')
    setIsLoading(true)

    const sessionId = `stream-${Date.now()}`
    currentSessionIdRef.current = sessionId
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
        const parsed = parseAgentResponse(finalResponse)
        const { draftDocument, previewIssue } = resolveDraftDocument(currentCodeDocument, parsed)
        const actionable = Boolean(parsed.actionable && draftDocument)

        setWorkspaceSession({
          prompt,
          status: actionable ? 'ready' : 'failed',
          sourceDocument: currentCodeDocument,
          draftDocument: draftDocument ?? '',
          responseContent: finalResponse,
          summaryLines: parsed.summaryLines,
          notes: parsed.body,
          toolCall: parsed.toolCall,
          actionable,
          diffLines: draftDocument ? buildLineDiff(currentCodeDocument, draftDocument) : [],
          previewIssue,
          error: actionable || finalResponse ? undefined : '模型没有返回可执行结果。',
          validation: { status: 'idle' }
        })

        setStreamingResponse('')
        currentResponseRef.current = ''
        currentSessionIdRef.current = null
        setIsLoading(false)
      })

      unsubscribeError = window.api.aiOnStreamError(sessionId, (error: string) => {
        setWorkspaceSession({
          prompt,
          status: 'failed',
          sourceDocument: currentCodeDocument,
          draftDocument: '',
          responseContent: '',
          summaryLines: [],
          notes: '',
          toolCall: null,
          actionable: false,
          diffLines: [],
          error: `请求失败：${error}`,
          validation: { status: 'idle' }
        })
        setStreamingResponse('')
        currentResponseRef.current = ''
        currentSessionIdRef.current = null
        setIsLoading(false)
      })

      await window.api.aiStreamCompletion(selectedModel, requestMessages, {}, sessionId)
    } catch (error) {
      console.error('Failed to run agent:', error)
      setWorkspaceSession({
        prompt,
        status: 'failed',
        sourceDocument: currentCodeDocument,
        draftDocument: '',
        responseContent: '',
        summaryLines: [],
        notes: '',
        toolCall: null,
        actionable: false,
        diffLines: [],
        error: '请求失败，请稍后重试。',
        validation: { status: 'idle' }
      })
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

  const handleSend = async (
    promptOverride?: string,
    options?: { baseMessages?: SidebarMessage[] }
  ): Promise<void> => {
    const prompt = (promptOverride ?? input).trim()
    if (!prompt || !selectedModel || isLoading) return

    if (editorMode === 'code' && interactionMode === 'agent') {
      await handleAgentRun(prompt)
      return
    }

    await handleConversationSend(prompt, options)
  }

  const handleStopGeneration = async (): Promise<void> => {
    const sessionId = currentSessionIdRef.current
    if (!sessionId || !isLoading) return

    try {
      await window.api.aiCancelStream(sessionId)
    } catch (error) {
      console.error('Failed to cancel AI stream:', error)
    } finally {
      currentSessionIdRef.current = null
      setIsLoading(false)
      setStreamingResponse('')
      currentResponseRef.current = ''
      setWorkspaceSession((prev) =>
        prev && prev.status === 'generating'
          ? {
              ...prev,
              status: 'failed',
              error: '本次生成已被手动中断。'
            }
          : prev
      )
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

  const handleReplaceWholeFile = (content: string): void => {
    if (!content.trim() || editorMode !== 'code') return
    replaceCodeDocument(content)
  }

  const runWorkspaceValidation = async (): Promise<void> => {
    setWorkspaceSession((prev) =>
      prev
        ? {
            ...prev,
            validation: { status: 'running' }
          }
        : prev
    )

    try {
      const result = await window.api.runTypecheck()
      setWorkspaceSession((prev) =>
        prev
          ? {
              ...prev,
              validation: {
                status: result.success ? 'passed' : 'failed',
                output: result.output
              }
            }
          : prev
      )
    } catch (error) {
      const output = error instanceof Error ? error.message : 'Typecheck failed'
      setWorkspaceSession((prev) =>
        prev
          ? {
              ...prev,
              validation: {
                status: 'failed',
                output
              }
            }
          : prev
      )
    }
  }

  const handleApplyWorkspaceDraft = async (): Promise<void> => {
    if (!workspaceSession?.actionable || !workspaceSession.draftDocument || editorMode !== 'code') {
      return
    }

    handleReplaceWholeFile(workspaceSession.draftDocument)
    setWorkspaceSession((prev) =>
      prev
        ? {
            ...prev,
            status: 'applied',
            validation: { status: 'running' }
          }
        : prev
    )
    await runWorkspaceValidation()
  }

  const handleDiscardWorkspaceDraft = (): void => {
    setWorkspaceSession(null)
    setOpenDiffMessageKey(null)
  }

  const handleRetryWorkspace = (): void => {
    if (!workspaceSession?.prompt || isLoading) return
    void handleAgentRun(workspaceSession.prompt)
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
      label: editorMode === 'code' ? (interactionMode === 'agent' ? 'Audit' : 'Explain') : '总结',
      icon: MessageSquareQuote,
      prompt:
        editorMode === 'code'
          ? interactionMode === 'agent'
            ? '请接管这个当前文件，检查最值得先改的结构、缺陷和风险，并直接给出可应用的单文件修改结果。'
            : '请解释这个当前文件的作用、关键逻辑、潜在风险，并给出简短改进建议。'
          : '请总结这段内容的核心意思、结构和语气特点，并给出简短优化建议。'
    },
    {
      id: 'fix',
      label: editorMode === 'code' ? (interactionMode === 'plan' ? 'Plan' : 'Fix') : 'Rewrite',
      icon: Bug,
      prompt:
        editorMode === 'code'
          ? interactionMode === 'plan'
            ? '请先给出修改计划、风险点、执行顺序和验证步骤，不要直接改代码。'
            : '请直接修复这个当前文件中最明显的问题，返回可应用的单文件修改结果，并说明验证方式。'
          : '请保留原意重写这段内容，让表达更顺、更清晰。'
    },
    {
      id: 'optimize',
      label:
        editorMode === 'code' ? (interactionMode === 'agent' ? 'Take Over' : 'Optimize') : '润色',
      icon: Sparkles,
      prompt:
        editorMode === 'code'
          ? interactionMode === 'agent'
            ? '请接管这个当前文件，围绕可维护性和清晰度做一次完整改造，返回可应用的单文件草稿，并说明验证方式。'
            : '请优化这段代码的可读性、结构和性能，并给出改进后的版本。'
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
    Boolean(selectedModel) && !isLoading && (hasContext || editorMode === 'code')
  const showQuickActions = true
  const canApplyToWordEditor = editorMode === 'word' && Boolean(editor)
  const canApplyToCodeEditor = editorMode === 'code' && Boolean(getCodeEditorView())
  const canApplyResponse = canApplyToWordEditor || canApplyToCodeEditor
  const modeOptions: Array<{ id: AISidebarMode; label: string }> = [
    { id: 'plan', label: 'Plan' },
    { id: 'agent', label: 'Agent' }
  ]
  const regularMessages = messages

  return (
    <div
      className={cn('flex h-full flex-col bg-gradient-to-b from-background to-muted/20', className)}
    >
      <div className="border-b bg-background/92 px-3 py-3 backdrop-blur">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg border bg-primary/8 p-2">
              <Sparkles className="size-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">AI 助手</h2>
              <p className="text-xs text-muted-foreground">
                {selectedModelName || '未选择模型'}
                {editorMode === 'code'
                  ? ` · ${getModeLabel(interactionMode)} workspace`
                  : hasContext
                    ? ' · 已附带选中文本引用'
                    : ' · 可直接分析当前选中内容'}
              </p>
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
            className="h-8 shrink-0 px-2.5"
          >
            {isLoading ? <X className="size-4" /> : <Trash2 className="size-4" />}
            {isLoading ? '停止' : '清空'}
          </Button>
        </div>

        {models.length === 0 ? (
          <p className="text-xs text-destructive">没有可用模型，请先在设置中启用模型。</p>
        ) : null}

        {hasContext ? (
          <div className="mt-3 rounded-lg border bg-muted/25 p-3">
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
          {regularMessages.length === 0 && !workspaceSession && !streamingResponse ? (
            <div className="rounded-xl border bg-background/75 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Bot className="size-4 text-primary" />
                {editorMode === 'code' && interactionMode === 'agent'
                  ? '开始单文件 Agent 工作区'
                  : '开始一个侧边对话'}
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {editorMode === 'code'
                    ? interactionMode === 'agent'
                      ? 'Agent 会把当前文件当作唯一工作区，先生成草稿，再由你决定是否应用到编辑器。'
                      : 'Plan 只围绕当前文件输出实现方案、风险点、执行顺序和验证步骤。'
                    : '可以像 VS Code 侧栏 AI 一样直接围绕当前文档工作。'}
                </p>
                <div className="grid gap-2">
                  <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2">
                    {editorMode === 'code'
                      ? 'Plan: 先梳理实现思路和验证路径'
                      : '解释当前选中的一段文字'}
                  </div>
                  <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2">
                    {editorMode === 'code'
                      ? 'Agent: 接管当前文件并生成一版 draft'
                      : '按当前语气续写或重写内容'}
                  </div>
                  <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2">
                    {editorMode === 'code'
                      ? 'Apply: 查看 diff、确认应用、自动执行 typecheck'
                      : '让 AI 基于引用给出结构化建议'}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {workspaceSession ? (
            <div className="overflow-hidden rounded-lg border bg-background/95">
              <div className="flex items-start justify-between gap-3 border-b bg-muted/10 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CodeXml className="size-4 text-primary" />
                    <p className="text-sm font-semibold">Agent Workspace</p>
                    <span className="rounded-md border bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {workspaceSession.status === 'generating'
                        ? 'GENERATING'
                        : workspaceSession.status === 'ready'
                          ? 'READY'
                          : workspaceSession.status === 'applied'
                            ? 'APPLIED'
                            : workspaceSession.status === 'failed'
                              ? 'FAILED'
                              : 'IDLE'}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[13px] text-muted-foreground">
                    <span className="uppercase tracking-[0.14em] text-[10px]">File</span>
                    <p className="line-clamp-1 whitespace-pre-wrap text-[13px] text-foreground/90">
                      {selectedNote?.title || '未命名文件'}
                    </p>
                  </div>
                </div>
                <div className="rounded-md border bg-primary/6 p-1.5 text-primary">
                  {workspaceSession.status === 'generating' ||
                  workspaceSession.validation.status === 'running' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                </div>
              </div>

              <div className="border-b bg-muted/4 px-4 py-2.5">
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'request', label: 'Analyze' },
                      { id: 'proposal', label: 'Draft' },
                      { id: 'apply', label: 'Apply' },
                      { id: 'check', label: 'Check' }
                    ] as const
                  ).map((step) => {
                    const stepState = getWorkspaceStepState(workspaceSession, step.id)
                    return (
                      <div
                        key={`workspace-${step.id}`}
                        className="flex items-center gap-1.5 rounded-md border border-transparent bg-background/20 px-2 py-1"
                      >
                        <span
                          className={cn(
                            'size-2 rounded-full',
                            stepState === 'done' && 'bg-primary/80',
                            stepState === 'active' &&
                              'bg-primary shadow-[0_0_0_3px_rgba(59,130,246,0.18)]',
                            stepState === 'pending' && 'bg-muted-foreground/30',
                            stepState === 'error' && 'bg-rose-500'
                          )}
                        />
                        <span
                          className={cn(
                            'text-[11px] font-medium leading-none',
                            stepState === 'pending' ? 'text-muted-foreground' : 'text-foreground'
                          )}
                        >
                          {step.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-0.5 px-4 py-3">
                {workspaceSession.status === 'generating' ? (
                  <BuildEventRow
                    icon={Sparkles}
                    label="Internal Tool"
                    description="Agent 正在读取当前文件并生成草稿。"
                    badge="Running"
                  >
                    {streamingResponse ? (
                      <ScrollArea className="max-h-[180px]" orientation="both">
                        <pre className="rounded-md border bg-background/80 px-3 py-2.5 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-muted-foreground">
                          {streamingResponse}
                        </pre>
                      </ScrollArea>
                    ) : null}
                  </BuildEventRow>
                ) : null}

                {workspaceSession.summaryLines.length ? (
                  <BuildEventRow icon={Sparkles} label="Plan">
                    <div className="space-y-1">
                      {workspaceSession.summaryLines.map((line, summaryIndex) => (
                        <div
                          key={`workspace-summary-${summaryIndex}`}
                          className="flex gap-2 text-[13px] leading-5"
                        >
                          <span className="mt-[7px] size-1 shrink-0 rounded-full bg-primary/60" />
                          <span className="text-foreground/85">{line}</span>
                        </div>
                      ))}
                    </div>
                  </BuildEventRow>
                ) : null}

                {workspaceSession.toolCall ? (
                  <BuildEventRow
                    icon={CodeXml}
                    label="Tool"
                    description={workspaceSession.toolCall.summary || '已生成当前文件的执行方案。'}
                    badge={getToolCallLabel(workspaceSession.toolCall.name)}
                    tone={workspaceSession.actionable ? 'default' : 'muted'}
                  />
                ) : null}

                {workspaceSession.actionable ? (
                  <BuildEventRow
                    icon={Eye}
                    label="Changes"
                    description="Agent 已经把当前文件归一成一版可应用的草稿。"
                    badge="Draft"
                    actions={
                      workspaceSession.diffLines.some((line) => line.type !== 'context') ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() =>
                                setOpenDiffMessageKey((prev) =>
                                  prev === 'workspace' ? null : 'workspace'
                                )
                              }
                            >
                              <Eye className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>{openDiffMessageKey === 'workspace' ? '收起 Diff' : '展开 Diff'}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : null
                    }
                  >
                    {workspaceSession.previewIssue ? (
                      <div className="rounded-md border border-amber-500/20 bg-amber-500/8 px-2.5 py-2 text-[11px] leading-4.5 text-amber-700 dark:text-amber-300">
                        当前草稿生成时有提示：{workspaceSession.previewIssue}
                      </div>
                    ) : null}
                    {openDiffMessageKey === 'workspace' &&
                    workspaceSession.diffLines.some((line) => line.type !== 'context') ? (
                      <ScrollArea className="max-h-[220px]" orientation="both">
                        <div className="font-mono text-[11px] leading-5">
                          {workspaceSession.diffLines.map((line, lineIndex) => (
                            <div
                              key={`workspace-diff-${lineIndex}`}
                              className={cn(
                                'flex min-w-max gap-2 px-2 py-px',
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
                    ) : null}
                  </BuildEventRow>
                ) : null}

                {workspaceSession.actionable ? (
                  <BuildEventRow icon={FilePenLine} label="Execute">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="default"
                            className="size-8"
                            onClick={() => {
                              void handleApplyWorkspaceDraft()
                            }}
                            disabled={!canApplyToCodeEditor}
                          >
                            <FilePenLine className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>应用草稿</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() =>
                              handleCopyMessage(workspaceSession.draftDocument, 'workspace-draft')
                            }
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>复制结果</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={handleDiscardWorkspaceDraft}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>丢弃草稿</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={handleRetryWorkspace}
                            disabled={isLoading}
                          >
                            <RotateCcw className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>重试</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </BuildEventRow>
                ) : null}

                {workspaceSession.status === 'applied' ? (
                  <BuildEventRow
                    icon={BadgeCheck}
                    label="Result"
                    description="草稿已接管当前编辑器内容。"
                    tone="success"
                    badge="Applied"
                  >
                    {workspaceSession.validation.output ? (
                      <ScrollArea className="max-h-[160px]" orientation="both">
                        <pre className="rounded-md border bg-muted/15 px-2.5 py-2 text-[10px] leading-4.5 text-muted-foreground">
                          {workspaceSession.validation.output}
                        </pre>
                      </ScrollArea>
                    ) : null}
                  </BuildEventRow>
                ) : null}

                {!workspaceSession.actionable && workspaceSession.notes ? (
                  <BuildEventRow icon={MessageSquareQuote} label="Reply" tone="muted">
                    <div className="text-[13px] text-muted-foreground">
                      <StreamMarkdown
                        content={workspaceSession.notes}
                        className="prose-p:my-2 prose-p:leading-6 prose-ul:my-2 prose-li:my-0.5 prose-headings:my-2 prose-headings:text-sm"
                      />
                    </div>
                  </BuildEventRow>
                ) : null}

                {workspaceSession.actionable &&
                workspaceSession.notes &&
                workspaceSession.summaryLines.length === 0 ? (
                  <BuildEventRow icon={MessageSquareQuote} label="Notes" tone="muted">
                    <div className="text-[13px] text-muted-foreground">
                      <StreamMarkdown
                        content={workspaceSession.notes}
                        className="prose-p:my-2 prose-p:leading-6 prose-ul:my-2 prose-li:my-0.5 prose-headings:my-2 prose-headings:text-sm"
                      />
                    </div>
                  </BuildEventRow>
                ) : null}

                {workspaceSession.status === 'failed' && workspaceSession.error ? (
                  <BuildEventRow
                    icon={Bug}
                    label="Failure"
                    description="本次 Agent run 未完成。"
                    tone="error"
                  >
                    <pre className="mt-1 rounded-md border bg-muted/20 px-2.5 py-2 text-[10px] leading-4.5 text-muted-foreground">
                      {workspaceSession.error}
                    </pre>
                  </BuildEventRow>
                ) : null}
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
                  <div className="mt-1 self-start rounded-full bg-primary/10 p-1.5 text-primary">
                    <Bot className="size-3.5" />
                  </div>
                ) : null}

                <div
                  className={cn(
                    'max-w-[88%] rounded-xl border px-3 py-2.5 text-sm',
                    isUser
                      ? 'bg-primary text-primary-foreground border-primary/50'
                      : 'bg-background'
                  )}
                >
                  {isUser ? (
                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                  ) : (
                    <>
                      <StreamMarkdown content={message.content} />
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
        {showQuickActions ? (
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
        ) : null}
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
