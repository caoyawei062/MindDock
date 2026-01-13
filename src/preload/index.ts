import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { CHANGETHEME, THEME } from '../constants/index'

interface CodeSnippet {
  id: string
  title: string
  code: string
  language: string
}

// Custom APIs for renderer
const api = {
  changeTheme: (theme: THEME) => {
    ipcRenderer.send(CHANGETHEME, theme)
  },
  // 更新托盘菜单中的代码片段列表
  updateTraySnippets: (snippets: CodeSnippet[]) => {
    ipcRenderer.send('update-snippets', snippets)
  },
  // 监听代码片段复制成功事件
  onSnippetCopied: (callback: (title: string) => void) => {
    ipcRenderer.on('snippet-copied', (_, title) => callback(title))
    return () => ipcRenderer.removeAllListeners('snippet-copied')
  },
  // 托盘窗口专用 API
  onTraySnippets: (callback: (snippets: CodeSnippet[]) => void) => {
    ipcRenderer.on('tray-snippets', (_, snippets) => callback(snippets))
    return () => ipcRenderer.removeAllListeners('tray-snippets')
  },
  copySnippet: (code: string, title: string) => {
    ipcRenderer.send('copy-snippet', code, title)
  },
  closeTrayWindow: () => {
    ipcRenderer.send('close-tray-window')
  },
  openMainWindow: () => {
    ipcRenderer.send('open-main-window')
  },
  quitApp: () => {
    ipcRenderer.send('quit-app')
  },
  // 监听主题变化
  onThemeChanged: (callback: (theme: string) => void) => {
    ipcRenderer.on('theme-changed', (_, theme) => callback(theme))
    return () => ipcRenderer.removeAllListeners('theme-changed')
  },

  // ============ 数据库 API ============

  // 获取所有笔记
  notesGetAll: (type?: 'document' | 'snippet', folderId?: string) => {
    return ipcRenderer.invoke('db:notes:getAll', type, folderId)
  },
  // 根据 ID 获取笔记
  notesGetById: (id: string) => {
    return ipcRenderer.invoke('db:notes:getById', id)
  },
  // 创建笔记
  notesCreate: (params: { title?: string; content?: string; type?: 'document' | 'snippet'; language?: string; folder_id?: string | null }) => {
    return ipcRenderer.invoke('db:notes:create', params)
  },
  // 更新笔记
  notesUpdate: (id: string, params: { title?: string; content?: string; language?: string; is_pinned?: number }) => {
    return ipcRenderer.invoke('db:notes:update', id, params)
  },
  // 移动到回收站
  notesTrash: (id: string) => {
    return ipcRenderer.invoke('db:notes:trash', id)
  },
  // 从回收站恢复
  notesRestore: (id: string) => {
    return ipcRenderer.invoke('db:notes:restore', id)
  },
  // 永久删除
  notesDelete: (id: string) => {
    return ipcRenderer.invoke('db:notes:delete', id)
  },
  // 获取回收站笔记
  notesGetTrashed: () => {
    return ipcRenderer.invoke('db:notes:getTrashed')
  },
  // 搜索笔记
  notesSearch: (query: string, type?: 'document' | 'snippet') => {
    return ipcRenderer.invoke('db:notes:search', query, type)
  },
  // 置顶/取消置顶
  notesTogglePin: (id: string) => {
    return ipcRenderer.invoke('db:notes:togglePin', id)
  },
  // 获取托盘窗口的代码片段
  snippetsGetForTray: () => {
    return ipcRenderer.invoke('db:snippets:getForTray')
  },

  // ============ 文件夹 API ============

  // 获取所有文件夹
  foldersGetAll: () => {
    return ipcRenderer.invoke('db:folders:getAll')
  },
  // 获取文件夹树
  foldersGetTree: () => {
    return ipcRenderer.invoke('db:folders:getTree')
  },
  // 根据 ID 获取文件夹
  foldersGetById: (id: string) => {
    return ipcRenderer.invoke('db:folders:getById', id)
  },
  // 创建文件夹
  foldersCreate: (params: {
    name: string
    parent_id?: string | null
    icon?: string | null
    color?: string | null
    sort_order?: number
  }) => {
    return ipcRenderer.invoke('db:folders:create', params)
  },
  // 更新文件夹
  foldersUpdate: (id: string, params: {
    name?: string
    parent_id?: string | null
    icon?: string | null
    color?: string | null
    sort_order?: number
    is_expanded?: number
  }) => {
    return ipcRenderer.invoke('db:folders:update', id, params)
  },
  // 删除文件夹
  foldersDelete: (id: string) => {
    return ipcRenderer.invoke('db:folders:delete', id)
  },
  // 切换文件夹展开状态
  foldersToggleExpanded: (id: string) => {
    return ipcRenderer.invoke('db:folders:toggleExpanded', id)
  },

  // ============ 导出 API ============

  // 获取所有导出记录
  exportsGetAll: (limit?: number) => {
    return ipcRenderer.invoke('db:exports:getAll', limit)
  },
  // 导出笔记到 PDF
  exportPDF: (noteId: string) => {
    return ipcRenderer.invoke('db:export:pdf', noteId)
  },
  // 导出笔记到图片
  exportImage: (noteId: string) => {
    return ipcRenderer.invoke('db:export:image', noteId)
  },
  // 导出笔记到 Markdown (主要用于代码片段)
  exportMarkdown: (noteId: string) => {
    return ipcRenderer.invoke('db:export:markdown', noteId)
  },
  // 删除导出记录
  exportsDelete: (id: string) => {
    return ipcRenderer.invoke('db:exports:delete', id)
  },
  // 打开文件路径
  openPath: (path: string) => {
    return ipcRenderer.invoke('open-path', path)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
