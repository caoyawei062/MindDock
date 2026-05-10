import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  nativeImage,
  Menu,
  type MenuItemConstructorOptions
} from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { execFile } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { CHANGETHEME } from '../constants'
import { initTray, updateMainWindowRef } from './tray'
import { initDatabase, closeDatabase } from './database'
import { registerDatabaseIPC } from './database/ipc'
import { registerAIIPC } from './ai/ipc'

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let isQuitting = false

type AppCommand = 'save-current-note' | 'new-document' | 'focus-search'

interface WindowsOverlayConfig {
  color: string
  symbolColor: string
  height: number
}

function getMacDockIconPath(): string | null {
  if (process.platform !== 'darwin' || app.isPackaged) return null

  const generatedDockIconPath = join(app.getAppPath(), 'resources', 'icon-dock.png')
  if (existsSync(generatedDockIconPath)) return generatedDockIconPath

  const dockIconPath = join(app.getAppPath(), 'build', 'icon.icns')
  if (existsSync(dockIconPath)) return dockIconPath

  return null
}

function getWindowsOverlayConfig(isDark: boolean): WindowsOverlayConfig {
  return {
    color: isDark ? '#1e1e1e' : '#f5f5f5',
    symbolColor: isDark ? '#cccccc' : '#333333',
    height: 40
  }
}

function updateWindowsOverlay(isDark: boolean): void {
  if (process.platform !== 'win32' || !mainWindow || mainWindow.isDestroyed()) return
  mainWindow.setTitleBarOverlay(getWindowsOverlayConfig(isDark))
}

function dispatchAppCommand(command: AppCommand): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('app-command', command)
}

function createAppMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              {
                label: 'Settings',
                accelerator: 'CmdOrCtrl+,',
                click: () => createSettingsWindow()
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Document',
          accelerator: 'CmdOrCtrl+N',
          click: () => dispatchAppCommand('new-document')
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => dispatchAppCommand('save-current-note')
        },
        ...(isMac
          ? []
          : [
              { type: 'separator' as const },
              {
                label: 'Settings',
                accelerator: 'CmdOrCtrl+,',
                click: () => createSettingsWindow()
              },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Search',
          accelerator: 'CmdOrCtrl+K',
          click: () => dispatchAppCommand('focus-search')
        }
      ]
    },
    {
      label: 'View',
      submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }]
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function runTypecheck(): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const cwd = app.getAppPath()
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm'

    execFile(
      command,
      ['run', 'typecheck'],
      { cwd, maxBuffer: 1024 * 1024 * 8 },
      (error, stdout, stderr) => {
        const output = `${stdout}${stderr}`.trim()
        if (error) {
          resolve({ success: false, output: output || error.message })
          return
        }
        resolve({ success: true, output })
      }
    )
  })
}

function createWindow(): void {
  const isWin = process.platform === 'win32'
  const isDark = nativeTheme.shouldUseDarkColors

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 840,
    minHeight: 840,
    show: false,
    minWidth: 810,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    ...(isWin
      ? { titleBarOverlay: getWindowsOverlayConfig(isDark) }
      : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    if ((process.platform === 'darwin' || process.platform === 'win32') && mainWindow) {
      updateMainWindowRef(mainWindow)
    }
  })

  // On Windows: hide to tray instead of closing
  if (isWin) {
    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault()
        mainWindow?.hide()
      }
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    title: 'MindDock Settings',
    ...(process.platform === 'linux' ? { icon } : {}),
    ...(process.platform === 'win32' ? { titleBarOverlay: { height: 40 } } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  settingsWindow.on('ready-to-show', () => {
    settingsWindow?.show()
  })

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })

  settingsWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    settingsWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/settings`)
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/settings' })
  }
}

app.whenReady().then(() => {
  const macDockIconPath = getMacDockIconPath()
  if (macDockIconPath) {
    app.dock?.setIcon(nativeImage.createFromPath(macDockIconPath))
  }

  electronApp.setAppUserModelId('com.electron')

  initDatabase()
  registerDatabaseIPC()
  registerAIIPC()
  createAppMenu()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => {})
  ipcMain.on(CHANGETHEME, (_, theme) => {
    nativeTheme.themeSource = theme

    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('theme-changed', theme)
    })

    updateWindowsOverlay(nativeTheme.shouldUseDarkColors)
  })

  nativeTheme.on('updated', () => {
    const currentThemeSource = nativeTheme.themeSource

    if (currentThemeSource === 'system') {
      const actualTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'

      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('theme-changed', actualTheme)
      })

      updateWindowsOverlay(nativeTheme.shouldUseDarkColors)
    }
  })

  ipcMain.handle('open-path', async (_, filePath: string) => {
    try {
      await shell.showItemInFolder(filePath)
    } catch (error) {
      throw error
    }
  })

  ipcMain.on('open-settings-window', () => {
    createSettingsWindow()
  })

  ipcMain.handle('dev:run-typecheck', async () => {
    return runTypecheck()
  })

  createWindow()

  if ((process.platform === 'darwin' || process.platform === 'win32') && mainWindow) {
    initTray(mainWindow)
  }

  app.on('activate', function () {
    if (mainWindow === null) {
      createWindow()
    } else if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  closeDatabase()
})
