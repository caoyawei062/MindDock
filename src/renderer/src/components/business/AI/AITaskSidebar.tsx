import { useEffect, useMemo, useState } from 'react'
import {
  Bot,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  Loader2,
  NotebookPen,
  RefreshCcw,
  Sparkles,
  Trash2
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import ScrollArea from '@renderer/components/ui/scroll-area'
import { useAIConfig, useAITasks } from '@renderer/hooks/useAI'
import { useEditorContext } from '@renderer/provider/EditorProvider'
import { useList } from '@renderer/provider/ListProvider'
import type { AITaskOutput, AITaskSource, CreateAITaskSourceParams } from '@renderer/types/ai'
import { cn } from '@/lib/utils'

interface AITaskSidebarProps {
  className?: string
  editorMode?: 'word' | 'code'
}

interface StructuredTaskResult {
  summary: string
  findings: string[]
  nextSteps: string[]
  draftNote: { title: string; content: string } | null
  draftSnippet: { title: string; content: string; language?: string } | null
}

function compactText(value: string, maxLength = 28): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return '未命名任务'
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized
}

function taskStatusLabel(status: string): string {
  switch (status) {
    case 'running':
      return '分析中'
    case 'failed':
      return '失败'
    case 'ready':
      return '已完成'
    default:
      return '待运行'
  }
}

function taskStatusColor(status: string): string {
  switch (status) {
    case 'running':
      return 'text-blue-500'
    case 'failed':
      return 'text-destructive'
    case 'ready':
      return 'text-emerald-500'
    default:
      return 'text-muted-foreground'
  }
}

function sourceRoleLabel(role: AITaskSource['role']): string {
  switch (role) {
    case 'primary':
      return '主资料'
    case 'reference':
      return '参考'
    case 'context':
      return '选中内容'
    default:
      return role
  }
}

function stripCodeFence(content: string): string {
  const trimmed = content.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/)
  return fenced ? fenced[1].trim() : trimmed
}

function parseStructuredResult(content: string): StructuredTaskResult {
  const parsed = JSON.parse(stripCodeFence(content)) as StructuredTaskResult
  return {
    summary: parsed.summary || '',
    findings: parsed.findings || [],
    nextSteps: parsed.nextSteps || [],
    draftNote: parsed.draftNote?.content ? parsed.draftNote : null,
    draftSnippet: parsed.draftSnippet?.content ? parsed.draftSnippet : null
  }
}

function formatSourceBlock(sources: AITaskSource[]): string {
  return sources
    .map((source, index) => {
      const header = `${index + 1}. [${source.role}] ${source.label || source.source_type}`
      const snapshot = source.content_snapshot?.trim() || '(empty)'
      return `${header}\n${snapshot}`
    })
    .join('\n\n')
}

function outputLabel(output: AITaskOutput): string {
  switch (output.output_type) {
    case 'findings':
      return '关键发现'
    case 'next_steps':
      return '建议下一步'
    case 'draft_note':
      return '笔记草稿'
    case 'draft_snippet':
      return '代码片段草稿'
    default:
      return output.output_type
  }
}

function renderLineList(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
}

export function AITaskSidebar({
  className,
  editorMode = 'word'
}: AITaskSidebarProps): React.JSX.Element {
  const { selectedNote, loadNotes, setSelectedNote } = useList()
  const { getAIContextText, clearAIContextText, setAIInputText } = useEditorContext()
  const { models, loadEnabledModels } = useAIConfig()
  const {
    tasks,
    loading,
    error,
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
    getTaskSources,
    replaceTaskSources,
    getTaskOutputs,
    replaceTaskOutputs,
    acceptTaskOutput
  } = useAITasks()

  const [selectedModel, setSelectedModel] = useState('')
  const [goalInput, setGoalInput] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [sources, setSources] = useState<AITaskSource[]>([])
  const [outputs, setOutputs] = useState<AITaskOutput[]>([])
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [sourcesExpanded, setSourcesExpanded] = useState(false)

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  )

  useEffect(() => {
    void loadEnabledModels()
  }, [loadEnabledModels])

  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].id)
    }
  }, [models, selectedModel])

  useEffect(() => {
    void loadTasks(selectedNote?.id)
  }, [loadTasks, selectedNote?.id])

  useEffect(() => {
    if (!selectedTaskId && tasks.length > 0) {
      setSelectedTaskId(tasks[0].id)
    }
    if (tasks.length === 0) {
      setSelectedTaskId(null)
      setSources([])
      setOutputs([])
    }
  }, [tasks, selectedTaskId])

  useEffect(() => {
    if (!selectedTaskId) return

    let cancelled = false

    const loadTaskDetails = async (): Promise<void> => {
      const [nextSources, nextOutputs] = await Promise.all([
        getTaskSources(selectedTaskId),
        getTaskOutputs(selectedTaskId)
      ])

      if (cancelled) return
      setSources(nextSources)
      setOutputs(nextOutputs)
    }

    void loadTaskDetails()

    return () => {
      cancelled = true
    }
  }, [selectedTaskId, getTaskOutputs, getTaskSources])

  const handleCreateTask = async (): Promise<void> => {
    if (!selectedNote) return

    const selectionContext = getAIContextText().trim()
    const customGoal = goalInput.trim()
    const goal =
      customGoal ||
      (selectionContext
        ? '基于当前选中内容整理关键信息并建议下一步'
        : '分析当前笔记并给出关键发现与下一步建议')
    const taskTitle = customGoal
      ? compactText(customGoal, 24)
      : selectionContext
        ? compactText(selectionContext.split('\n')[0] || selectionContext, 24)
        : compactText(selectedNote.title || goal, 24)

    const created = await createTask({
      title: taskTitle,
      goal,
      mode: 'one_shot',
      model_id: selectedModel || null,
      note_id: selectedNote.id
    })

    if (!created) return

    const nextSources: CreateAITaskSourceParams[] = [
      {
        source_type: selectedNote.type === 'snippet' ? 'snippet' : 'note',
        source_id: selectedNote.id,
        role: 'primary',
        label: selectedNote.title || '当前笔记',
        content_snapshot: (selectedNote.content || '').slice(0, 12000)
      }
    ]

    if (selectionContext) {
      nextSources.push({
        source_type: 'selection',
        role: 'context',
        label: editorMode === 'code' ? '当前选中代码' : '当前选中文本',
        content_snapshot: selectionContext.slice(0, 4000)
      })
    }

    const savedSources = await replaceTaskSources(created.id, nextSources)
    setSources(savedSources)
    setOutputs([])
    setSelectedTaskId(created.id)
    setGoalInput('')
    clearAIContextText()
    setAIInputText('')
  }

  const handleRunTask = async (): Promise<void> => {
    if (!selectedTask || !selectedModel) return

    setRunning(true)
    setRunError(null)
    await updateTask(selectedTask.id, {
      status: 'running',
      error_message: null,
      model_id: selectedModel,
      last_run_at: new Date().toISOString()
    })

    try {
      const response = await window.api.aiGenerateCompletion(
        selectedModel,
        [
          {
            role: 'system',
            content:
              '你是 MindDock 的 AI 任务助手。' +
              '请围绕用户任务目标和给定资料，输出严格 JSON。' +
              '不要输出解释，不要输出 markdown code fence 之外的额外内容。' +
              'JSON 结构必须是：' +
              '{"summary":"string","findings":["string"],"nextSteps":["string"],' +
              '"draftNote":{"title":"string","content":"string"}|null,' +
              '"draftSnippet":{"title":"string","content":"string","language":"string"}|null}'
          },
          {
            role: 'user',
            content:
              `任务目标：${selectedTask.goal}\n\n` +
              `关联资料：\n${formatSourceBlock(sources)}\n\n` +
              '请返回：关键发现、建议下一步，以及在合适时给出一份可保存的笔记草稿或代码片段草稿。'
          }
        ],
        { temperature: 0.4 }
      )

      if (!response.success || !response.data?.content) {
        throw new Error(response.error || 'Model returned empty result')
      }

      const result = parseStructuredResult(response.data.content)
      const nextOutputs = [
        {
          output_type: 'findings' as const,
          content: result.findings.map((item) => `- ${item}`).join('\n')
        },
        {
          output_type: 'next_steps' as const,
          content: result.nextSteps.map((item) => `- ${item}`).join('\n')
        },
        ...(result.draftNote
          ? [
              {
                output_type: 'draft_note' as const,
                title: result.draftNote.title,
                content: result.draftNote.content
              }
            ]
          : []),
        ...(result.draftSnippet
          ? [
              {
                output_type: 'draft_snippet' as const,
                title: result.draftSnippet.title,
                content: result.draftSnippet.content,
                meta_json: JSON.stringify({ language: result.draftSnippet.language || 'plaintext' })
              }
            ]
          : [])
      ]

      const savedOutputs = await replaceTaskOutputs(selectedTask.id, nextOutputs)
      await updateTask(selectedTask.id, {
        status: 'ready',
        summary: result.summary || null,
        error_message: null,
        model_id: selectedModel,
        last_run_at: new Date().toISOString()
      })
      await loadTasks(selectedNote?.id)
      setOutputs(savedOutputs)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run AI task'
      setRunError(message)
      await updateTask(selectedTask.id, {
        status: 'failed',
        error_message: message,
        model_id: selectedModel,
        last_run_at: new Date().toISOString()
      })
      await loadTasks(selectedNote?.id)
    } finally {
      setRunning(false)
    }
  }

  const handleAcceptOutput = async (
    output: AITaskOutput,
    target: 'new_note' | 'append_current' | 'new_snippet'
  ): Promise<void> => {
    if (!selectedTask) return

    const result = await acceptTaskOutput(
      selectedTask.id,
      output.id,
      target,
      target === 'append_current' ? selectedNote?.id : undefined
    )

    if (!result.success) {
      setRunError(result.error || 'Failed to save output')
      return
    }

    const nextOutputs = await getTaskOutputs(selectedTask.id)
    setOutputs(nextOutputs)

    if (target === 'append_current' && selectedNote?.id) {
      await loadNotes()
      const latest = await window.api.notesGetById(selectedNote.id)
      if (latest) {
        setSelectedNote(latest)
      }
    }
  }

  const handleDeleteTask = async (): Promise<void> => {
    if (!selectedTaskId) return
    const deleted = await deleteTask(selectedTaskId)
    if (!deleted) return
    setSelectedTaskId(null)
    await loadTasks(selectedNote?.id)
  }

  return (
    <div className={cn('flex h-full flex-col bg-background', className)}>
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Bot className="size-4 text-primary" />
            <span className="text-sm font-medium">AI 任务</span>
          </div>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="h-7 w-auto max-w-[140px] gap-1 border-0 bg-muted/50 px-2 text-xs">
              <SelectValue placeholder="模型" />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Input area */}
        <div className="mt-2">
          <Textarea
            value={goalInput}
            onChange={(event) => setGoalInput(event.target.value)}
            placeholder="描述任务目标，留空则自动分析当前内容..."
            className="min-h-[60px] resize-none border-muted-foreground/15 bg-muted/30 text-sm placeholder:text-muted-foreground/50"
          />
          <Button
            onClick={() => void handleCreateTask()}
            disabled={!selectedNote || !selectedModel}
            size="sm"
            className="mt-2 h-8 w-full text-xs"
          >
            <FilePlus2 className="mr-1.5 size-3.5" />
            新建任务
          </Button>
        </div>
      </div>

      {/* Task list */}
      <div className="shrink-0 border-t border-border/40 px-3 py-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
            任务列表
          </span>
          {loading && <Loader2 className="size-3 animate-spin text-muted-foreground/50" />}
        </div>

        {tasks.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground/60">
            暂无任务
          </p>
        ) : (
          <div className="max-h-32 space-y-0.5 overflow-y-auto">
            {tasks.map((task) => (
              <button
                key={task.id}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                  task.id === selectedTaskId
                    ? 'bg-primary/8 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
                onClick={() => setSelectedTaskId(task.id)}
              >
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    task.status === 'ready' && 'bg-emerald-500',
                    task.status === 'running' && 'bg-blue-500',
                    task.status === 'failed' && 'bg-destructive',
                    task.status !== 'ready' &&
                      task.status !== 'running' &&
                      task.status !== 'failed' &&
                      'bg-muted-foreground/40'
                  )}
                />
                <span className="flex-1 truncate text-xs">{task.title}</span>
                <span className={cn('shrink-0 text-[10px]', taskStatusColor(task.status))}>
                  {taskStatusLabel(task.status)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Task detail */}
      <ScrollArea className="flex-1 border-t border-border/40">
        <div className="px-3 py-3">
          {selectedTask ? (
            <div className="space-y-3">
              {/* Task header */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-5">{selectedTask.title}</h3>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => void handleDeleteTask()}
                      className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-destructive"
                      title="删除任务"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                    <button
                      onClick={() => void handleRunTask()}
                      disabled={running || !selectedModel}
                      className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                      title="重新运行"
                    >
                      {running ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCcw className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {selectedTask.goal}
                </p>
                {selectedTask.summary && (
                  <p className="mt-1.5 rounded-md bg-muted/40 px-2 py-1.5 text-xs leading-relaxed text-foreground/80">
                    {selectedTask.summary}
                  </p>
                )}
              </div>

              {/* Error */}
              {(runError || error || selectedTask.error_message) && (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
                  {runError || error || selectedTask.error_message}
                </div>
              )}

              {/* Sources — collapsible */}
              <div>
                <button
                  onClick={() => setSourcesExpanded((prev) => !prev)}
                  className="flex w-full items-center gap-1 text-xs font-medium text-muted-foreground/70 transition-colors hover:text-muted-foreground"
                >
                  {sourcesExpanded ? (
                    <ChevronDown className="size-3" />
                  ) : (
                    <ChevronRight className="size-3" />
                  )}
                  关联资料
                  <span className="ml-1 text-[10px] text-muted-foreground/50">
                    {sources.length}
                  </span>
                </button>
                {sourcesExpanded && (
                  <div className="mt-1.5 space-y-1.5">
                    {sources.map((source) => (
                      <div
                        key={source.id}
                        className="rounded-md bg-muted/30 px-2.5 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium">
                            {source.label || source.source_type}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground/60">
                            {sourceRoleLabel(source.role)}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                          {source.content_snapshot || '无内容'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Run button */}
              <Button
                onClick={() => void handleRunTask()}
                disabled={running || !selectedModel}
                size="sm"
                className="h-8 w-full text-xs"
              >
                {running ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1.5 size-3.5" />
                    运行分析
                  </>
                )}
              </Button>

              {/* Outputs */}
              {outputs.length > 0 && (
                <div className="space-y-2.5">
                  {outputs.map((output) => (
                    <div key={output.id}>
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className="text-xs font-medium">{outputLabel(output)}</span>
                        {output.title && (
                          <span className="text-[11px] text-muted-foreground">
                            · {output.title}
                          </span>
                        )}
                      </div>

                      {output.output_type === 'findings' ||
                      output.output_type === 'next_steps' ? (
                        <ul className="space-y-1">
                          {renderLineList(output.content).map((line, i) => (
                            <li
                              key={i}
                              className="flex gap-2 text-xs leading-relaxed text-foreground/85"
                            >
                              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-primary/60" />
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 px-2.5 py-2 text-xs leading-relaxed">
                          {output.content}
                        </pre>
                      )}

                      {output.output_type === 'draft_note' && (
                        <div className="mt-1.5 flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleAcceptOutput(output, 'new_note')}
                            className="h-7 text-[11px]"
                          >
                            <NotebookPen className="mr-1 size-3" />
                            保存为笔记
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleAcceptOutput(output, 'append_current')}
                            disabled={!selectedNote}
                            className="h-7 text-[11px]"
                          >
                            追加到当前
                          </Button>
                        </div>
                      )}

                      {output.output_type === 'draft_snippet' && (
                        <div className="mt-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleAcceptOutput(output, 'new_snippet')}
                            className="h-7 text-[11px]"
                          >
                            保存为代码片段
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {outputs.length === 0 && selectedTask.status !== 'running' && (
                <p className="py-2 text-center text-xs text-muted-foreground/50">
                  点击"运行分析"生成结果
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground/50">
              <Bot className="size-8 opacity-40" />
              <p className="text-xs">创建任务开始分析</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
