import React, { useState, useRef, useEffect } from 'react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Sparkles, Loader2, Copy, Check } from 'lucide-react'

type AIAction =
  | 'improve'
  | 'shorten'
  | 'expand'
  | 'rewrite'
  | 'summarize'
  | 'explain'
  | 'translate'
  | 'fixGrammar'

interface AIActionItem {
  id: AIAction
  label: string
  prompt: string
  icon?: React.ReactNode
}

const AI_ACTIONS: AIActionItem[] = [
  { id: 'improve', label: '优化', prompt: '请优化以下文本，使其更清晰、更专业：' },
  { id: 'shorten', label: '缩短', prompt: '请简化以下文本，保留核心意思：' },
  { id: 'expand', label: '扩写', prompt: '请扩写以下文本，增加更多细节：' },
  { id: 'rewrite', label: '重写', prompt: '请重写以下文本，使用不同的表达方式：' },
  { id: 'summarize', label: '总结', prompt: '请总结以下文本的要点：' },
  { id: 'explain', label: '解释', prompt: '请解释以下文本的含义：' },
  { id: 'translate', label: '翻译', prompt: '请将以下文本翻译成中文：' },
  { id: 'fixGrammar', label: '修复语法', prompt: '请修复以下文本中的语法错误：' }
]

interface AIBubbleMenuProps {
  editor: any
}

export function AIBubbleMenu({ editor }: AIBubbleMenuProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const currentSessionIdRef = useRef<string | null>(null)

  const selectedText = editor?.state.doc.textBetween(
    editor.state.selection.from,
    editor.state.selection.to
  )

  useEffect(() => {
    // 点击外部关闭菜单
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowActions(false)
        setResult('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAIAction = async (action: AIAction) => {
    if (!selectedText || isLoading) return

    const actionItem = AI_ACTIONS.find((a) => a.id === action)
    if (!actionItem) return

    setIsLoading(true)
    setShowActions(false)
    setResult('')

    try {
      // 获取启用的模型
      const models = await window.api.aiGetEnabledModels()
      if (models.length === 0) {
        setResult('错误：没有可用的 AI 模型，请先在设置中配置。')
        setIsLoading(false)
        return
      }

      const selectedModel = models[0].id
      const sessionId = `ai-menu-${Date.now()}`
      currentSessionIdRef.current = sessionId

      // 监听流式响应
      const unsubscribeChunk = window.api.aiOnStreamChunk(sessionId, (chunk: string) => {
        setResult((prev) => prev + chunk)
      })

      window.api.aiOnStreamComplete(sessionId, () => {
        setIsLoading(false)
        currentSessionIdRef.current = null
        unsubscribeChunk?.()
      })

      window.api.aiOnStreamError(sessionId, (error: string) => {
        setResult(`错误：${error}`)
        setIsLoading(false)
        currentSessionIdRef.current = null
        unsubscribeChunk?.()
      })

      // 发送请求
      await window.api.aiStreamCompletion(
        selectedModel,
        [{ role: 'user', content: `${actionItem.prompt}\n\n${selectedText}` }],
        {},
        sessionId
      )
    } catch (error) {
      console.error('AI action failed:', error)
      setResult('错误：请求失败，请重试。')
      setIsLoading(false)
      currentSessionIdRef.current = null
    }
  }

  const handleApplyResult = () => {
    if (!editor || !result) return

    // 替换选中的文本
    editor.chain().focus().deleteSelection().insertContent(result).run()

    // 关闭菜单
    setShowActions(false)
    setResult('')
  }

  const handleCopyResult = () => {
    if (!result) return

    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRetry = () => {
    setResult('')
    setShowActions(true)
  }

  const handleCancel = () => {
    // 取消正在进行的请求（通过设置标记）
    currentSessionIdRef.current = null
    setIsLoading(false)
    setResult('')
    setShowActions(false)
  }

  return (
    <BubbleMenu
      editor={editor}
      updateDelay={0}
      pluginKey="ai-bubble-menu"
      shouldShow={({ from, to }) => {
        // 只有当有选中文本时才显示
        return from !== to
      }}
    >
      {selectedText && (
        <div ref={menuRef} className="bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
        {!showActions && !result && !isLoading && (
          <div className="flex items-center">
            <button
              onClick={() => setShowActions(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>AI</span>
            </button>
          </div>
        )}

        {showActions && !result && !isLoading && (
          <div className="p-1">
            <div className="grid grid-cols-4 gap-0.5">
              {AI_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleAIAction(action.id)}
                  className="px-2 py-1.5 text-xs hover:bg-accent rounded transition-colors text-left"
                  title={action.label}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {(result || isLoading) && (
          <div className="min-w-[300px] max-w-[500px] p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium">AI 结果</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopyResult}
                  className="p-1 hover:bg-accent rounded transition-colors"
                  title="复制"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="min-h-[60px] max-h-[200px] overflow-y-auto rounded bg-muted/50 p-2 text-sm mb-3">
              {isLoading && !result && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI 正在处理...</span>
                </div>
              )}
              {result && (
                <div className="whitespace-pre-wrap break-words">
                  {result}
                  {isLoading && <span className="inline-block w-1 h-4 bg-current animate-pulse ml-0.5" />}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {isLoading ? (
                <button
                  onClick={handleCancel}
                  className="flex-1 px-3 py-1.5 text-sm bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
                >
                  取消
                </button>
              ) : (
                <>
                  <button
                    onClick={handleRetry}
                    className="flex-1 px-3 py-1.5 text-sm border border-border rounded hover:bg-accent transition-colors"
                  >
                    重试
                  </button>
                  <button
                    onClick={handleApplyResult}
                    disabled={!result}
                    className="flex-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    应用
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      )}
    </BubbleMenu>
  )
}
