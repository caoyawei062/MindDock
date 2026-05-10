import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { CHANGETHEME, THEME } from '../constants/index'
import type { API } from './index.d'
import type {
  AICompletionOptions,
  AIMessage,
  AIModelConfig,
  AIProvider
} from '../shared/types/ai'

interface CodeSnippet {
  id: string
  title: string
  code: string
  language: string
}

type AppCommand = 'save-current-note' | 'new-document' | 'focus-search'

// Custom APIs for renderer — typed via Window API interface for type safety across IPC boundary
const api: API = {
  changeTheme: (theme: THEME) => {
    ipcRenderer.send(CHANGETHEME, theme)
  },
  // 更新托盘菜单中的代码片段列表
  updateTraySnippets: (snippets: CodeSnippet[]) => {
    ipcRenderer.send('update-snippets', snippets)
  },
  // 监听代码片段复制成功事件
  onSnippetCopied: (callback: (title: string) => void) => {
    const listener = (_event: IpcRendererEvent, title: string): void => callback(title)
    ipcRenderer.on('snippet-copied', listener)
    return () => ipcRenderer.removeListener('snippet-copied', listener)
  },
  // 托盘窗口专用 API
  onTraySnippets: (callback: (snippets: CodeSnippet[]) => void) => {
    const listener = (_event: IpcRendererEvent, snippets: CodeSnippet[]): void => callback(snippets)
    ipcRenderer.on('tray-snippets', listener)
    return () => ipcRenderer.removeListener('tray-snippets', listener)
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
  openSettingsWindow: () => {
    ipcRenderer.send('open-settings-window')
  },
  quitApp: () => {
    ipcRenderer.send('quit-app')
  },
  // 监听主题变化
  onThemeChanged: (callback: (theme: string) => void) => {
    const listener = (_event: IpcRendererEvent, theme: string): void => callback(theme)
    ipcRenderer.on('theme-changed', listener)
    return () => ipcRenderer.removeListener('theme-changed', listener)
  },
  onAppCommand: (callback: (command: AppCommand) => void) => {
    const listener = (_event: IpcRendererEvent, command: AppCommand): void => callback(command)
    ipcRenderer.on('app-command', listener)
    return () => ipcRenderer.removeListener('app-command', listener)
  },

  // ============ 数据库 API ============

  // 获取所有笔记
  notesGetAll: (type?: 'document' | 'snippet', folderId?: string) => {
    return ipcRenderer.invoke('db:notes:getAll', type, folderId)
  },
  // 获取所有笔记（带标签，单次查询）
  notesGetAllWithTags: (type?: 'document' | 'snippet', folderId?: string) => {
    return ipcRenderer.invoke('db:notes:getAllWithTags', type, folderId)
  },
  // 获取回收站笔记（带标签）
  notesGetTrashedWithTags: () => {
    return ipcRenderer.invoke('db:notes:getTrashedWithTags')
  },
  // 根据 ID 获取笔记
  notesGetById: (id: string) => {
    return ipcRenderer.invoke('db:notes:getById', id)
  },
  // 创建笔记
  notesCreate: (params: {
    title?: string
    content?: string
    type?: 'document' | 'snippet'
    language?: string
    folder_id?: string | null
  }) => {
    return ipcRenderer.invoke('db:notes:create', params)
  },
  // 更新笔记
  notesUpdate: (
    id: string,
    params: {
      title?: string
      content?: string
      language?: string
      is_pinned?: number
      is_favorite?: number
    }
  ) => {
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
  // 清空回收站
  notesEmptyTrash: () => {
    return ipcRenderer.invoke('db:notes:emptyTrash')
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
  settingsGet: (key: string) => {
    return ipcRenderer.invoke('db:settings:get', key)
  },
  settingsSet: (key: string, value: string) => {
    return ipcRenderer.invoke('db:settings:set', key, value)
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
  // 导出文档到 Word
  exportDocx: (noteId: string) => {
    return ipcRenderer.invoke('db:export:docx', noteId)
  },
  // 导出代码片段到源代码文件
  exportCode: (noteId: string) => {
    return ipcRenderer.invoke('db:export:code', noteId)
  },
  // 删除导出记录
  exportsDelete: (id: string) => {
    return ipcRenderer.invoke('db:exports:delete', id)
  },
  // 打开文件路径
  openPath: (path: string) => {
    return ipcRenderer.invoke('open-path', path)
  },

  // ============ 标签 API ============

  // 获取所有标签
  tagsGetAll: () => {
    return ipcRenderer.invoke('db:tags:getAll')
  },
  // 根据 ID 获取标签
  tagsGetById: (id: string) => {
    return ipcRenderer.invoke('db:tags:getById', id)
  },
  // 创建标签
  tagsCreate: (params: { name: string; color?: string }) => {
    return ipcRenderer.invoke('db:tags:create', params)
  },
  // 更新标签
  tagsUpdate: (id: string, params: { name?: string; color?: string }) => {
    return ipcRenderer.invoke('db:tags:update', id, params)
  },
  // 删除标签
  tagsDelete: (id: string) => {
    return ipcRenderer.invoke('db:tags:delete', id)
  },
  // 获取笔记的所有标签
  tagsGetByNoteId: (noteId: string) => {
    return ipcRenderer.invoke('db:tags:getByNoteId', noteId)
  },
  // 为笔记添加标签
  tagsAddToNote: (noteId: string, tagId: string) => {
    return ipcRenderer.invoke('db:tags:addToNote', noteId, tagId)
  },
  // 从笔记移除标签
  tagsRemoveFromNote: (noteId: string, tagId: string) => {
    return ipcRenderer.invoke('db:tags:removeFromNote', noteId, tagId)
  },
  // 设置笔记的标签(替换所有标签)
  tagsSetNoteTags: (noteId: string, tagIds: string[]) => {
    return ipcRenderer.invoke('db:tags:setNoteTags', noteId, tagIds)
  },
  // 获取使用该标签的所有笔记 ID
  tagsGetNoteIds: (tagId: string) => {
    return ipcRenderer.invoke('db:tags:getNoteIds', tagId)
  },

  // ============ AI API ============

  // 获取所有模型
  aiGetAllModels: () => {
    return ipcRenderer.invoke('ai:models:getAll')
  },
  // 获取启用的模型
  aiGetEnabledModels: () => {
    return ipcRenderer.invoke('ai:models:getEnabled')
  },
  // 根据 ID 获取模型
  aiGetModelById: (id: string) => {
    return ipcRenderer.invoke('ai:models:getById', id)
  },
  // 更新模型配置
  aiUpdateModel: (id: string, updates: Partial<AIModelConfig>) => {
    return ipcRenderer.invoke('ai:models:update', id, updates)
  },
  // 启用/禁用模型
  aiToggleModel: (id: string, enabled: boolean) => {
    return ipcRenderer.invoke('ai:models:toggle', id, enabled)
  },
  // 根据提供商获取模型
  aiGetModelsByProvider: (provider: AIProvider) => {
    return ipcRenderer.invoke('ai:models:getByProvider', provider)
  },
  // 流式生成文本
  aiStreamCompletion: (
    modelId: string,
    messages: AIMessage[],
    options: Partial<AICompletionOptions>,
    sessionId: string
  ) => {
    return ipcRenderer.invoke('ai:completion:stream', modelId, messages, options, sessionId)
  },
  aiCancelStream: (sessionId: string) => {
    return ipcRenderer.invoke('ai:completion:cancel', sessionId)
  },
  // 监听流式数据
  aiOnStreamChunk: (sessionId: string, callback: (chunk: string) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, chunk: string): void => callback(chunk)
    ipcRenderer.on(`ai:stream:chunk:${sessionId}`, listener)
    return () => ipcRenderer.removeListener(`ai:stream:chunk:${sessionId}`, listener)
  },
  // 监听流式完成
  aiOnStreamComplete: (sessionId: string, callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.once(`ai:stream:complete:${sessionId}`, listener)
    return () => ipcRenderer.removeListener(`ai:stream:complete:${sessionId}`, listener)
  },
  // 监听流式错误
  aiOnStreamError: (sessionId: string, callback: (error: string) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, error: string): void => callback(error)
    ipcRenderer.once(`ai:stream:error:${sessionId}`, listener)
    return () => ipcRenderer.removeListener(`ai:stream:error:${sessionId}`, listener)
  },
  // 一次性生成文本
  aiGenerateCompletion: (
    modelId: string,
    messages: AIMessage[],
    options: Partial<AICompletionOptions>
  ) => {
    return ipcRenderer.invoke('ai:completion:generate', modelId, messages, options)
  },
  // 测试模型连接
  aiTestModel: (modelId: string) => {
    return ipcRenderer.invoke('ai:model:test', modelId)
  },
  runTypecheck: () => {
    return ipcRenderer.invoke('dev:run-typecheck')
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
