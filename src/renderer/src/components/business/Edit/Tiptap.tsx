import React, { useMemo, useEffect } from 'react'
import { useEditor, EditorContent, EditorContext } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
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
  Heading3
} from 'lucide-react'
import { useEditorContext } from '@renderer/provider/EditorProvider'
import EditorToolbar from './EditorToolbar'

// 创建 lowlight 实例，使用常用语言
const lowlight = createLowlight(common)

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
      })
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-full px-6 py-4'
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
      <div className="flex flex-col h-full">
        {/* 固定工具栏 */}
        {toolbarOpen && <EditorToolbar editor={editor} />}

        <EditorContent editor={editor} className="flex-1 overflow-auto scrollbar-none" />
        <BubbleMenu
          editor={editor}
          updateDelay={150}
          className="flex items-center gap-0.5 px-1 py-1 rounded-lg bg-popover border border-border shadow-lg"
        >
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('bold') ? 'bg-accent text-foreground' : 'text-muted-foreground'
            }`}
          >
            <Bold size={14} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('italic') ? 'bg-accent text-foreground' : 'text-muted-foreground'
            }`}
          >
            <Italic size={14} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('strike') ? 'bg-accent text-foreground' : 'text-muted-foreground'
            }`}
          >
            <Strikethrough size={14} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('code') ? 'bg-accent text-foreground' : 'text-muted-foreground'
            }`}
          >
            <Code size={14} />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('heading', { level: 1 })
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            <Heading1 size={14} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('heading', { level: 2 })
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            <Heading2 size={14} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('heading', { level: 3 })
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            <Heading3 size={14} />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('bulletList') ? 'bg-accent text-foreground' : 'text-muted-foreground'
            }`}
          >
            <List size={14} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('orderedList') ? 'bg-accent text-foreground' : 'text-muted-foreground'
            }`}
          >
            <ListOrdered size={14} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded hover:bg-accent transition-colors ${
              editor.isActive('blockquote') ? 'bg-accent text-foreground' : 'text-muted-foreground'
            }`}
          >
            <Quote size={14} />
          </button>
        </BubbleMenu>
      </div>
    </EditorContext.Provider>
  )
}

export default Tiptap
