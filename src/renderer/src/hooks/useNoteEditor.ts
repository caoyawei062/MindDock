import { useState, useEffect, useCallback, useRef } from 'react'
import { Editor } from '@tiptap/react'
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
  isSaving: boolean
  saveNote: () => Promise<void>
}

export function useNoteEditor({ editor }: UseNoteEditorOptions): UseNoteEditorReturn {
  const { selectedNote, updateNote, updateNoteTags, registerUnsavedChangesGuard } = useList()

  // 本地状态（乐观更新）
  const [title, setTitleInternal] = useState('')
  const [editorMode, setEditorMode] = useState<EditorMode>('word')
  const [selectedLanguage, setSelectedLanguageInternal] = useState(DEFAULT_LANGUAGES[0].id)
  const [codeContent, setCodeContentInternal] = useState('')
  const [codeMirrorConfig, setCodeMirrorConfig] =
    useState<CodeMirrorConfig>(DEFAULT_CODEMIRROR_CONFIG)
  const [tags, setTagsInternal] = useState<TagItem[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const currentNoteIdRef = useRef<string | null>(null)
  const isInitializingRef = useRef(false)
  const isDirtyRef = useRef(false)
  // Content to apply once the Tiptap editor mounts (code→document switch race)
  const pendingContentRef = useRef<string | null>(null)

  const markDirty = useCallback(() => {
    if (isDirtyRef.current) return
    isDirtyRef.current = true
    setIsDirty(true)
  }, [])

  // 设置标签（同时更新本地状态和列表）
  const setTags = useCallback(
    (newTags: TagItem[]) => {
      setTagsInternal(newTags)
      // 同步到列表
      if (currentNoteIdRef.current) {
        // 转换为 Tag 类型（添加 created_at 字段）
        const tagsForList = newTags.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color || '#6366f1',
          created_at: new Date().toISOString()
        }))
        updateNoteTags(currentNoteIdRef.current, tagsForList)
      }
    },
    [updateNoteTags]
  )

  // 加载笔记标签
  const loadNoteTags = async (noteId: string): Promise<void> => {
    try {
      const noteTags = await window.api.tagsGetByNoteId(noteId)
      const tagItems: TagItem[] = noteTags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color
      }))
      setTagsInternal(tagItems)
    } catch (error) {
      console.error('Failed to load note tags:', error)
      setTagsInternal([])
    }
  }

  // 当选中笔记变化时，重置本地状态并同步编辑器内容
  useEffect(() => {
    if (selectedNote && selectedNote.id !== currentNoteIdRef.current) {
      isInitializingRef.current = true
      currentNoteIdRef.current = selectedNote.id

      setTitleInternal(selectedNote.title || '无标题')

      if (selectedNote.type === 'document') {
        setEditorMode('word')
        if (editor) {
          editor.commands.setContent(selectedNote.content || '', { emitUpdate: false })
          pendingContentRef.current = null
        } else {
          // Tiptap is not mounted yet (switching from code mode); apply once it mounts
          pendingContentRef.current = selectedNote.content || ''
        }
      } else {
        setEditorMode('code')
        setSelectedLanguageInternal(selectedNote.language || 'javascript')
        setCodeContentInternal(selectedNote.content || '')
      }

      loadNoteTags(selectedNote.id)

      isDirtyRef.current = false
      setIsDirty(false)
      setIsSaving(false)

      requestAnimationFrame(() => {
        isInitializingRef.current = false
      })
    } else if (!selectedNote) {
      currentNoteIdRef.current = null
      setTitleInternal('未命名文档')
      setEditorMode('word')
      setCodeContentInternal('')
      setTagsInternal([])
      isDirtyRef.current = false
      setIsDirty(false)
      setIsSaving(false)
    }
  }, [selectedNote, editor])

  // Apply deferred content when Tiptap editor becomes available (code→document switch)
  useEffect(() => {
    if (!editor || pendingContentRef.current === null) return
    editor.commands.setContent(pendingContentRef.current, { emitUpdate: false })
    pendingContentRef.current = null
  }, [editor])

  useEffect(() => {
    if (!editor || !selectedNote || selectedNote.type !== 'document') return

    const handleUpdate = (): void => {
      if (isInitializingRef.current) return
      if (selectedNote.id !== currentNoteIdRef.current) return

      markDirty()
    }

    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, markDirty, selectedNote])

  // 设置标题，仅更新本地状态并标记脏状态
  const setTitle = useCallback((newTitle: string) => {
    setTitleInternal(newTitle)

    if (isInitializingRef.current) return
    if (!currentNoteIdRef.current) return

    markDirty()
  }, [markDirty])

  // 设置代码语言，仅更新本地状态并标记脏状态
  const setSelectedLanguage = useCallback((lang: string) => {
    setSelectedLanguageInternal(lang)

    if (isInitializingRef.current) return
    if (!currentNoteIdRef.current) return

    markDirty()
  }, [markDirty])

  // 设置代码内容，仅更新本地状态并标记脏状态
  const setCodeContent = useCallback((content: string) => {
    setCodeContentInternal(content)

    if (isInitializingRef.current) return
    if (!currentNoteIdRef.current) return

    markDirty()
  }, [markDirty])

  const saveNote = useCallback(async () => {
    if (!selectedNote || !currentNoteIdRef.current || isSaving) return

    const params: { title?: string; content?: string; language?: string } = {
      title: title.trim() || '未命名文档'
    }

    if (selectedNote.type === 'document') {
      params.content = editor?.getHTML() || ''
    } else {
      params.content = codeContent
      params.language = selectedLanguage
    }

    setIsSaving(true)
    try {
      const updated = await updateNote(currentNoteIdRef.current, params)
      if (!updated) {
        throw new Error('Failed to save note')
      }

      if (params.title && params.title !== title) {
        setTitleInternal(params.title)
      }
      isDirtyRef.current = false
      setIsDirty(false)
    } finally {
      setIsSaving(false)
    }
  }, [selectedNote, isSaving, title, editor, codeContent, selectedLanguage, updateNote])

  useEffect(() => {
    if (!selectedNote) {
      registerUnsavedChangesGuard(null)
      return
    }

    registerUnsavedChangesGuard({
      hasUnsavedChanges: () => isDirty,
      saveChanges: saveNote
    })

    return () => {
      registerUnsavedChangesGuard(null)
    }
  }, [selectedNote, isDirty, saveNote, registerUnsavedChangesGuard])

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
    isDirty,
    isSaving,
    saveNote
  }
}
