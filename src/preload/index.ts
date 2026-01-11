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
