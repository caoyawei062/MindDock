import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { useFolder } from './FolderProvider'

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
}

// 侧边栏筛选类型
export type FilterType = 'all' | 'document' | 'snippet' | 'trash'

interface ListContextType {
    // 当前筛选类型
    filterType: FilterType
    setFilterType: (type: FilterType) => void

    // 笔记列表
    notes: Note[]
    isLoading: boolean

    // 当前选中的笔记
    selectedNote: Note | null
    setSelectedNote: (note: Note | null) => void

    // 操作方法
    loadNotes: () => Promise<void>
    createNote: (params: { title?: string; content?: string; type?: 'document' | 'snippet'; language?: string }) => Promise<Note | null>
    // 更新笔记
    updateNote: (id: string, params: { title?: string; content?: string; language?: string; is_pinned?: number }) => Promise<Note | null>
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
    const [notes, setNotes] = useState<Note[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [selectedNote, setSelectedNoteInternal] = useState<Note | null>(null)
    const { selectedFolder } = useFolder()

    // 稳定的 setSelectedNote 引用，避免触发不必要的重渲染
    const setSelectedNote = useCallback((note: Note | null) => {
        setSelectedNoteInternal(note)
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
                // 加载所有笔记，如果选中了文件夹则筛选该文件夹
                result = await window.api.notesGetAll(undefined, selectedFolder?.id)
            } else {
                // 加载特定类型的笔记，如果选中了文件夹则筛选该文件夹
                result = await window.api.notesGetAll(filterType, selectedFolder?.id)
            }

            setNotes(result)
        } catch (error) {
            console.error('Failed to load notes:', error)
            setNotes([])
        } finally {
            setIsLoading(false)
        }
    }, [filterType, selectedFolder?.id])

    // 当筛选类型变化时重新加载
    useEffect(() => {
        loadNotes()
    }, [loadNotes])

    // 创建笔记
    const createNote = useCallback(async (params: { title?: string; content?: string; type?: 'document' | 'snippet'; language?: string }) => {
        try {
            // 如果选中了文件夹，将 folder_id 添加到参数中
            const noteParams = {
                ...params,
                folder_id: selectedFolder?.id || null
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
    }, [loadNotes, selectedFolder?.id])

    // 更新笔记
    const updateNote = useCallback(async (id: string, params: { title?: string; content?: string; language?: string; is_pinned?: number }) => {
        try {
            const updated = await window.api.notesUpdate(id, params)
            if (updated) {
                // 更新列表中的数据（不重新加载整个列表，优化性能）
                setNotes(prev => prev.map(n => n.id === id ? updated : n))
                // 如果是当前选中的笔记，也更新选中状态
                if (selectedNote?.id === id) {
                    setSelectedNote(updated)
                }
            }
            return updated
        } catch (error) {
            console.error('Failed to update note:', error)
            return null
        }
    }, [selectedNote])

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
        notes,
        isLoading,
        setSelectedNote,
        loadNotes,
        createNote,
        updateNote,
        deleteNote,
        restoreNote
    }), [filterType, notes, isLoading, setSelectedNote, loadNotes, createNote, updateNote, deleteNote, restoreNote])

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
