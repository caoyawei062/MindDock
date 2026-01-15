import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'
import { useAIStream } from '@renderer/hooks/useAI'
import { AIMessage, AICompletionOptions } from '@renderer/types/ai'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Loader2, Send, Sparkles } from 'lucide-react'

interface AIAssistantProps {
  className?: string
  onInsert?: (text: string) => void
}

export function AIAssistant({ className, onInsert }: AIAssistantProps) {
  const [models, setModels] = useState<any[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [response, setResponse] = useState('')
  const responseEndRef = useRef<HTMLDivElement>(null)

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
    if (!input.trim() || !selectedModel) return

    const userMessage: AIMessage = {
      role: 'user',
      content: input
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setResponse('')

    const onChunk = (chunk: string) => {
      setResponse((prev) => prev + chunk)
    }

    const onComplete = () => {
      setMessages((prev) => [
        ...prev,
        userMessage,
        { role: 'assistant', content: response }
      ])
    }

    // 使用 useAIStream
    // 这里简化处理，实际需要使用 hook
    try {
      const sessionId = `stream-${Date.now()}`

      const unsubscribeChunk = window.api.aiOnStreamChunk(sessionId, onChunk)
      const unsubscribeComplete = window.api.aiOnStreamComplete(sessionId, onComplete)
      const unsubscribeError = window.api.aiOnStreamError(sessionId, (error) => {
        console.error('Stream error:', error)
        setResponse(`Error: ${error}`)
      })

      await window.api.aiStreamCompletion(
        selectedModel,
        newMessages,
        {},
        sessionId
      )

      return () => {
        unsubscribeChunk()
        unsubscribeComplete()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleClear = () => {
    setMessages([])
    setResponse('')
  }

  const handleInsert = () => {
    if (response && onInsert) {
      onInsert(response)
    }
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h2 className="font-semibold">AI 助手</h2>
        </div>
        <div className="flex items-center gap-2">
          {models.length > 0 && (
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={handleClear}>
            清空
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {response && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg p-3 bg-gray-100 dark:bg-gray-800">
              <p className="whitespace-pre-wrap">{response}</p>
              <div ref={responseEndRef} />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t space-y-2">
        {response && onInsert && (
          <Button variant="outline" size="sm" onClick={handleInsert} className="w-full">
            插入到编辑器
          </Button>
        )}
        <div className="flex gap-2">
          <Textarea
            placeholder="输入消息..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            className="flex-1 min-h-[60px] max-h-[200px]"
          />
          <Button onClick={handleSend} disabled={!input.trim() || !selectedModel}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
