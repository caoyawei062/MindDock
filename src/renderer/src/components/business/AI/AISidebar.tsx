import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown, { Components } from 'react-markdown'
import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'
import { AIMessage, AIModelConfig } from '@renderer/types/ai'
import ScrollArea from '@renderer/components/ui/scroll-area'
import { useEditorContext } from '@renderer/provider/EditorProvider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import {
  Bot,
  Check,
  ChevronDown,
  Clipboard,
  Copy,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  UserRound
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AISidebarProps {
  className?: string
}

interface MarkdownCodeProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean
  className?: string
  children?: React.ReactNode
}

function getCodeLanguage(className?: string): string {
  const match = className?.match(/language-([\w-]+)/)
  return match?.[1] || 'text'
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

export function AISidebar({ className }: AISidebarProps) {
  const { editor, getAIInputText, clearAIInputText, aiPanelOpen } = useEditorContext()
  const [models, setModels] = useState<AIModelConfig[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [streamingResponse, setStreamingResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const [copiedMessageKey, setCopiedMessageKey] = useState<string | null>(null)

  const messageEndRef = useRef<HTMLDivElement>(null)
  const currentResponseRef = useRef('')
  const copiedMessageTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const externalInput = getAIInputText()
    if (externalInput) {
      setInput(externalInput)
      clearAIInputText()
    }
  }, [aiPanelOpen, getAIInputText, clearAIInputText])

  useEffect(() => {
    loadModels()
  }, [])

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

  const loadModels = async () => {
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

  const handleSend = async (): Promise<void> => {
    if (!input.trim() || !selectedModel || isLoading) return

    const userMessage: AIMessage = {
      role: 'user',
      content: input.trim()
    }

    const requestMessages = [...messages, userMessage]
    setMessages((prev) => [...prev, userMessage])
    setInput('')
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
          setMessages((prev) => [...prev, { role: 'assistant', content: finalResponse }])
        }
        setStreamingResponse('')
        currentResponseRef.current = ''
        setIsLoading(false)
      })

      unsubscribeError = window.api.aiOnStreamError(sessionId, (error: string) => {
        const errorMessage = `请求失败：${error}`
        setMessages((prev) => [...prev, { role: 'assistant', content: errorMessage }])
        setStreamingResponse('')
        currentResponseRef.current = ''
        setIsLoading(false)
      })

      await window.api.aiStreamCompletion(selectedModel, requestMessages, {}, sessionId)
    } catch (error) {
      console.error('Failed to send message:', error)
      setMessages((prev) => [...prev, { role: 'assistant', content: '请求失败，请稍后重试。' }])
      setStreamingResponse('')
      currentResponseRef.current = ''
      setIsLoading(false)
    } finally {
      unsubscribeChunk?.()
      unsubscribeComplete?.()
      unsubscribeError?.()
    }
  }

  const handleClear = () => {
    setMessages([])
    setStreamingResponse('')
    currentResponseRef.current = ''
  }

  const handleInsert = (content: string) => {
    if (!editor || !content.trim()) return
    editor.chain().focus().insertContent(content).run()
  }

  const handleCopyMessage = async (content: string, key: string) => {
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

  return (
    <div className={cn('flex h-full flex-col bg-muted/20', className)}>
      <div className="border-b bg-background/90 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-1.5">
              <Sparkles className="size-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">AI 助手</h2>
              <p className="text-xs text-muted-foreground">{selectedModelName || '未选择模型'}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <Trash2 className="size-4" />
            清空
          </Button>
        </div>

        {models.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                <span className="truncate">{selectedModelName || '选择模型'}</span>
                <ChevronDown className="size-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56" side="bottom">
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
          <p className="text-xs text-destructive">没有可用模型，请先在设置中启用模型。</p>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {messages.length === 0 && !streamingResponse ? (
            <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed bg-background/70 px-4 text-center">
              <p className="text-sm text-muted-foreground">
                输入问题后回车发送，支持 Markdown 回答和代码块复制。
              </p>
            </div>
          ) : null}

          {messages.map((message, index) => {
            const isUser = message.role === 'user'
            const messageKey = `${message.role}-${index}`

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
                      <div className="mt-3 flex items-center gap-2 border-t pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleCopyMessage(message.content, messageKey)}
                        >
                          {copiedMessageKey === messageKey ? (
                            <>
                              <Check className="size-3.5" />
                              已复制
                            </>
                          ) : (
                            <>
                              <Clipboard className="size-3.5" />
                              复制
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleInsert(message.content)}
                          disabled={!editor}
                        >
                          插入到编辑器
                        </Button>
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

          {streamingResponse || isLoading ? (
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

      <div className="border-t bg-background/95 p-3">
        <div className="flex gap-2">
          <Textarea
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
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
            onClick={handleSend}
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
