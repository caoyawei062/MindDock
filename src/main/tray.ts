import { BrowserWindow, Tray, nativeImage, clipboard, screen, ipcMain, app, Menu } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import trayIcon from '../../resources/trayTemplate.png?asset'
import { getSnippetsForTray } from './database/notes'

export interface CodeSnippet {
  id: string
  title: string
  code: string
  language: string
  updatedAt?: string
}

let tray: Tray | null = null
let trayWindow: BrowserWindow | null = null
let mainWindowRef: BrowserWindow | null = null

function focusMainWindow(command?: 'new-snippet'): void {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    if (!mainWindowRef.isVisible()) {
      mainWindowRef.show()
    }
    if (mainWindowRef.isMinimized()) {
      mainWindowRef.restore()
    }
    mainWindowRef.focus()
    if (command) {
      mainWindowRef.webContents.send('app-command', command)
    }
    return
  }

  app.emit('activate')
}

function createTrayWindow(): void {
  trayWindow = new BrowserWindow({
    width: 320,
    height: 400,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    ...(process.platform === 'darwin'
      ? { vibrancy: 'popover', visualEffectState: 'active' as const }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    trayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/tray`)
  } else {
    trayWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/tray' })
  }

  trayWindow.on('blur', () => {
    trayWindow?.hide()
  })
}

function showTrayWindow(): void {
  if (!trayWindow || !tray) return

  const trayBounds = tray.getBounds()
  const windowBounds = trayWindow.getBounds()
  const display = screen.getDisplayMatching(trayBounds)
  const { workArea } = display

  const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2)

  const trayCenterY = trayBounds.y + trayBounds.height / 2
  const isAtBottom = trayCenterY > display.bounds.y + display.bounds.height / 2
  const y = isAtBottom
    ? Math.round(trayBounds.y - windowBounds.height - 4)
    : Math.round(trayBounds.y + trayBounds.height + 4)

  const finalX = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - windowBounds.width))
  const finalY = Math.max(
    workArea.y,
    Math.min(y, workArea.y + workArea.height - windowBounds.height)
  )

  trayWindow.setPosition(finalX, finalY)
  trayWindow.show()
  trayWindow.focus()

  try {
    const snippets = getSnippetsForTray()
    trayWindow.webContents.send('tray-snippets', snippets)
  } catch {
    // Silently ignore tray snippet load errors
  }
}

function showWindowsContextMenu(): void {
  const snippetItems = getSnippetsForTray()
    .slice(0, 6)
    .map((snippet) => ({
      label: `${snippet.title || '未命名片段'} (${snippet.language})`,
      click: () => {
        clipboard.writeText(snippet.code)
        focusMainWindow()
        mainWindowRef?.webContents.send('snippet-copied', snippet.title)
      }
    }))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开 MindDock',
      click: () => focusMainWindow()
    },
    {
      label: '新建代码片段',
      click: () => focusMainWindow('new-snippet')
    },
    {
      label: '打开快捷面板',
      click: () => showTrayWindow()
    },
    ...(snippetItems.length > 0
      ? [
          {
            label: '快速复制最近代码片段',
            submenu: snippetItems
          }
        ]
      : []),
    { type: 'separator' },
    {
      label: '退出',
      click: () => app.quit()
    }
  ])
  tray?.popUpContextMenu(contextMenu)
}

function createTray(): void {
  const trayImage = nativeImage.createFromPath(trayIcon)
  if (process.platform === 'darwin') {
    trayImage.setTemplateImage(true)
  }

  tray = new Tray(trayImage)
  tray.setToolTip('MindDock')

  tray.on('click', () => {
    if (trayWindow?.isVisible()) {
      trayWindow.hide()
    } else {
      showTrayWindow()
    }
  })

  tray.on('right-click', () => {
    if (process.platform === 'win32') {
      showWindowsContextMenu()
    } else {
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.show()
        mainWindowRef.focus()
      } else {
        app.emit('activate')
      }
    }
  })
}

function registerTrayIPC(): void {
  ipcMain.on('update-snippets', () => {})

  ipcMain.on('copy-snippet', (_, code: string, title: string) => {
    clipboard.writeText(code)
    trayWindow?.hide()
    mainWindowRef?.webContents.send('snippet-copied', title)
  })

  ipcMain.on('close-tray-window', () => {
    trayWindow?.hide()
  })

  ipcMain.on('open-main-window', () => {
    trayWindow?.hide()
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.show()
      mainWindowRef.focus()
    } else {
      app.emit('activate')
    }
  })

  ipcMain.on('quit-app', () => {
    app.quit()
  })
}

export function updateMainWindowRef(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow
}

export function initTray(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow
  registerTrayIPC()
  createTrayWindow()
  createTray()
}

export function destroyTray(): void {
  trayWindow?.destroy()
  tray?.destroy()
  trayWindow = null
  tray = null
}
