import { ElectronAPI } from '@electron-toolkit/preload'
import { THEME } from '../constants/index'

interface CodeSnippet {
  id: string
  title: string
  code: string
  language: string
}

// 笔记类型
interface Note {
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
  tags?: Tag[] // 可选的标签数组
}

// 标签类型
interface Tag {
  id: string
  name: string
  color: string
  created_at: string
}

// 托盘代码片段
interface TraySnippet {
  id: string
  title: string
  code: string
  language: string
  updatedAt: string
}

// 文件夹类型
interface Folder {
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

// 导出记录类型
interface ExportRecord {
  id: string
  note_id: string
  note_title: string
  file_path: string
  export_type: 'markdown' | 'html' | 'pdf' | 'image'
  created_at: string
}

interface API {
  changeTheme: (theme: THEME) => void
  updateTraySnippets: (snippets: CodeSnippet[]) => void
  onSnippetCopied: (callback: (title: string) => void) => () => void
  // 托盘窗口专用
  onTraySnippets: (callback: (snippets: CodeSnippet[]) => void) => () => void
  copySnippet: (code: string, title: string) => void
  closeTrayWindow: () => void
  openMainWindow: () => void
  openSettingsWindow: () => void
  quitApp: () => void
  onThemeChanged: (callback: (theme: string) => void) => () => void

  // 数据库 API
  notesGetAll: (type?: 'document' | 'snippet', folderId?: string) => Promise<Note[]>
  notesGetById: (id: string) => Promise<Note | null>
  notesCreate: (params: {
    title?: string
    content?: string
    type?: 'document' | 'snippet'
    language?: string
    folder_id?: string | null
  }) => Promise<Note>
  notesUpdate: (
    id: string,
    params: { title?: string; content?: string; language?: string; is_pinned?: number }
  ) => Promise<Note | null>
  notesTrash: (id: string) => Promise<boolean>
  notesRestore: (id: string) => Promise<boolean>
  notesDelete: (id: string) => Promise<boolean>
  notesGetTrashed: () => Promise<Note[]>
  notesSearch: (query: string, type?: 'document' | 'snippet') => Promise<Note[]>
  notesTogglePin: (id: string) => Promise<Note | null>
  snippetsGetForTray: () => Promise<TraySnippet[]>

  // 文件夹 API (暂时禁用)
  /*
  foldersGetAll: () => Promise<Folder[]>
  foldersGetTree: () => Promise<Folder[]>
  foldersGetById: (id: string) => Promise<Folder | null>
  foldersCreate: (params: {
    name: string
    parent_id?: string | null
    icon?: string | null
    color?: string | null
    sort_order?: number
  }) => Promise<Folder>
  foldersUpdate: (
    id: string,
    params: {
      name?: string
      parent_id?: string | null
      icon?: string | null
      color?: string | null
      sort_order?: number
      is_expanded?: number
    }
  ) => Promise<Folder | null>
  foldersDelete: (id: string) => Promise<boolean>
  foldersToggleExpanded: (id: string) => Promise<Folder | null>
  */

  // 导出 API
  exportsGetAll: (limit?: number) => Promise<ExportRecord[]>
  exportPDF: (noteId: string) => Promise<ExportRecord | null>
  exportImage: (noteId: string) => Promise<ExportRecord | null>
  exportMarkdown: (noteId: string) => Promise<ExportRecord | null>
  exportsDelete: (id: string) => Promise<boolean>
  openPath: (path: string) => Promise<void>

  // 标签 API
  tagsGetAll: () => Promise<Tag[]>
  tagsGetById: (id: string) => Promise<Tag | null>
  tagsCreate: (params: { name: string; color?: string }) => Promise<Tag>
  tagsUpdate: (id: string, params: { name?: string; color?: string }) => Promise<Tag | null>
  tagsDelete: (id: string) => Promise<boolean>
  tagsGetByNoteId: (noteId: string) => Promise<Tag[]>
  tagsAddToNote: (noteId: string, tagId: string) => Promise<void>
  tagsRemoveFromNote: (noteId: string, tagId: string) => Promise<boolean>
  tagsSetNoteTags: (noteId: string, tagIds: string[]) => Promise<void>
  tagsGetNoteIds: (tagId: string) => Promise<string[]>

  // AI API
  aiGetAllModels: () => Promise<any[]>
  aiGetEnabledModels: () => Promise<any[]>
  aiGetModelById: (id: string) => Promise<any>
  aiUpdateModel: (id: string, updates: any) => Promise<any>
  aiToggleModel: (id: string, enabled: boolean) => Promise<any>
  aiGetModelsByProvider: (provider: string) => Promise<any[]>
  aiStreamCompletion: (modelId: string, messages: any[], options: any, sessionId: string) => Promise<any>
  aiOnStreamChunk: (sessionId: string, callback: (chunk: string) => void) => () => void
  aiOnStreamComplete: (sessionId: string, callback: () => void) => () => void
  aiOnStreamError: (sessionId: string, callback: (error: string) => void) => () => void
  aiGenerateCompletion: (modelId: string, messages: any[], options: any) => Promise<any>
  aiTestModel: (modelId: string) => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
