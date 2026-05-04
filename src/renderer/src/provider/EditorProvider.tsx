import { createContext, useContext, useState, useCallback, useRef, ReactNode, useMemo } from 'react'
import { Editor } from '@tiptap/react'
import { EditorView as CodeMirrorEditorView } from '@codemirror/view'
import { OutlineItem } from '../components/business/Edit/OutlineView'

// ============ Editor Core Context ============

interface EditorCoreContextType {
  editor: Editor | null
  setEditor: (editor: Editor | null) => void
  toolbarOpen: boolean
  toggleToolbar: () => void
}

const EditorCoreContext = createContext<EditorCoreContextType | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useEditorCore(): EditorCoreContextType {
  const ctx = useContext(EditorCoreContext)
  if (!ctx) throw new Error('useEditorCore must be used within EditorProvider')
  return ctx
}

// ============ Outline Context ============

interface OutlineContextType {
  outlineOpen: boolean
  setOutlineOpen: (open: boolean) => void
  toggleOutline: () => void
  outlineItems: OutlineItem[]
  updateOutlineItems: () => void
}

const OutlineContext = createContext<OutlineContextType | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useOutline(): OutlineContextType {
  const ctx = useContext(OutlineContext)
  if (!ctx) throw new Error('useOutline must be used within EditorProvider')
  return ctx
}

// ============ AI Panel Context ============

interface AIPanelContextType {
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
  getCodeDocument: () => string
  replaceCodeDocument: (content: string) => void
}

const AIPanelContext = createContext<AIPanelContextType | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useAIPanel(): AIPanelContextType {
  const ctx = useContext(AIPanelContext)
  if (!ctx) throw new Error('useAIPanel must be used within EditorProvider')
  return ctx
}

// ============ Combined facade (backwards-compatible) ============

type EditorContextType = EditorCoreContextType & OutlineContextType & AIPanelContextType

// eslint-disable-next-line react-refresh/only-export-components
export function useEditorContext(): EditorContextType {
  const core = useEditorCore()
  const outline = useOutline()
  const ai = useAIPanel()
  return useMemo(() => ({ ...core, ...outline, ...ai }), [core, outline, ai])
}

// ============ Provider ============

interface EditorProviderProps {
  children: ReactNode
}

export function EditorProvider({ children }: EditorProviderProps): React.JSX.Element {
  // -- Editor core --
  const [editor, setEditor] = useState<Editor | null>(null)
  const [toolbarOpen, setToolbarOpen] = useState(true)

  const toggleToolbar = useCallback(() => {
    setToolbarOpen((prev) => !prev)
  }, [])

  const coreValue = useMemo<EditorCoreContextType>(
    () => ({ editor, setEditor, toolbarOpen, toggleToolbar }),
    [editor, toolbarOpen, toggleToolbar]
  )

  // -- Outline --
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [outlineItems, setOutlineItems] = useState<OutlineItem[]>([])

  const toggleOutline = useCallback(() => {
    setOutlineOpen((prev) => !prev)
  }, [])

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

  const outlineValue = useMemo<OutlineContextType>(
    () => ({ outlineOpen, setOutlineOpen, toggleOutline, outlineItems, updateOutlineItems }),
    [outlineOpen, toggleOutline, outlineItems, updateOutlineItems]
  )

  // -- AI Panel --
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  // 使用 ref 避免 getter 闭包导致 context value 频繁变化
  const aiInputTextRef = useRef('')
  const aiContextTextRef = useRef('')
  const codeSelectionTextRef = useRef('')
  const codeEditorViewRef = useRef<CodeMirrorEditorView | null>(null)

  const toggleAiPanel = useCallback(() => {
    setAiPanelOpen((prev) => !prev)
  }, [])

  const setAIInputText = useCallback((text: string) => {
    aiInputTextRef.current = text
  }, [])
  const getAIInputText = useCallback(() => aiInputTextRef.current, [])
  const clearAIInputText = useCallback(() => {
    aiInputTextRef.current = ''
  }, [])

  const setAIContextText = useCallback((text: string) => {
    aiContextTextRef.current = text
  }, [])
  const getAIContextText = useCallback(() => aiContextTextRef.current, [])
  const clearAIContextText = useCallback(() => {
    aiContextTextRef.current = ''
  }, [])

  const setCodeSelectionText = useCallback((text: string) => {
    codeSelectionTextRef.current = text
  }, [])
  const getCodeSelectionText = useCallback(() => codeSelectionTextRef.current, [])
  const clearCodeSelectionText = useCallback(() => {
    codeSelectionTextRef.current = ''
  }, [])

  const setCodeEditorView = useCallback((view: CodeMirrorEditorView | null) => {
    codeEditorViewRef.current = view
  }, [])
  const getCodeEditorView = useCallback(() => codeEditorViewRef.current, [])

  const getCodeDocument = useCallback((): string => {
    return codeEditorViewRef.current?.state.doc.toString() ?? ''
  }, [])

  const replaceCodeDocument = useCallback((content: string): void => {
    const view = codeEditorViewRef.current
    if (!view) return

    const docLength = view.state.doc.length
    view.dispatch({
      changes: { from: 0, to: docLength, insert: content },
      selection: { anchor: 0 }
    })
    view.focus()
  }, [])

  const aiValue = useMemo<AIPanelContextType>(
    () => ({
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
      getCodeEditorView,
      getCodeDocument,
      replaceCodeDocument
    }),
    [
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
      getCodeEditorView,
      getCodeDocument,
      replaceCodeDocument
    ]
  )

  return (
    <EditorCoreContext.Provider value={coreValue}>
      <OutlineContext.Provider value={outlineValue}>
        <AIPanelContext.Provider value={aiValue}>{children}</AIPanelContext.Provider>
      </OutlineContext.Provider>
    </EditorCoreContext.Provider>
  )
}
