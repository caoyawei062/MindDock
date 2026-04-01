import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react'
import { Editor } from '@tiptap/react'
import { EditorView as CodeMirrorEditorView } from '@codemirror/view'
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

  // 工具栏
  toolbarOpen: boolean
  toggleToolbar: () => void

  // AI 面板
  aiPanelOpen: boolean
  setAiPanelOpen: (open: boolean) => void
  toggleAiPanel: () => void
  setAIInputText: (text: string) => void
  getAIInputText: () => string
  clearAIInputText: () => void
  setAIContextText: (text: string) => void
  getAIContextText: () => string
  clearAIContextText: () => void
  setCodeSelectionText: (text: string) => void
  getCodeSelectionText: () => string
  clearCodeSelectionText: () => void
  setCodeEditorView: (view: CodeMirrorEditorView | null) => void
  getCodeEditorView: () => CodeMirrorEditorView | null
}

const EditorContext = createContext<EditorContextType | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useEditorContext(): EditorContextType {
  const context = useContext(EditorContext)
  if (!context) {
    throw new Error('useEditorContext must be used within EditorProvider')
  }
  return context
}

interface EditorProviderProps {
  children: ReactNode
}

export function EditorProvider({ children }: EditorProviderProps): React.JSX.Element {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [outlineItems, setOutlineItems] = useState<OutlineItem[]>([])
  const [toolbarOpen, setToolbarOpen] = useState(true)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [aiInputText, setAIInputTextState] = useState('')
  const [aiContextText, setAIContextTextState] = useState('')
  const [codeSelectionText, setCodeSelectionTextState] = useState('')
  const [codeEditorView, setCodeEditorViewState] = useState<CodeMirrorEditorView | null>(null)

  const toggleOutline = useCallback(() => {
    setOutlineOpen((prev) => !prev)
  }, [])

  const toggleToolbar = useCallback(() => {
    setToolbarOpen((prev) => !prev)
  }, [])

  const toggleAiPanel = useCallback(() => {
    setAiPanelOpen((prev) => !prev)
  }, [])

  const setAIInputText = useCallback((text: string) => {
    setAIInputTextState(text)
  }, [])

  const getAIInputText = useCallback(() => {
    return aiInputText
  }, [aiInputText])

  const clearAIInputText = useCallback(() => {
    setAIInputTextState('')
  }, [])

  const setAIContextText = useCallback((text: string) => {
    setAIContextTextState(text)
  }, [])

  const getAIContextText = useCallback(() => {
    return aiContextText
  }, [aiContextText])

  const clearAIContextText = useCallback(() => {
    setAIContextTextState('')
  }, [])

  const setCodeSelectionText = useCallback((text: string) => {
    setCodeSelectionTextState(text)
  }, [])

  const getCodeSelectionText = useCallback(() => {
    return codeSelectionText
  }, [codeSelectionText])

  const clearCodeSelectionText = useCallback(() => {
    setCodeSelectionTextState('')
  }, [])

  const setCodeEditorView = useCallback((view: CodeMirrorEditorView | null) => {
    setCodeEditorViewState(view)
  }, [])

  const getCodeEditorView = useCallback(() => {
    return codeEditorView
  }, [codeEditorView])

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

  const value: EditorContextType = useMemo(
    () => ({
      editor,
      setEditor,
      outlineOpen,
      setOutlineOpen,
      toggleOutline,
      outlineItems,
      updateOutlineItems,
      toolbarOpen,
      toggleToolbar,
      aiPanelOpen,
      setAiPanelOpen,
      toggleAiPanel,
      setAIInputText,
      getAIInputText,
      clearAIInputText,
      setAIContextText,
      getAIContextText,
      clearAIContextText,
      setCodeSelectionText,
      getCodeSelectionText,
      clearCodeSelectionText,
      setCodeEditorView,
      getCodeEditorView
    }),
    [
      editor,
      outlineOpen,
      outlineItems,
      updateOutlineItems,
      toolbarOpen,
      toggleOutline,
      toggleToolbar,
      aiPanelOpen,
      toggleAiPanel,
      setAIInputText,
      getAIInputText,
      clearAIInputText,
      setAIContextText,
      getAIContextText,
      clearAIContextText,
      setCodeSelectionText,
      getCodeSelectionText,
      clearCodeSelectionText,
      setCodeEditorView,
      getCodeEditorView
    ]
  )

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}
