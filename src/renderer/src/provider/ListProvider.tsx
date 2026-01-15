import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
// import { useFolder } from './FolderProvider' // 暂时禁用文件夹功能

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
export type FilterType = 'all' | 'document' | 'snippet' | 'trash'

// 最近查看记录
export interface RecentViewItem {
    id: string
    title: string
    type: 'document' | 'snippet'
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
    filteredNotes: Note[]  // 过滤后的笔记列表
    isLoading: boolean

    // 当前选中的笔记
    selectedNote: Note | null
    setSelectedNote: (note: Note | null) => void

    // 最近查看
    recentViews: RecentViewItem[]
    clearRecentViews: () => void

    // 操作方法
    loadNotes: () => Promise<void>
    createNote: (params: { title?: string; content?: string; type?: 'document' | 'snippet'; language?: string }) => Promise<Note | null>
    // 更新笔记
    updateNote: (id: string, params: { title?: string; content?: string; language?: string; is_pinned?: number }) => Promise<Note | null>
    // 更新笔记标签（同步到列表）
    updateNoteTags: (id: string, tags: Tag[]) => void
    deleteNote: (id: string) => Promise<boolean>
    restoreNote: (id: string) => Promise<boolean>
}

const ListContext = createContext<ListContextType | null>(null)

export const useList = () => {
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
    const [recentViews, setRecentViews] = useState<RecentViewItem[]>(() => {
        // 从 localStorage 加载最近查看记录
        try {
            const saved = localStorage.getItem('minddock-recent-views')
            return saved ? JSON.parse(saved) : []
        } catch {
            return []
        }
    })
    // const { selectedFolder } = useFolder() // 暂时禁用文件夹功能

    // 去除 HTML 标签的辅助函数
    const stripHtml = (html: string) => {
        return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    }

    // 过滤后的笔记列表
    const filteredNotes = useMemo(() => {
        if (!searchQuery.trim()) {
            return notes
        }
        const query = searchQuery.toLowerCase()
        return notes.filter(note => {
            // 标题匹配
            if (note.title?.toLowerCase().includes(query)) return true
            // 内容匹配（去除 HTML 标签后）
            const plainContent = stripHtml(note.content || '')
            if (plainContent.toLowerCase().includes(query)) return true
            // 标签匹配
            if (note.tags?.some(tag => tag.name.toLowerCase().includes(query))) return true
            return false
        })
    }, [notes, searchQuery])

    // 稳定的 setSelectedNote 引用，避免触发不必要的重渲染
    const setSelectedNote = useCallback((note: Note | null) => {
        setSelectedNoteInternal(note)
        // 更新最近查看记录（废纸篓中的笔记不添加）
        if (note && filterType !== 'trash') {
            setRecentViews(prev => {
                // 移除已存在的记录
                const filtered = prev.filter(item => item.id !== note.id)
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
    }, [filterType])

    // 清空最近查看
    const clearRecentViews = useCallback(() => {
        setRecentViews([])
        localStorage.removeItem('minddock-recent-views')
    }, [])

    // 加载笔记列表
    const loadNotes = useCallback(async () => {
        setIsLoading(true)
        try {
            let result: Note[] = []

            if (filterType === 'trash') {
                // 加载回收站
                result = await window.api.notesGetTrashed()
            } else if (filterType === 'all') {
                // 加载所有笔记
                result = await window.api.notesGetAll(undefined, undefined)
            } else {
                // 加载特定类型的笔记
                result = await window.api.notesGetAll(filterType, undefined)
            }

            // 为每个笔记加载标签
            const notesWithTags = await Promise.all(
                result.map(async (note) => {
                    const tags = await window.api.tagsGetByNoteId(note.id)
                    return { ...note, tags }
                })
            )

            setNotes(notesWithTags)
        } catch (error) {
            console.error('Failed to load notes:', error)
            setNotes([])
        } finally {
            setIsLoading(false)
        }
    }, [filterType])

    // 当筛选类型变化时重新加载
    useEffect(() => {
        loadNotes()
    }, [loadNotes])

    // 创建笔记
    const createNote = useCallback(async (params: { title?: string; content?: string; type?: 'document' | 'snippet'; language?: string }) => {
        try {
            // 不再关联文件夹
            const noteParams = {
                ...params,
                folder_id: null
            }
            const note = await window.api.notesCreate(noteParams)
            // 重新加载列表
            await loadNotes()
            // 自动选中
            setSelectedNote(note)
            return note
        } catch (error) {
            console.error('Failed to create note:', error)
            return null
        }
    }, [loadNotes])

    // 更新笔记
    const updateNote = useCallback(async (id: string, params: { title?: string; content?: string; language?: string; is_pinned?: number }) => {
        try {
            const updated = await window.api.notesUpdate(id, params)
            if (updated) {
                // 为更新后的笔记加载标签
                const tags = await window.api.tagsGetByNoteId(id)
                const updatedWithTags = { ...updated, tags }

                // 更新列表中的数据（不重新加载整个列表，优化性能）
                setNotes(prev => prev.map(n => n.id === id ? updatedWithTags : n))
                // 如果是当前选中的笔记，也更新选中状态
                if (selectedNote?.id === id) {
                    setSelectedNote(updatedWithTags)
                }
            }
            return updated
        } catch (error) {
            console.error('Failed to update note:', error)
            return null
        }
    }, [selectedNote])

    // 更新笔记标签（同步到列表）
    const updateNoteTags = useCallback((id: string, tags: Tag[]) => {
        setNotes(prev => prev.map(n => n.id === id ? { ...n, tags } : n))
        // 如果是当前选中的笔记，也更新选中状态
        if (selectedNote?.id === id) {
            setSelectedNote({ ...selectedNote, tags })
        }
    }, [selectedNote, setSelectedNote])

    // 删除笔记（移到回收站或永久删除）
    const deleteNote = useCallback(async (id: string) => {
        try {
            let success: boolean
            if (filterType === 'trash') {
                // 在回收站中永久删除
                success = await window.api.notesDelete(id)
            } else {
                // 移到回收站
                success = await window.api.notesTrash(id)
            }

            if (success) {
                await loadNotes()
                // 如果删除的是当前选中的笔记，清除选中状态
                if (selectedNote?.id === id) {
                    setSelectedNote(null)
                }
            }
            return success
        } catch (error) {
            console.error('Failed to delete note:', error)
            return false
        }
    }, [filterType, loadNotes, selectedNote])

    // 恢复笔记（从回收站恢复）
    const restoreNote = useCallback(async (id: string) => {
        try {
            const success = await window.api.notesRestore(id)
            if (success) {
                await loadNotes()
            }
            return success
        } catch (error) {
            console.error('Failed to restore note:', error)
            return false
        }
    }, [loadNotes])

    // 将选中状态分离，减少不必要的重渲染
    const stableValue = useMemo(() => ({
        filterType,
        setFilterType,
        searchQuery,
        setSearchQuery,
        notes,
        filteredNotes,
        isLoading,
        setSelectedNote,
        recentViews,
        clearRecentViews,
        loadNotes,
        createNote,
        updateNote,
        updateNoteTags,
        deleteNote,
        restoreNote
    }), [filterType, searchQuery, notes, filteredNotes, isLoading, setSelectedNote, recentViews, clearRecentViews, loadNotes, createNote, updateNote, updateNoteTags, deleteNote, restoreNote])

    const value = useMemo(() => ({
        ...stableValue,
        selectedNote
    }), [stableValue, selectedNote])

    return (
        <ListContext.Provider value={value}>
            {children}
        </ListContext.Provider>
    )
}
