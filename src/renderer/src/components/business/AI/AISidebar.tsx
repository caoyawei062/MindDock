import { useState, useRef, useEffect } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'
import { AIMessage } from '@renderer/types/ai'
import { Send, Sparkles, Loader2 } from 'lucide-react'
import { useEditorContext } from '@renderer/provider/EditorProvider'
import ReactMarkdown from 'react-markdown'

interface AISidebarProps {
  className?: string
}

export function AISidebar({ className }: AISidebarProps) {
  const { editor, getAIInputText, clearAIInputText, aiPanelOpen } = useEditorContext()
  const [models, setModels] = useState<any[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const responseEndRef = useRef<HTMLDivElement>(null)
  const currentResponseRef = useRef('')

  // 监听外部设置的输入
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
    responseEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [response])

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

  const handleSend = async () => {
    if (!input.trim() || !selectedModel || isLoading) return

    const userMessage: AIMessage = {
      role: 'user',
      content: input
    }

    // 先添加用户消息
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setResponse('')
    setIsLoading(true)

    try {
      const sessionId = `stream-${Date.now()}`

      // 设置监听器
      const unsubscribeChunk = window.api.aiOnStreamChunk(sessionId, (chunk: string) => {
        setResponse((prev) => {
          const newResponse = prev + chunk
          currentResponseRef.current = newResponse
          return newResponse
        })
      })

      const unsubscribeComplete = window.api.aiOnStreamComplete(sessionId, () => {
        // 完成时，将当前响应添加到消息列表
        const finalResponse = currentResponseRef.current
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1]
          // 避免重复添加助手消息
          if (lastMessage?.role === 'assistant') {
            return prev
          }
          return [...prev, { role: 'assistant', content: finalResponse }]
        })
        setResponse('')
        currentResponseRef.current = ''
        setIsLoading(false)
      })

      const unsubscribeError = window.api.aiOnStreamError(sessionId, (error: string) => {
        setIsLoading(false)
        setResponse(`Error: ${error}`)
      })

      // 使用当前消息历史（包含刚添加的用户消息）
      const currentMessages = [...messages, userMessage]
      await window.api.aiStreamCompletion(selectedModel, currentMessages, {}, sessionId)

      // 清理监听器
      return () => {
        unsubscribeChunk?.()
        unsubscribeComplete?.()
        unsubscribeError?.()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setIsLoading(false)
      setResponse('')
    }
  }

  const handleClear = () => {
    setMessages([])
    setResponse('')
  }

  const handleInsert = () => {
    if (!editor || !response) return

    // 插入到编辑器
    editor.chain().focus().insertContent(response).run()
  }

  const handleReplace = () => {
    if (!editor || !response) return

    // 替换选中的文本
    editor.chain().focus().insertContent(response).run()
  }

  return (
    <div className={`flex flex-col h-full bg-muted/30 ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h2 className="font-semibold">AI 助手</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClear}>
          清空
        </Button>
      </div>

      {/* 模型选择 */}
      {models.length > 0 && (
        <div className="p-3 border-b">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background"
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !response && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">开始对话...</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-3 text-sm ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-background border'
              }`}
            >
              {message.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              )}
            </div>
          </div>
        ))}

        {response && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg p-3 bg-background border text-sm">
              {isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI 正在思考...</span>
                </div>
              )}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{response}</ReactMarkdown>
              </div>
              <div ref={responseEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      {response && !isLoading && (
        <div className="flex gap-2 p-3 border-t">
          <Button variant="outline" size="sm" onClick={handleInsert} className="flex-1">
            插入
          </Button>
          <Button variant="outline" size="sm" onClick={handleReplace} className="flex-1">
            替换
          </Button>
        </div>
      )}

      {/* 输入框 */}
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Textarea
            placeholder="输入消息... (Enter 发送)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={(e) => {
              setIsComposing(false)
              // 组合输入结束后，手动触发一次更新以获取最终文本
              setInput(e.currentTarget.value)
            }}
            onKeyDown={(e) => {
              // 在中文输入法组合过程中，不处理 Enter 键
              if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
                e.preventDefault()
                handleSend()
              }
            }}
            className="flex-1 min-h-[60px] max-h-[120px] resize-none text-sm"
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={!input.trim() || !selectedModel || isLoading} size="icon">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
