import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Editor } from '@tiptap/react'
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
  Undo2,
  Redo2,
  RemoveFormatting,
  Minus,
  CodeSquare,
  ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ScrollArea from '@renderer/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import LanguageSelector from './LanguageSelector'
import { DEFAULT_LANGUAGES } from './types'

interface EditorToolbarProps {
  editor: Editor
}

const ToolbarButton = ({
  onClick,
  isActive = false,
  children,
  tooltip
}: {
  onClick: () => void
  isActive?: boolean
  children: React.ReactNode
  tooltip?: string
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={cn(
          'p-1.5 rounded hover:bg-accent transition-colors shrink-0',
          isActive ? 'bg-accent text-foreground' : 'text-muted-foreground'
        )}
      >
        {children}
      </button>
    </TooltipTrigger>
    {tooltip && (
      <TooltipContent side="bottom" sideOffset={5}>
        <p>{tooltip}</p>
      </TooltipContent>
    )}
  </Tooltip>
)

const ToolbarDivider = () => <div className="w-px h-5 bg-border mx-1 shrink-0" />

const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor }) => {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const lastSelectionRef = useRef<{ from: number; to: number } | null>(null)
  const [codeBlockLanguage, setCodeBlockLanguage] = useState('plaintext')

  useEffect(() => {
    const updateSelection = () => {
      const { from, to } = editor.state.selection
      lastSelectionRef.current = { from, to }
    }

    updateSelection()
    editor.on('selectionUpdate', updateSelection)
    return () => {
      editor.off('selectionUpdate', updateSelection)
    }
  }, [editor])

  useEffect(() => {
    const updateLanguage = () => {
      const attrs = editor.getAttributes('codeBlock') as { language?: string }
      setCodeBlockLanguage(attrs?.language || 'plaintext')
    }

    updateLanguage()
    editor.on('selectionUpdate', updateLanguage)
    editor.on('transaction', updateLanguage)
    return () => {
      editor.off('selectionUpdate', updateLanguage)
      editor.off('transaction', updateLanguage)
    }
  }, [editor])

  const codeBlockLanguages = useMemo(
    () => [{ id: 'plaintext', name: 'Plain text' }, ...DEFAULT_LANGUAGES],
    []
  )

  const chainWithSelection = () => {
    const chain = editor.chain().focus()
    const selection = lastSelectionRef.current
    if (selection) {
      chain.setTextSelection(selection)
    }
    return chain
  }

  // 处理图片选择
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      editor.chain().focus().setImage({ src: base64 }).run()
    }
    reader.readAsDataURL(file)

    // 清空 input 以便可以重复选择同一文件
    e.target.value = ''
  }

  return (
    <ScrollArea
      orientation="horizontal"
      className="shrink-0 border-b border-border/50 bg-background/80 backdrop-blur-sm"
    >
      <div className="flex items-center gap-0.5 px-4 py-1.5">
        {/* 撤销/重做 */}
        <ToolbarButton onClick={() => chainWithSelection().undo().run()} tooltip="撤销">
          <Undo2 size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => chainWithSelection().redo().run()} tooltip="重做">
          <Redo2 size={16} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 文字格式 */}
        <ToolbarButton
          onClick={() => chainWithSelection().toggleBold().run()}
          isActive={editor.isActive('bold')}
          tooltip="加粗"
        >
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => chainWithSelection().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          tooltip="斜体"
        >
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => chainWithSelection().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          tooltip="删除线"
        >
          <Strikethrough size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => chainWithSelection().toggleCode().run()}
          isActive={editor.isActive('code')}
          tooltip="行内代码"
        >
          <Code size={16} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 标题 */}
        <ToolbarButton
          onClick={() => chainWithSelection().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          tooltip="标题 1"
        >
          <Heading1 size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => chainWithSelection().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          tooltip="标题 2"
        >
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => chainWithSelection().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          tooltip="标题 3"
        >
          <Heading3 size={16} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 对齐方式 */}
        <ToolbarButton
          onClick={() => chainWithSelection().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          tooltip="左对齐"
        >
          <AlignLeft size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => chainWithSelection().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          tooltip="居中对齐"
        >
          <AlignCenter size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => chainWithSelection().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          tooltip="右对齐"
        >
          <AlignRight size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => chainWithSelection().setTextAlign('justify').run()}
          isActive={editor.isActive({ textAlign: 'justify' })}
          tooltip="两端对齐"
        >
          <AlignJustify size={16} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 列表 */}
        <ToolbarButton
          onClick={() => chainWithSelection().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          tooltip="无序列表"
        >
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => chainWithSelection().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          tooltip="有序列表"
        >
          <ListOrdered size={16} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 其他 */}
        <ToolbarButton
          onClick={() => chainWithSelection().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          tooltip="引用"
        >
          <Quote size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => chainWithSelection().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
          tooltip="代码块"
        >
          <CodeSquare size={16} />
        </ToolbarButton>
        {editor.isActive('codeBlock') && (
          <LanguageSelector
            languages={codeBlockLanguages}
            selectedLanguage={codeBlockLanguage}
            onLanguageChange={(lang) => {
              setCodeBlockLanguage(lang)
              chainWithSelection().updateAttributes('codeBlock', { language: lang }).run()
            }}
            className="ml-1"
          />
        )}
        <ToolbarButton
          onClick={() => chainWithSelection().setHorizontalRule().run()}
          tooltip="分割线"
        >
          <Minus size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => imageInputRef.current?.click()} tooltip="插入图片">
          <ImageIcon size={16} />
        </ToolbarButton>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        <ToolbarDivider />

        {/* 清除格式 */}
        <ToolbarButton
          onClick={() => chainWithSelection().unsetAllMarks().clearNodes().run()}
          tooltip="清除格式"
        >
          <RemoveFormatting size={16} />
        </ToolbarButton>
      </div>
    </ScrollArea>
  )
}

export default EditorToolbar
