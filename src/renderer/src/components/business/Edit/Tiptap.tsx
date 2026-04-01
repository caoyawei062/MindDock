import React, { useMemo, useEffect, useState } from 'react'
import { useEditor, EditorContent, EditorContext } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import TextAlign from '@tiptap/extension-text-align'
import { Extension, JSONContent } from '@tiptap/core'
import { common, createLowlight } from 'lowlight'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Sparkles,
  Loader2,
  Copy,
  Check,
  X
} from 'lucide-react'
import { useEditorContext } from '@renderer/provider/EditorProvider'
import ScrollArea from '@renderer/components/ui/scroll-area'
import EditorToolbar from './EditorToolbar'
import { ResizableImage } from './ResizableImage'

// 创建 lowlight 实例，使用常用语言
const lowlight = createLowlight(common)

// AI 操作类型
type AIAction = 'improve' | 'shorten' | 'expand' | 'rewrite' | 'summarize' | 'translate' | 'fixGrammar'

interface AIActionItem {
  id: AIAction
  label: string
  prompt: string
}

const AI_ACTIONS: AIActionItem[] = [
  { id: 'improve', label: '优化', prompt: '在不改变原意的前提下优化表达，使内容更清晰专业。' },
  { id: 'shorten', label: '缩短', prompt: '在保留关键信息的前提下精简文本。' },
  { id: 'expand', label: '扩写', prompt: '在保持主题一致的前提下补充必要细节。' },
  { id: 'rewrite', label: '重写', prompt: '使用不同表达方式重写文本，保持原意不变。' },
  { id: 'summarize', label: '总结', prompt: '提炼文本核心要点并压缩为精炼版本。' },
  { id: 'translate', label: '翻译', prompt: '翻译成中文，保持语义准确和术语一致。' },
  { id: 'fixGrammar', label: '修复语法', prompt: '修复语法和标点问题，保持原有语气和含义。' }
]

// 快速操作（显示在下拉菜单中）
const QUICK_ACTIONS: AIAction[] = ['improve', 'shorten', 'expand', 'rewrite']

function buildAIPrompt(actionPrompt: string, selectedText: string): string {
  return [
    '你是一个文本编辑助手。',
    `任务：${actionPrompt}`,
    '输出规则：',
    '1. 只输出最终结果文本，不要解释、标题、前后缀或额外说明。',
    '2. 不要输出“以下是”“修改后”等引导语。',
    '3. 保留原始段落与换行结构，除非任务本身要求改变。',
    '4. 如果结果是代码，仅输出代码本体，不要使用```代码围栏。',
    '待处理文本：',
    selectedText
  ].join('\n')
}

function buildInlineContent(lines: string[]): JSONContent[] {
  const content: JSONContent[] = []
  lines.forEach((line, index) => {
    if (line.length > 0) {
      content.push({ type: 'text', text: line })
    }
    if (index < lines.length - 1) {
      content.push({ type: 'hardBreak' })
    }
  })
  return content.length > 0 ? content : [{ type: 'text', text: '' }]
}

function parseAIResultToContent(result: string): JSONContent[] {
  const lines = result.replace(/\r\n/g, '\n').split('\n')
  const blocks: JSONContent[] = []
  let index = 0

  const isBlockBoundary = (line: string): boolean => {
    if (!line.trim()) return true
    if (/^```/.test(line)) return true
    if (/^#{1,6}\s+/.test(line)) return true
    if (/^[-*]\s+/.test(line)) return true
    if (/^\d+\.\s+/.test(line)) return true
    return false
  }

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    // fenced code block
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim() || 'plaintext'
      index += 1
      const codeLines: string[] = []
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) {
        index += 1
      }
      blocks.push({
        type: 'codeBlock',
        attrs: { language },
        content: [{ type: 'text', text: codeLines.join('\n') }]
      })
      continue
    }

    // heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        attrs: { level: Math.min(headingMatch[1].length, 6) },
        content: [{ type: 'text', text: headingMatch[2].trim() }]
      })
      index += 1
      continue
    }

    // bullet list
    if (/^[-*]\s+/.test(line)) {
      const items: JSONContent[] = []
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        const itemText = lines[index].replace(/^[-*]\s+/, '').trim()
        items.push({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: itemText }]
            }
          ]
        })
        index += 1
      }
      blocks.push({ type: 'bulletList', content: items })
      continue
    }

    // ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: JSONContent[] = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        const itemText = lines[index].replace(/^\d+\.\s+/, '').trim()
        items.push({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: itemText }]
            }
          ]
        })
        index += 1
      }
      blocks.push({ type: 'orderedList', content: items })
      continue
    }

    // paragraph block
    const paragraphLines: string[] = []
    while (index < lines.length && !isBlockBoundary(lines[index])) {
      paragraphLines.push(lines[index])
      index += 1
    }

    if (paragraphLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        content: buildInlineContent(paragraphLines)
      })
    }
  }

  if (blocks.length === 0) {
    return [{ type: 'paragraph', content: [{ type: 'text', text: result.trim() }] }]
  }

  return blocks
}

// AI 气泡菜单组件
function AIBubbleMenuWrapper({ editor }: { editor: any }) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // 获取选中文本
  const getSelectedText = () => {
    if (!editor) return null
    const { from, to } = editor.state.selection
    if (from === to) return null
    return editor.state.doc.textBetween(from, to)
  }

  const handleAIAction = async (action: AIAction) => {
    const selectedText = getSelectedText()
    if (!selectedText || aiLoading) return

    const actionItem = AI_ACTIONS.find((a) => a.id === action)
    if (!actionItem) return

    setShowDropdown(false)
    setAiLoading(true)
    setAiResult('')

    try {
      const models = await window.api.aiGetEnabledModels()
      if (models.length === 0) {
        setAiResult('错误：没有可用的 AI 模型，请先在设置中配置。')
        setAiLoading(false)
        return
      }

      const selectedModel = models[0].id
      const sessionId = `ai-menu-${Date.now()}`

      const unsubscribeChunk = window.api.aiOnStreamChunk(sessionId, (chunk: string) => {
        setAiResult((prev) => prev + chunk)
      })

      window.api.aiOnStreamComplete(sessionId, () => {
        setAiLoading(false)
        unsubscribeChunk?.()
      })

      window.api.aiOnStreamError(sessionId, (error: string) => {
        setAiResult(`错误：${error}`)
        setAiLoading(false)
        unsubscribeChunk?.()
      })

      await window.api.aiStreamCompletion(
        selectedModel,
        [{ role: 'user', content: buildAIPrompt(actionItem.prompt, selectedText) }],
        {},
        sessionId
      )
    } catch (error) {
      console.error('AI action failed:', error)
      setAiResult('错误：请求失败，请重试。')
      setAiLoading(false)
    }
  }

  const handleApplyResult = () => {
    if (!editor || !aiResult) return
    const structuredContent = parseAIResultToContent(aiResult)
    editor.chain().focus().deleteSelection().insertContent(structuredContent).run()
    setAiResult('')
  }

  const handleCopyResult = () => {
    if (!aiResult) return
    navigator.clipboard.writeText(aiResult)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClose = () => {
    setShowDropdown(false)
    setAiResult('')
    setAiLoading(false)
  }

  const handleRetry = () => {
    setAiResult('')
    setShowDropdown(true)
  }

  // 监听选择变化，关闭下拉菜单
  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      if (showDropdown) {
        setShowDropdown(false)
      }
    }

    editor.on('selectionUpdate', handleSelectionUpdate)
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
    }
  }, [editor, showDropdown])

  return (
    <>
      {/* 格式化气泡菜单 */}
      <BubbleMenu
        editor={editor}
        updateDelay={500}
        pluginKey="format-bubble-menu"
        shouldShow={({ from, to }) => from !== to}
      >
        <div className="flex items-center gap-0.5 px-1 py-1 rounded-lg bg-popover border border-border shadow-lg">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('bold') ? 'bg-accent text-foreground' : 'text-muted-foreground'
            }`}
            title="加粗"
          >
            <Bold size={14} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('italic') ? 'bg-accent text-foreground' : 'text-muted-foreground'
            }`}
            title="斜体"
          >
            <Italic size={14} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('strike') ? 'bg-accent text-foreground' : 'text-muted-foreground'
            }`}
            title="删除线"
          >
            <Strikethrough size={14} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('code') ? 'bg-accent text-foreground' : 'text-muted-foreground'
            }`}
            title="行内代码"
          >
            <Code size={14} />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('heading', { level: 1 }) ? 'bg-accent text-foreground' : 'text-muted-foreground'
            }`}
            title="标题 1"
          >
            <Heading1 size={14} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('heading', { level: 2 }) ? 'bg-accent text-foreground' : 'text-muted-foreground'
            }`}
            title="标题 2"
          >
            <Heading2 size={14} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('heading', { level: 3 }) ? 'bg-accent text-foreground' : 'text-muted-foreground'
            }`}
            title="标题 3"
          >
            <Heading3 size={14} />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('bulletList') ? 'bg-accent text-foreground' : 'text-muted-foreground'
            }`}
            title="无序列表"
          >
            <List size={14} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('orderedList') ? 'bg-accent text-foreground' : 'text-muted-foreground'
            }`}
            title="有序列表"
          >
            <ListOrdered size={14} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('blockquote') ? 'bg-accent text-foreground' : 'text-muted-foreground'
            }`}
            title="引用"
          >
            <Quote size={14} />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          {/* AI 下拉菜单 */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-1.5 rounded hover:bg-accent transition-colors text-purple-600"
              title="AI 助手"
            >
              <Sparkles size={14} />
            </button>

            {/* 快速操作下拉菜单 */}
            {showDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 min-w-[150px]">
                <div className="p-1">
                  {QUICK_ACTIONS.map((actionId) => {
                    const action = AI_ACTIONS.find((a) => a.id === actionId)!
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleAIAction(action.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent rounded transition-colors text-left"
                        title={action.label}
                      >
                        <span className="w-1 h-1 rounded-full bg-purple-600" />
                        <span>{action.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </BubbleMenu>

      {/* AI 结果显示 - 固定在右上角 */}
      {(aiResult || aiLoading) && (
        <div className="fixed top-4 right-4 z-9999 bg-popover border border-border rounded-lg shadow-xl overflow-hidden w-96">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium">AI 助手</span>
              {aiLoading && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  生成中...
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopyResult}
                className="p-1.5 hover:bg-accent rounded transition-colors"
                title="复制结果"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={handleClose}
                className="p-1.5 hover:bg-accent rounded transition-colors"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-3">
            <ScrollArea className="min-h-20 max-h-75 rounded-md border bg-muted/50">
              <div className="p-3 text-sm">
                {aiLoading && !aiResult ? (
                  <div className="flex min-h-20 items-center justify-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                      <span className="text-xs">AI 正在思考...</span>
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words leading-relaxed">
                    {aiResult}
                    {aiLoading && (
                      <span className="inline-block w-0.5 h-4 bg-purple-600 animate-pulse ml-0.5 align-middle" />
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 border-t bg-muted/30">
            {!aiLoading && (
              <>
                <button
                  onClick={handleRetry}
                  className="flex-1 px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-accent transition-colors"
                >
                  重新选择
                </button>
                <button
                  onClick={handleApplyResult}
                  className="flex-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm"
                >
                  应用结果
                </button>
              </>
            )}
            {aiLoading && (
              <button
                onClick={handleClose}
                className="w-full px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-accent transition-colors"
              >
                取消生成
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

const Tiptap: React.FC = () => {
  const { setEditor, updateOutlineItems, toolbarOpen } = useEditorContext()

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false // 禁用默认的 codeBlock，使用 CodeBlockLowlight
      }),
      Placeholder.configure({
        placeholder: '开始编写...'
      }),
      // Tab 键扩展：在编辑器中按 Tab 插入两个空格
      Extension.create({
        name: 'tabHandler',
        addKeyboardShortcuts() {
          return {
            Tab: () => {
              if (editor.isActive('codeBlock')) {
                // 在代码块中，插入两个空格
                return editor.chain().focus().insertContent('  ').run()
              }
              // 在普通文本中，插入两个空格
              return editor.chain().focus().insertContent('  ').run()
            },
            'Shift-Tab': () => {
              // Shift-Tab 不做任何事，防止浏览器默认行为
              return true
            }
          }
        }
      }),
      CodeBlockLowlight.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            language: {
              default: 'plaintext',
              parseHTML: (element) => {
                const codeEl = element.querySelector('code')
                const className = codeEl?.className || ''
                const match = className.match(/language-(\w+)/)
                return match ? match[1] : element.getAttribute('data-language') || 'plaintext'
              },
              renderHTML: () => ({}) // 不在 code 元素上渲染
            }
          }
        },
        renderHTML({ node, HTMLAttributes }) {
          const language = node.attrs.language || 'plaintext'
          return [
            'pre',
            {
              ...HTMLAttributes,
              'data-language': language,
              class: 'not-prose'
            },
            ['code', { class: `language-${language}` }, 0]
          ]
        }
      }).configure({
        lowlight,
        defaultLanguage: 'plaintext'
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      ResizableImage.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-lg max-w-full'
        }
      })
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none w-full focus:outline-none min-h-full px-6 py-4'
      }
    },
    onUpdate: () => {
      updateOutlineItems()
    }
  })

  // 注册编辑器到 context
  useEffect(() => {
    setEditor(editor)
    return () => setEditor(null)
  }, [editor, setEditor])

  // 初始化大纲
  useEffect(() => {
    if (editor) {
      updateOutlineItems()
    }
  }, [editor, updateOutlineItems])

  const providerValue = useMemo(() => ({ editor }), [editor])

  if (!editor) {
    return null
  }

  return (
    <EditorContext.Provider value={providerValue}>
      <div className="flex flex-col h-full min-w-0 overflow-hidden">
        {/* 固定工具栏 */}
        {toolbarOpen && <EditorToolbar editor={editor} />}

        <EditorContent
          editor={editor}
          className="custom-scrollbar flex-1 min-w-0 overflow-y-auto overflow-x-hidden"
        />

        {/* 格式化气泡菜单 - 包含 AI 功能 */}
        <AIBubbleMenuWrapper editor={editor} />
      </div>
    </EditorContext.Provider>
  )
}

export default Tiptap
