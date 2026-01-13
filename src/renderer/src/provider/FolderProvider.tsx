import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'

// 文件夹类型定义
export interface Folder {
  id: string
  name: string
  parent_id: string | null
  icon: string | null
  color: string | null
  sort_order: number
  is_expanded: number
  created_at: string
  updated_at: string
  children?: Folder[]
}

interface FolderContextType {
  // 文件夹列表（树形结构）
  folders: Folder[]
  isLoading: boolean

  // 当前选中的文件夹
  selectedFolder: Folder | null
  setSelectedFolder: (folder: Folder | null) => void

  // 操作方法
  loadFolders: () => Promise<void>
  createFolder: (params: { name: string; parent_id?: string | null }) => Promise<Folder | null>
  updateFolder: (id: string, params: { name?: string; color?: string }) => Promise<Folder | null>
  deleteFolder: (id: string) => Promise<boolean>
  toggleExpanded: (id: string) => Promise<Folder | null>
}

const FolderContext = createContext<FolderContextType | null>(null)

export const useFolder = () => {
  const context = useContext(FolderContext)
  if (!context) {
    throw new Error('useFolder must be used within a FolderProvider')
  }
  return context
}

export const FolderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [folders, setFolders] = useState<Folder[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFolder, setSelectedFolderInternal] = useState<Folder | null>(null)

  // 稳定的 setSelectedNote 引用，避免触发不必要的重渲染
  const setSelectedFolder = useCallback((folder: Folder | null) => {
    setSelectedFolderInternal(folder)
  }, [])

  // 加载文件夹列表
  const loadFolders = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await window.api.foldersGetTree()
      setFolders(result)
    } catch (error) {
      console.error('Failed to load folders:', error)
      setFolders([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 初始化时加载文件夹
  useEffect(() => {
    loadFolders()
  }, [loadFolders])

  // 创建文件夹
  const createFolder = useCallback(async (params: { name: string; parent_id?: string | null }) => {
    try {
      const folder = await window.api.foldersCreate(params)
      // 重新加载列表
      await loadFolders()
      return folder
    } catch (error) {
      console.error('Failed to create folder:', error)
      return null
    }
  }, [loadFolders])

  // 更新文件夹
  const updateFolder = useCallback(async (id: string, params: { name?: string; color?: string }) => {
    try {
      const updated = await window.api.foldersUpdate(id, params)
      if (updated) {
        // 更新列表中的数据
        const updateInTree = (folders: Folder[]): Folder[] => {
          return folders.map(folder => {
            if (folder.id === id) {
              return { ...folder, ...updated }
            }
            if (folder.children) {
              return { ...folder, children: updateInTree(folder.children) }
            }
            return folder
          })
        }
        setFolders(updateInTree)

        // 如果是当前选中的文件夹，也更新选中状态
        if (selectedFolder?.id === id) {
          setSelectedFolder({ ...selectedFolder, ...updated })
        }
      }
      return updated
    } catch (error) {
      console.error('Failed to update folder:', error)
      return null
    }
  }, [selectedFolder, setSelectedFolder])

  // 删除文件夹
  const deleteFolder = useCallback(async (id: string) => {
    try {
      const success = await window.api.foldersDelete(id)
      if (success) {
        await loadFolders()
        // 如果删除的是当前选中的文件夹，清除选中状态
        if (selectedFolder?.id === id) {
          setSelectedFolder(null)
        }
      }
      return success
    } catch (error) {
      console.error('Failed to delete folder:', error)
      return false
    }
  }, [loadFolders, selectedFolder, setSelectedFolder])

  // 切换展开状态
  const toggleExpanded = useCallback(async (id: string) => {
    try {
      const updated = await window.api.foldersToggleExpanded(id)
      if (updated) {
        // 更新列表中的数据
        const updateInTree = (folders: Folder[]): Folder[] => {
          return folders.map(folder => {
            if (folder.id === id) {
              return { ...folder, ...updated }
            }
            if (folder.children) {
              return { ...folder, children: updateInTree(folder.children) }
            }
            return folder
          })
        }
        setFolders(updateInTree)
      }
      return updated
    } catch (error) {
      console.error('Failed to toggle folder expanded:', error)
      return null
    }
  }, [])

  // 将选中状态分离，减少不必要的重渲染
  const stableValue = useMemo(() => ({
    folders,
    isLoading,
    setSelectedFolder,
    loadFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    toggleExpanded
  }), [folders, isLoading, setSelectedFolder, loadFolders, createFolder, updateFolder, deleteFolder, toggleExpanded])

  const value = useMemo(() => ({
    ...stableValue,
    selectedFolder
  }), [stableValue, selectedFolder])

  return (
    <FolderContext.Provider value={value}>
      {children}
    </FolderContext.Provider>
  )
}
