import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef
} from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'

// 标签类型定义
export interface Tag {
  id: string
  name: string
  color: string
  created_at: string
}

// 笔记类型定义
export interface Note {
  id: string
  title: string
  content: string
  type: 'document' | 'snippet'
  language: string | null
  folder_id: string | null
  is_pinned: number
  is_trashed: number
  is_favorite: number
  sort_order: number
  word_count: number
  created_at: string
  updated_at: string
  trashed_at: string | null
  tags?: Tag[]
}

// 侧边栏筛选类型
export type FilterType = 'all' | 'document' | 'snippet' | 'favorite' | 'trash'

// 最近查看记录
export interface RecentViewItem {
  id: string
  title: string
  type: 'document' | 'snippet'
}

interface UnsavedChangesGuard {
  hasUnsavedChanges: () => boolean
  saveChanges: () => Promise<void>
}

interface ListContextType {
  // 当前筛选类型
  filterType: FilterType
  setFilterType: (type: FilterType) => void

  // 搜索查询
  searchQuery: string
  setSearchQuery: (query: string) => void

  // 笔记列表
  notes: Note[]
  filteredNotes: Note[] // 过滤后的笔记列表
  isLoading: boolean

  // 当前选中的笔记
  selectedNote: Note | null
  setSelectedNote: (note: Note | null) => void
  registerUnsavedChangesGuard: (guard: UnsavedChangesGuard | null) => void

  // 最近查看
  recentViews: RecentViewItem[]
  clearRecentViews: () => void

  // 操作方法
  loadNotes: () => Promise<void>
  createNote: (params: {
    title?: string
    content?: string
    type?: 'document' | 'snippet'
    language?: string
  }) => Promise<Note | null>
  // 更新笔记
  updateNote: (
    id: string,
    params: {
      title?: string
      content?: string
      language?: string
      is_pinned?: number
      is_favorite?: number
    }
  ) => Promise<Note | null>
  // 更新笔记标签（同步到列表）
  updateNoteTags: (id: string, tags: Tag[]) => void
  deleteNote: (id: string) => Promise<boolean>
  restoreNote: (id: string) => Promise<boolean>
}

const ListContext = createContext<ListContextType | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useList = (): ListContextType => {
  const context = useContext(ListContext)
  if (!context) {
    throw new Error('useList must be used within a ListProvider')
  }
  return context
}

export const ListProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedNote, setSelectedNoteInternal] = useState<Note | null>(null)
  const selectedNoteRef = useRef<Note | null>(null)
  const loadRequestIdRef = useRef(0)
  const [switchConfirmOpen, setSwitchConfirmOpen] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<{ note: Note | null } | null>(null)
  const [recentViews, setRecentViews] = useState<RecentViewItem[]>(() => {
    // 从 localStorage 加载最近查看记录
    try {
      const saved = localStorage.getItem('minddock-recent-views')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const unsavedChangesGuardRef = useRef<UnsavedChangesGuard | null>(null)
  // 去除 HTML 标签的辅助函数
  const stripHtml = (html: string): string => {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim()
  }

  // 搜索结果已经在 loadNotes 中完成，列表层直接消费当前 notes
  const filteredNotes = useMemo(() => notes, [notes])

  const registerUnsavedChangesGuard = useCallback((guard: UnsavedChangesGuard | null) => {
    unsavedChangesGuardRef.current = guard
  }, [])

  const commitSelectedNote = useCallback(
    (note: Note | null) => {
      selectedNoteRef.current = note
      setSelectedNoteInternal(note)
      // 更新最近查看记录（废纸篓中的笔记不添加）
      if (note && filterType !== 'trash') {
        setRecentViews((prev) => {
          // 移除已存在的记录
          const filtered = prev.filter((item) => item.id !== note.id)
          // 添加到最前面，最多保留 10 条
          const newList: RecentViewItem[] = [
            { id: note.id, title: note.title || '无标题', type: note.type },
            ...filtered
          ].slice(0, 10)
          // 保存到 localStorage
          localStorage.setItem('minddock-recent-views', JSON.stringify(newList))
          return newList
        })
      }
    },
    [filterType]
  )

  // 稳定引用 — 通过 ref 读取当前 selectedNote，避免闭包过时
  const setSelectedNote = useCallback(
    (note: Note | null) => {
      const currentId = selectedNoteRef.current?.id ?? null
      const nextId = note?.id ?? null

      if (currentId === nextId) {
        commitSelectedNote(note)
        return
      }

      const guard = unsavedChangesGuardRef.current
      if (guard?.hasUnsavedChanges()) {
        setPendingSelection({ note })
        setSwitchConfirmOpen(true)
        return
      }

      commitSelectedNote(note)
    },
    [commitSelectedNote]
  )

  const closeSwitchConfirm = useCallback(() => {
    setSwitchConfirmOpen(false)
    setPendingSelection(null)
  }, [])

  const handleDiscardAndSwitch = useCallback(() => {
    const target = pendingSelection?.note ?? null
    commitSelectedNote(target)
    closeSwitchConfirm()
  }, [pendingSelection, commitSelectedNote, closeSwitchConfirm])

  const handleSaveAndSwitch = useCallback(async () => {
    const guard = unsavedChangesGuardRef.current
    const target = pendingSelection?.note ?? null

    if (!guard) {
      commitSelectedNote(target)
      closeSwitchConfirm()
      return
    }

    await guard.saveChanges()
    commitSelectedNote(target)
    closeSwitchConfirm()
  }, [pendingSelection, commitSelectedNote, closeSwitchConfirm])

  // 清空最近查看
  const clearRecentViews = useCallback(() => {
    setRecentViews([])
    localStorage.removeItem('minddock-recent-views')
  }, [])

  // 加载笔记列表（批量加载标签，避免 N+1）
  const loadNotes = useCallback(
    async (rawQuery?: string) => {
      const requestId = ++loadRequestIdRef.current
      const query = (rawQuery ?? searchQuery).trim()
      setIsLoading(true)
      try {
        let notesWithTags: Note[]
        const listType =
          filterType === 'document' || filterType === 'snippet' ? filterType : undefined

        if (query) {
          if (filterType === 'trash') {
            const trashedNotes = await window.api.notesGetTrashedWithTags()
            const normalizedQuery = query.toLowerCase()
            notesWithTags = trashedNotes.filter((note) => {
              if (note.title?.toLowerCase().includes(normalizedQuery)) return true

              const plainContent = stripHtml(note.content || '')
              if (plainContent.toLowerCase().includes(normalizedQuery)) return true

              return (
                note.tags?.some((tag) => tag.name.toLowerCase().includes(normalizedQuery)) ?? false
              )
            })
          } else {
            const searchResults = await window.api.notesSearch(query, listType)
            notesWithTags =
              filterType === 'favorite'
                ? searchResults.filter((note) => note.is_favorite === 1)
                : searchResults
          }
        } else if (filterType === 'trash') {
          notesWithTags = await window.api.notesGetTrashedWithTags()
        } else if (filterType === 'favorite') {
          const allNotes = await window.api.notesGetAllWithTags(undefined, undefined)
          notesWithTags = allNotes.filter((note) => note.is_favorite === 1)
        } else if (filterType === 'all') {
          notesWithTags = await window.api.notesGetAllWithTags(undefined, undefined)
        } else {
          notesWithTags = await window.api.notesGetAllWithTags(listType, undefined)
        }

        if (requestId === loadRequestIdRef.current) {
          setNotes(notesWithTags)
        }
      } catch (error) {
        console.error('Failed to load notes:', error)
        if (requestId === loadRequestIdRef.current) {
          setNotes([])
        }
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setIsLoading(false)
        }
      }
    },
    [filterType, searchQuery]
  )

  // 当筛选类型或搜索内容变化时重新加载；搜索走轻量防抖，避免连续触发 FTS
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotes(searchQuery)
    }, 250)

    return () => window.clearTimeout(timer)
  }, [loadNotes, searchQuery])

  // 创建笔记
  const createNote = useCallback(
    async (params: {
      title?: string
      content?: string
      type?: 'document' | 'snippet'
      language?: string
    }) => {
      try {
        // 不再关联文件夹
        const noteParams = {
          ...params,
          folder_id: null
        }
        const note = await window.api.notesCreate(noteParams)
        // 重新加载列表
        await loadNotes(searchQuery)
        // 自动选中
        setSelectedNote(note)
        return note
      } catch (error) {
        console.error('Failed to create note:', error)
        return null
      }
    },
    [loadNotes, searchQuery, setSelectedNote]
  )

  // 更新笔记
  const updateNote = useCallback(
    async (
      id: string,
      params: {
        title?: string
        content?: string
        language?: string
        is_pinned?: number
        is_favorite?: number
      }
    ) => {
      try {
        const updated = await window.api.notesUpdate(id, params)
        if (updated) {
          // 为更新后的笔记加载标签
          const tags = await window.api.tagsGetByNoteId(id)
          const updatedWithTags = { ...updated, tags }

          setNotes((prev) => {
            const next = prev.map((n) => (n.id === id ? updatedWithTags : n))
            return filterType === 'favorite' ? next.filter((n) => n.is_favorite === 1) : next
          })
          if (selectedNoteRef.current?.id === id) {
            commitSelectedNote(updatedWithTags)
          }
        }
        return updated
      } catch (error) {
        console.error('Failed to update note:', error)
        return null
      }
    },
    [commitSelectedNote, filterType]
  )

  // 更新笔记标签（同步到列表）
  const updateNoteTags = useCallback(
    (id: string, tags: Tag[]) => {
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, tags } : n)))
      if (selectedNoteRef.current?.id === id) {
        commitSelectedNote({ ...selectedNoteRef.current, tags })
      }
    },
    [commitSelectedNote]
  )

  // 删除笔记（移到回收站或永久删除）
  const deleteNote = useCallback(
    async (id: string) => {
      try {
        let success: boolean
        if (filterType === 'trash') {
          success = await window.api.notesDelete(id)
        } else {
          success = await window.api.notesTrash(id)
        }

        if (success) {
          await loadNotes(searchQuery)
          if (selectedNoteRef.current?.id === id) {
            commitSelectedNote(null)
          }
        }
        return success
      } catch (error) {
        console.error('Failed to delete note:', error)
        return false
      }
    },
    [filterType, loadNotes, commitSelectedNote, searchQuery]
  )

  // 恢复笔记（从回收站恢复）
  const restoreNote = useCallback(
    async (id: string) => {
      try {
        const success = await window.api.notesRestore(id)
        if (success) {
          await loadNotes(searchQuery)
        }
        return success
      } catch (error) {
        console.error('Failed to restore note:', error)
        return false
      }
    },
    [loadNotes, searchQuery]
  )

  // setSelectedNote/updateNote/deleteNote 等现在通过 ref 读取 selectedNote，
  // 不再依赖 selectedNote 状态，所以 stableValue 真正稳定了
  const stableValue = useMemo(
    () => ({
      filterType,
      setFilterType,
      searchQuery,
      setSearchQuery,
      notes,
      filteredNotes,
      isLoading,
      setSelectedNote,
      registerUnsavedChangesGuard,
      recentViews,
      clearRecentViews,
      loadNotes,
      createNote,
      updateNote,
      updateNoteTags,
      deleteNote,
      restoreNote
    }),
    [
      filterType,
      searchQuery,
      notes,
      filteredNotes,
      isLoading,
      setSelectedNote,
      registerUnsavedChangesGuard,
      recentViews,
      clearRecentViews,
      loadNotes,
      createNote,
      updateNote,
      updateNoteTags,
      deleteNote,
      restoreNote
    ]
  )

  const value = useMemo(
    () => ({
      ...stableValue,
      selectedNote
    }),
    [stableValue, selectedNote]
  )

  return (
    <ListContext.Provider value={value}>
      {children}
      <Dialog
        open={switchConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeSwitchConfirm()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>当前内容尚未保存</DialogTitle>
            <DialogDescription>
              当前笔记有未保存修改。切换文章前，请先选择保存，或放弃本次修改。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeSwitchConfirm}>
              取消
            </Button>
            <Button variant="outline" onClick={handleDiscardAndSwitch}>
              不保存并切换
            </Button>
            <Button
              onClick={() => {
                void handleSaveAndSwitch()
              }}
            >
              保存并切换
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ListContext.Provider>
  )
}
