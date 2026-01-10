import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Editor } from '@tiptap/react'
import { OutlineItem } from '../components/business/Edit/OutlineView'

interface EditorContextType {
  // 编辑器实例
  editor: Editor | null
  setEditor: (editor: Editor | null) => void

  // 大纲视图
  outlineOpen: boolean
  setOutlineOpen: (open: boolean) => void
  toggleOutline: () => void

  // 大纲数据
  outlineItems: OutlineItem[]
  updateOutlineItems: () => void

  // 标题
  title: string
  setTitle: (title: string) => void

  // 工具栏
  toolbarOpen: boolean
  toggleToolbar: () => void
}

const EditorContext = createContext<EditorContextType | null>(null)

export function useEditorContext() {
  const context = useContext(EditorContext)
  if (!context) {
    throw new Error('useEditorContext must be used within EditorProvider')
  }
  return context
}

interface EditorProviderProps {
  children: ReactNode
}

export function EditorProvider({ children }: EditorProviderProps) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [outlineItems, setOutlineItems] = useState<OutlineItem[]>([])
  const [title, setTitle] = useState('未命名文档')
  const [toolbarOpen, setToolbarOpen] = useState(true)

  const toggleOutline = useCallback(() => {
    setOutlineOpen((prev) => !prev)
  }, [])

  const toggleToolbar = useCallback(() => {
    setToolbarOpen((prev) => !prev)
  }, [])

  // 从编辑器内容提取大纲
  const updateOutlineItems = useCallback(() => {
    if (!editor) {
      setOutlineItems([])
      return
    }

    const items: OutlineItem[] = []
    const doc = editor.state.doc

    doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const level = node.attrs.level as number
        const text = node.textContent

        // 尝试提取 emoji（如果文本以 emoji 开头）
        const emojiMatch = text.match(/^(\p{Emoji})\s*/u)
        const emoji = emojiMatch ? emojiMatch[1] : undefined
        const titleText = emoji && emojiMatch ? text.replace(emojiMatch[0], '') : text

        items.push({
          id: `heading-${pos}`,
          title: titleText,
          level,
          emoji
        })
      }
    })

    setOutlineItems(items)
  }, [editor])

  const value: EditorContextType = {
    editor,
    setEditor,
    outlineOpen,
    setOutlineOpen,
    toggleOutline,
    outlineItems,
    updateOutlineItems,
    title,
    setTitle,
    toolbarOpen,
    toggleToolbar
  }

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}
