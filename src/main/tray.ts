import { BrowserWindow, Tray, nativeImage, clipboard, screen, ipcMain, app } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import trayIcon from '../../resources/trayTemplate.png?asset'
import { getSnippetsForTray } from './database/notes'

// 代码片段数据类型
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

/**
 * 创建托盘弹窗
 */
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
    vibrancy: 'popover', // macOS 毛玻璃效果
    visualEffectState: 'active',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // 加载托盘弹窗页面
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    trayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/tray`)
  } else {
    trayWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/tray' })
  }

  // 失去焦点时隐藏
  trayWindow.on('blur', () => {
    trayWindow?.hide()
  })
}

/**
 * 显示托盘弹窗
 */
function showTrayWindow(): void {
  if (!trayWindow || !tray) return

  const trayBounds = tray.getBounds()
  const windowBounds = trayWindow.getBounds()
  const { workArea } = screen.getDisplayMatching(trayBounds)

  // 计算窗口位置（在托盘图标下方居中）
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2)
  const y = Math.round(trayBounds.y + trayBounds.height + 4)

  // 确保窗口不超出屏幕
  const finalX = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - windowBounds.width))
  const finalY = Math.min(y, workArea.y + workArea.height - windowBounds.height)

  trayWindow.setPosition(finalX, finalY)
  trayWindow.show()
  trayWindow.focus()

  // 从数据库加载代码片段并发送到托盘窗口
  try {
    const snippets = getSnippetsForTray()
    trayWindow.webContents.send('tray-snippets', snippets)
  } catch (error) {
    console.error('Failed to load snippets for tray:', error)
  }
}

/**
 * 创建托盘图标
 */
function createTray(): void {
  const trayImage = nativeImage.createFromPath(trayIcon)
  trayImage.setTemplateImage(true)

  tray = new Tray(trayImage)
  tray.setToolTip('MindDock - 点击选择代码片段')

  // 点击托盘图标显示自定义弹窗
  tray.on('click', () => {
    if (trayWindow?.isVisible()) {
      trayWindow.hide()
    } else {
      showTrayWindow()
    }
  })

  // 右键显示主窗口
  tray.on('right-click', () => {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.show()
      mainWindowRef.focus()
    } else {
      // 主窗口不存在或已被销毁,通过 activate 事件创建新窗口
      app.emit('activate')
    }
  })
}

/**
 * 注册托盘相关的 IPC 事件
 */
function registerTrayIPC(): void {
  // IPC: 接收渲染进程发来的代码片段列表更新（已废弃，保留兼容）
  ipcMain.on('update-snippets', () => {
    // 现在数据存储在数据库中，此事件不再需要处理
  })

  // IPC: 复制代码片段
  ipcMain.on('copy-snippet', (_, code: string, title: string) => {
    clipboard.writeText(code)
    trayWindow?.hide()
    mainWindowRef?.webContents.send('snippet-copied', title)
  })

  // IPC: 关闭托盘窗口
  ipcMain.on('close-tray-window', () => {
    trayWindow?.hide()
  })

  // IPC: 打开主窗口
  ipcMain.on('open-main-window', () => {
    trayWindow?.hide()
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.show()
      mainWindowRef.focus()
    } else {
      // 主窗口不存在或已被销毁,通过 activate 事件创建新窗口
      app.emit('activate')
    }
  })

  // IPC: 退出应用
  ipcMain.on('quit-app', () => {
    app.quit()
  })
}

/**
 * 更新主窗口引用
 * @param mainWindow 新的主窗口引用
 */
export function updateMainWindowRef(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow
}

/**
 * 初始化托盘功能
 * @param mainWindow 主窗口引用
 */
export function initTray(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow
  registerTrayIPC()
  createTrayWindow()
  createTray()
}

/**
 * 更新代码片段列表（已废弃，现在数据存储在数据库中）
 * @deprecated 使用数据库 API 替代
 */
export function updateSnippets(_snippets: CodeSnippet[]): void {
  // 数据现在存储在 SQLite 数据库中
  console.warn('updateSnippets is deprecated. Use database API instead.')
}

/**
 * 销毁托盘
 */
export function destroyTray(): void {
  trayWindow?.destroy()
  tray?.destroy()
  trayWindow = null
  tray = null
}
