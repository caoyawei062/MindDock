import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Editor } from '@tiptap/react'
import { debounce } from 'lodash-es'
import { useList, Note } from '@renderer/provider/ListProvider'
import {
  EditorMode,
  CodeMirrorConfig,
  DEFAULT_CODEMIRROR_CONFIG,
  DEFAULT_LANGUAGES
} from '@renderer/components/business/Edit/types'
import { type TagItem } from '@renderer/components/business/Edit/TagInputDropdown'

interface UseNoteEditorOptions {
  editor: Editor | null
}

interface UseNoteEditorReturn {
  // 当前笔记
  note: Note | null

  // 标题（本地状态，支持乐观更新）
  title: string
  setTitle: (title: string) => void

  // 编辑器模式
  editorMode: EditorMode
  setEditorMode: (mode: EditorMode) => void

  // 代码编辑器相关
  selectedLanguage: string
  setSelectedLanguage: (lang: string) => void
  codeContent: string
  setCodeContent: (content: string) => void
  codeMirrorConfig: CodeMirrorConfig
  setCodeMirrorConfig: (config: CodeMirrorConfig) => void

  // 标签
  tags: TagItem[]
  setTags: (tags: TagItem[]) => void

  // 状态
  isDirty: boolean
}

export function useNoteEditor({ editor }: UseNoteEditorOptions): UseNoteEditorReturn {
  const { selectedNote, updateNote } = useList()

  // 本地状态（乐观更新）
  const [title, setTitleInternal] = useState('')
  const [editorMode, setEditorMode] = useState<EditorMode>('word')
  const [selectedLanguage, setSelectedLanguageInternal] = useState(DEFAULT_LANGUAGES[0].id)
  const [codeContent, setCodeContentInternal] = useState('')
  const [codeMirrorConfig, setCodeMirrorConfig] =
    useState<CodeMirrorConfig>(DEFAULT_CODEMIRROR_CONFIG)
  const [tags, setTags] = useState<TagItem[]>([])
  const [isDirty, setIsDirty] = useState(false)

  // 用于追踪当前笔记，避免保存到错误的笔记
  const currentNoteIdRef = useRef<string | null>(null)
  // 标记是否正在初始化（避免初始化时触发保存）
  const isInitializingRef = useRef(false)

  // 创建防抖保存函数
  const debouncedSave = useMemo(
    () =>
      debounce(
        (
          noteId: string,
          params: { title?: string; content?: string; language?: string; is_pinned?: number }
        ) => {
          // 确保保存到正确的笔记
          if (noteId === currentNoteIdRef.current) {
            updateNote(noteId, params)
            setIsDirty(false)
          }
        },
        1000
      ),
    [updateNote]
  )

  // 当选中笔记变化时，重置本地状态
  useEffect(() => {
    if (selectedNote && selectedNote.id !== currentNoteIdRef.current) {
      isInitializingRef.current = true
      currentNoteIdRef.current = selectedNote.id

      // 设置标题
      setTitleInternal(selectedNote.title || '无标题')

      // 根据类型设置编辑模式和内容
      if (selectedNote.type === 'document') {
        setEditorMode('word')
        // Tiptap 内容由 editor 实例管理，稍后设置
      } else {
        setEditorMode('code')
        setSelectedLanguageInternal(selectedNote.language || 'javascript')
        setCodeContentInternal(selectedNote.content || '')
      }

      setIsDirty(false)

      // 延迟重置初始化标记，确保状态更新完成
      requestAnimationFrame(() => {
        isInitializingRef.current = false
      })
    } else if (!selectedNote) {
      currentNoteIdRef.current = null
      setTitleInternal('未命名文档')
      setEditorMode('word')
      setCodeContentInternal('')
      setIsDirty(false)
    }
  }, [selectedNote?.id])

  // 当选中笔记变化且 editor 就绪时，设置 Tiptap 内容
  useEffect(() => {
    if (selectedNote && editor && selectedNote.type === 'document') {
      // 只在笔记切换时设置内容
      if (currentNoteIdRef.current === selectedNote.id) {
        editor.commands.setContent(selectedNote.content || '')
      }
    }
  }, [selectedNote?.id, editor])

  // 监听 Tiptap 内容变化，自动保存
  useEffect(() => {
    if (!editor || !selectedNote || selectedNote.type !== 'document') return

    const handleUpdate = () => {
      if (isInitializingRef.current) return
      if (selectedNote.id !== currentNoteIdRef.current) return

      setIsDirty(true)
      debouncedSave(selectedNote.id, { content: editor.getHTML() })
    }

    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, selectedNote?.id, selectedNote?.type, debouncedSave])

  // 设置标题（带自动保存）
  const setTitle = useCallback(
    (newTitle: string) => {
      setTitleInternal(newTitle)

      if (isInitializingRef.current) return
      if (!currentNoteIdRef.current) return

      setIsDirty(true)
      debouncedSave(currentNoteIdRef.current, { title: newTitle })
    },
    [debouncedSave]
  )

  // 设置代码语言（带自动保存）
  const setSelectedLanguage = useCallback(
    (lang: string) => {
      setSelectedLanguageInternal(lang)

      if (isInitializingRef.current) return
      if (!currentNoteIdRef.current) return

      setIsDirty(true)
      debouncedSave(currentNoteIdRef.current, { language: lang })
    },
    [debouncedSave]
  )

  // 设置代码内容（带自动保存）
  const setCodeContent = useCallback(
    (content: string) => {
      setCodeContentInternal(content)

      if (isInitializingRef.current) return
      if (!currentNoteIdRef.current) return

      setIsDirty(true)
      debouncedSave(currentNoteIdRef.current, { content })
    },
    [debouncedSave]
  )

  return {
    note: selectedNote,
    title,
    setTitle,
    editorMode,
    setEditorMode,
    selectedLanguage,
    setSelectedLanguage,
    codeContent,
    setCodeContent,
    codeMirrorConfig,
    setCodeMirrorConfig,
    tags,
    setTags,
    isDirty
  }
}
