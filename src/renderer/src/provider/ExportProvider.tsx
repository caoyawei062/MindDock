import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export interface ExportRecord {
  id: string
  note_id: string
  note_title: string
  file_path: string
  export_type: 'markdown' | 'html' | 'pdf' | 'image'
  created_at: string
}

interface ExportContextType {
  exports: ExportRecord[]
  isLoading: boolean
  loadExports: () => Promise<void>
  exportToPDF: (noteId: string) => Promise<ExportRecord | null>
  exportToImage: (noteId: string) => Promise<ExportRecord | null>
  exportToMarkdown: (noteId: string) => Promise<ExportRecord | null>
  deleteExport: (id: string) => Promise<boolean>
}

const ExportContext = createContext<ExportContextType | undefined>(undefined)

export const ExportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [exports, setExports] = useState<ExportRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // 加载导出记录
  const loadExports = useCallback(async () => {
    try {
      setIsLoading(true)
      const exportsData = await window.api.exportsGetAll(10) // 只加载最近10条
      setExports(exportsData)
    } catch (error) {
      console.error('Failed to load exports:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 导出笔记到 PDF
  const exportToPDF = useCallback(async (noteId: string): Promise<ExportRecord | null> => {
    try {
      const result = await window.api.exportPDF(noteId)
      if (result) {
        // 刷新导出列表
        await loadExports()
        return result
      }
      return null
    } catch (error) {
      console.error('Failed to export note:', error)
      return null
    }
  }, [loadExports])

  // 导出笔记到图片
  const exportToImage = useCallback(async (noteId: string): Promise<ExportRecord | null> => {
    try {
      const result = await window.api.exportImage(noteId)
      if (result) {
        // 刷新导出列表
        await loadExports()
        return result
      }
      return null
    } catch (error) {
      console.error('Failed to export note:', error)
      return null
    }
  }, [loadExports])

  // 导出笔记到 Markdown (主要用于代码片段)
  const exportToMarkdown = useCallback(async (noteId: string): Promise<ExportRecord | null> => {
    try {
      const result = await window.api.exportMarkdown(noteId)
      if (result) {
        // 刷新导出列表
        await loadExports()
        return result
      }
      return null
    } catch (error) {
      console.error('Failed to export note:', error)
      return null
    }
  }, [loadExports])

  // 删除导出记录
  const deleteExport = useCallback(async (id: string): Promise<boolean> => {
    try {
      const success = await window.api.exportsDelete(id)
      if (success) {
        // 从列表中移除
        setExports((prev) => prev.filter((exp) => exp.id !== id))
      }
      return success
    } catch (error) {
      console.error('Failed to delete export:', error)
      return false
    }
  }, [])

  // 初始化时加载导出记录
  useEffect(() => {
    loadExports()
  }, [loadExports])

  const value: ExportContextType = {
    exports,
    isLoading,
    loadExports,
    exportToPDF,
    exportToImage,
    exportToMarkdown,
    deleteExport
  }

  return <ExportContext.Provider value={value}>{children}</ExportContext.Provider>
}

export const useExport = () => {
  const context = useContext(ExportContext)
  if (!context) {
    throw new Error('useExport must be used within ExportProvider')
  }
  return context
}
