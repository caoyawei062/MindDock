import { BrowserWindow, Tray, nativeImage, clipboard, screen, ipcMain, app } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import trayIcon from '../../resources/trayTemplate.png?asset'

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

// 模拟数据，后续替换为实际存储
let codeSnippets: CodeSnippet[] = [
  {
    id: '1',
    title: '二叉树遍历',
    code: 'function traverse(node) {\n  if (!node) return;\n  console.log(node.val);\n  traverse(node.left);\n  traverse(node.right);\n}',
    language: 'JavaScript',
    updatedAt: '2026/1/10'
  },
  {
    id: '2',
    title: 'md',
    code: '# Markdown Title\n\n- Item 1\n- Item 2',
    language: 'JavaScript',
    updatedAt: '2026/1/7'
  },
  {
    id: '3',
    title: 'electron drag',
    code: '-webkit-app-region: drag;',
    language: 'electron',
    updatedAt: '2026/1/7'
  },
  {
    id: '4',
    title: 'electron debug',
    code: 'mainWindow.webContents.openDevTools()',
    language: 'electron',
    updatedAt: '2026/1/5'
  },
  {
    id: '5',
    title: 'electron template',
    code: 'const { app, BrowserWindow } = require("electron")',
    language: 'electron',
    updatedAt: '2026/1/5'
  },
  {
    id: '6',
    title: 'module',
    code: 'export default function() {}',
    language: 'JavaScript',
    updatedAt: '2025/12/16'
  },
  {
    id: '7',
    title: 'ts',
    code: 'interface Props {\n  name: string\n}',
    language: 'JavaScript',
    updatedAt: '2025/12/16'
  }
]

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
    trayWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'tray' })
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

  // 发送最新的代码片段数据到托盘窗口
  trayWindow.webContents.send('tray-snippets', codeSnippets)
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
    if (mainWindowRef) {
      mainWindowRef.show()
      mainWindowRef.focus()
    }
  })
}

/**
 * 注册托盘相关的 IPC 事件
 */
function registerTrayIPC(): void {
  // IPC: 接收渲染进程发来的代码片段列表更新
  ipcMain.on('update-snippets', (_, snippets: CodeSnippet[]) => {
    codeSnippets = snippets
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
    if (mainWindowRef) {
      mainWindowRef.show()
      mainWindowRef.focus()
    }
  })

  // IPC: 退出应用
  ipcMain.on('quit-app', () => {
    app.quit()
  })
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
 * 更新代码片段列表
 * @param snippets 代码片段数组
 */
export function updateSnippets(snippets: CodeSnippet[]): void {
  codeSnippets = snippets
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
