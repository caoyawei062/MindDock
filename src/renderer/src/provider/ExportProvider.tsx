import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

export interface ExportRecord {
  id: string
  note_id: string
  note_title: string
  file_path: string
  export_type: 'markdown' | 'html' | 'pdf' | 'image' | 'code' | 'docx'
  created_at: string
}

interface ExportContextType {
  exports: ExportRecord[]
  isLoading: boolean
  loadExports: () => Promise<void>
  ensureLoaded: () => Promise<void>
  exportToPDF: (noteId: string) => Promise<ExportRecord | null>
  exportToImage: (noteId: string) => Promise<ExportRecord | null>
  exportToMarkdown: (noteId: string) => Promise<ExportRecord | null>
  exportToDocx: (noteId: string) => Promise<ExportRecord | null>
  exportToCode: (noteId: string) => Promise<ExportRecord | null>
  deleteExport: (id: string) => Promise<boolean>
}

const ExportContext = createContext<ExportContextType | undefined>(undefined)

export const ExportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [exports, setExports] = useState<ExportRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const hasLoadedRef = useRef(false)

  // 加载导出记录（懒加载：首次调用时才从数据库读取）
  const loadExports = useCallback(async () => {
    try {
      setIsLoading(true)
      const exportsData = await window.api.exportsGetAll(10)
      setExports(exportsData)
      hasLoadedRef.current = true
    } catch (error) {
      console.error('Failed to load exports:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 按需加载：如果还没加载过，触发首次加载
  const ensureLoaded = useCallback(async () => {
    if (!hasLoadedRef.current) {
      await loadExports()
    }
  }, [loadExports])

  // 导出笔记到 PDF
  const exportToPDF = useCallback(
    async (noteId: string): Promise<ExportRecord | null> => {
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
    },
    [loadExports]
  )

  // 导出笔记到图片
  const exportToImage = useCallback(
    async (noteId: string): Promise<ExportRecord | null> => {
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
    },
    [loadExports]
  )

  // 导出笔记到 Markdown (主要用于代码片段)
  const exportToMarkdown = useCallback(
    async (noteId: string): Promise<ExportRecord | null> => {
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
    },
    [loadExports]
  )

  const exportToDocx = useCallback(
    async (noteId: string): Promise<ExportRecord | null> => {
      try {
        const result = await window.api.exportDocx(noteId)
        if (result) {
          await loadExports()
          return result
        }
        return null
      } catch (error) {
        console.error('Failed to export note to Word:', error)
        return null
      }
    },
    [loadExports]
  )

  const exportToCode = useCallback(
    async (noteId: string): Promise<ExportRecord | null> => {
      try {
        const result = await window.api.exportCode(noteId)
        if (result) {
          await loadExports()
          return result
        }
        return null
      } catch (error) {
        console.error('Failed to export code snippet:', error)
        return null
      }
    },
    [loadExports]
  )

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

  const value: ExportContextType = {
    exports,
    isLoading,
    loadExports,
    ensureLoaded,
    exportToPDF,
    exportToImage,
    exportToMarkdown,
    exportToDocx,
    exportToCode,
    deleteExport
  }

  return <ExportContext.Provider value={value}>{children}</ExportContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useExport = (): ExportContextType => {
  const context = useContext(ExportContext)
  if (!context) {
    throw new Error('useExport must be used within ExportProvider')
  }
  return context
}
