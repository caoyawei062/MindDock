import { app, shell, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { CHANGETHEME } from '../constants'
import { initTray, updateMainWindowRef } from './tray'
import { initDatabase, closeDatabase } from './database'
import { registerDatabaseIPC } from './database/ipc'
import { registerAIIPC } from './ai/ipc'

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 740,
    minHeight: 740,
    show: false,
    minWidth: 810,
    // alwaysOnTop: true,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    ...(process.platform === 'linux' ? { icon } : {}),
    ...(process.platform !== 'darwin' ? { titleBarOverlay: true } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    // 窗口准备好后更新托盘的主窗口引用
    if (process.platform === 'darwin' && mainWindow) {
      updateMainWindowRef(mainWindow)
    }
  })

  // 窗口关闭时清除引用
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
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
    ...(process.platform !== 'darwin' ? { titleBarOverlay: true } : {}),
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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // 初始化数据库
  initDatabase()
  registerDatabaseIPC()

  // 初始化 AI IPC
  registerAIIPC()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.on(CHANGETHEME, (_, theme) => {
    console.log('Theme changed to:', theme)
    nativeTheme.themeSource = theme

    // 广播主题变化到所有窗口
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('theme-changed', theme)
    })
  })

  // 监听系统主题变化
  nativeTheme.on('updated', () => {
    // 当主题设置为 'system' 时,系统主题变化会触发此事件
    const currentThemeSource = nativeTheme.themeSource
    console.log('System theme updated, current theme source:', currentThemeSource)

    if (currentThemeSource === 'system') {
      // 获取当前实际的主题（light 或 dark）
      const actualTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
      console.log('Actual theme based on system:', actualTheme)

      // 广播实际主题变化到所有窗口
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('theme-changed', actualTheme)
      })
    }
  })

  // 打开文件路径
  ipcMain.handle('open-path', async (_, filePath: string) => {
    try {
      await shell.showItemInFolder(filePath)
    } catch (error) {
      console.error('Failed to open path:', error)
      throw error
    }
  })

  // 打开设置窗口
  ipcMain.on('open-settings-window', () => {
    createSettingsWindow()
  })

  createWindow()

  // 创建托盘（仅 macOS）
  if (process.platform === 'darwin' && mainWindow) {
    initTray(mainWindow)
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
      createWindow()
    } else if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 应用退出时关闭数据库
app.on('before-quit', () => {
  closeDatabase()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
