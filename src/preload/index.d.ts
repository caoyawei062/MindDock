import { ElectronAPI } from '@electron-toolkit/preload'
import { THEME } from '../constants/index'
import {
  AICompletionOptions,
  AICompletionResult,
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
  tags?: Tag[]
}

interface Tag {
  id: string
  name: string
  color: string
  created_at: string
}

interface TraySnippet {
  id: string
  title: string
  code: string
  language: string
  updatedAt: string
}

interface ExportRecord {
  id: string
  note_id: string
  note_title: string
  file_path: string
  export_type: 'markdown' | 'html' | 'pdf' | 'image' | 'code' | 'docx'
  created_at: string
}

interface AIStreamResponse {
  success: boolean
  error?: string
}

type AppCommand = 'save-current-note' | 'new-document' | 'new-snippet' | 'focus-search'

interface AIGenerateResponse {
  success: boolean
  data?: AICompletionResult
  error?: string
}

export interface API {
  changeTheme: (theme: THEME) => void
  updateTraySnippets: (snippets: CodeSnippet[]) => void
  onSnippetCopied: (callback: (title: string) => void) => () => void
  onTraySnippets: (callback: (snippets: CodeSnippet[]) => void) => () => void
  copySnippet: (code: string, title: string) => void
  closeTrayWindow: () => void
  openMainWindow: () => void
  openSettingsWindow: () => void
  quitApp: () => void
  onThemeChanged: (callback: (theme: string) => void) => () => void
  onAppCommand: (callback: (command: AppCommand) => void) => () => void

  notesGetAll: (type?: 'document' | 'snippet', folderId?: string) => Promise<Note[]>
  notesGetAllWithTags: (
    type?: 'document' | 'snippet',
    folderId?: string
  ) => Promise<(Note & { tags: Tag[] })[]>
  notesGetTrashedWithTags: () => Promise<(Note & { tags: Tag[] })[]>
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
    params: {
      title?: string
      content?: string
      language?: string
      is_pinned?: number
      is_favorite?: number
    }
  ) => Promise<Note | null>
  notesTrash: (id: string) => Promise<boolean>
  notesRestore: (id: string) => Promise<boolean>
  notesDelete: (id: string) => Promise<boolean>
  notesEmptyTrash: () => Promise<boolean>
  notesGetTrashed: () => Promise<Note[]>
  notesSearch: (query: string, type?: 'document' | 'snippet') => Promise<Note[]>
  notesTogglePin: (id: string) => Promise<Note | null>
  snippetsGetForTray: () => Promise<TraySnippet[]>
  settingsGet: (key: string) => Promise<string | null>
  settingsSet: (key: string, value: string) => Promise<string>

  exportsGetAll: (limit?: number) => Promise<ExportRecord[]>
  exportPDF: (noteId: string) => Promise<ExportRecord | null>
  exportImage: (noteId: string) => Promise<ExportRecord | null>
  exportMarkdown: (noteId: string) => Promise<ExportRecord | null>
  exportDocx: (noteId: string) => Promise<ExportRecord | null>
  exportCode: (noteId: string) => Promise<ExportRecord | null>
  exportsDelete: (id: string) => Promise<boolean>
  openPath: (path: string) => Promise<void>

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

  aiGetAllModels: () => Promise<AIModelConfig[]>
  aiGetEnabledModels: () => Promise<AIModelConfig[]>
  aiGetModelById: (id: string) => Promise<AIModelConfig | undefined>
  aiUpdateModel: (id: string, updates: Partial<AIModelConfig>) => Promise<AIModelConfig | null>
  aiToggleModel: (id: string, enabled: boolean) => Promise<AIModelConfig | null>
  aiGetModelsByProvider: (provider: AIProvider) => Promise<AIModelConfig[]>
  aiStreamCompletion: (
    modelId: string,
    messages: AIMessage[],
    options: Partial<AICompletionOptions>,
    sessionId: string
  ) => Promise<AIStreamResponse>
  aiCancelStream: (sessionId: string) => Promise<{ success: boolean }>
  aiOnStreamChunk: (sessionId: string, callback: (chunk: string) => void) => () => void
  aiOnStreamComplete: (sessionId: string, callback: () => void) => () => void
  aiOnStreamError: (sessionId: string, callback: (error: string) => void) => () => void
  aiGenerateCompletion: (
    modelId: string,
    messages: AIMessage[],
    options: Partial<AICompletionOptions>
  ) => Promise<AIGenerateResponse>
  aiTestModel: (modelId: string) => Promise<{ success: boolean; error?: string }>
  runTypecheck: () => Promise<{ success: boolean; output: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
