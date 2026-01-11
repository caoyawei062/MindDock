import { ElectronAPI } from '@electron-toolkit/preload'
import { THEME } from '../constants/index'

interface CodeSnippet {
  id: string
  title: string
  code: string
  language: string
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
  quitApp: () => void
  onThemeChanged: (callback: (theme: string) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
