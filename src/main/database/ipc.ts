import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs/promises'
import {
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  trashNote,
  restoreNote,
  deleteNote,
  getTrashedNotes,
  searchNotes,
  togglePinNote,
  getSnippetsForTray,
  CreateNoteParams,
  UpdateNoteParams
} from './notes'
import {
  getAllFolders,
  getFolderTree,
  getFolderById,
  createFolder,
  updateFolder,
  deleteFolder,
  toggleFolderExpanded,
  CreateFolderParams,
  UpdateFolderParams
} from './folders'
import {
  getAllExports,
  createExportRecord,
  deleteExport,
  cleanOldExports
} from './exports'
import { contentToHTML } from '../export/pdf'

/**
 * 注册数据库相关的 IPC 处理器
 */
export function registerDatabaseIPC(): void {
  // 获取所有笔记
  ipcMain.handle('db:notes:getAll', (_, type?: 'document' | 'snippet', folderId?: string) => {
    return getAllNotes(type, folderId)
  })

  // 根据 ID 获取笔记
  ipcMain.handle('db:notes:getById', (_, id: string) => {
    return getNoteById(id)
  })

  // 创建笔记
  ipcMain.handle('db:notes:create', (_, params: CreateNoteParams) => {
    return createNote(params)
  })

  // 更新笔记
  ipcMain.handle('db:notes:update', (_, id: string, params: UpdateNoteParams) => {
    return updateNote(id, params)
  })

  // 移动到回收站
  ipcMain.handle('db:notes:trash', (_, id: string) => {
    return trashNote(id)
  })

  // 从回收站恢复
  ipcMain.handle('db:notes:restore', (_, id: string) => {
    return restoreNote(id)
  })

  // 永久删除
  ipcMain.handle('db:notes:delete', (_, id: string) => {
    return deleteNote(id)
  })

  // 获取回收站笔记
  ipcMain.handle('db:notes:getTrashed', () => {
    return getTrashedNotes()
  })

  // 搜索笔记
  ipcMain.handle('db:notes:search', (_, query: string, type?: 'document' | 'snippet') => {
    return searchNotes(query, type)
  })

  // 置顶/取消置顶
  ipcMain.handle('db:notes:togglePin', (_, id: string) => {
    return togglePinNote(id)
  })

  // 获取托盘窗口的代码片段
  ipcMain.handle('db:snippets:getForTray', () => {
    return getSnippetsForTray()
  })

  // ========== 文件夹操作 ==========

  // 获取所有文件夹
  ipcMain.handle('db:folders:getAll', () => {
    return getAllFolders()
  })

  // 获取文件夹树
  ipcMain.handle('db:folders:getTree', () => {
    return getFolderTree()
  })

  // 根据 ID 获取文件夹
  ipcMain.handle('db:folders:getById', (_, id: string) => {
    return getFolderById(id)
  })

  // 创建文件夹
  ipcMain.handle('db:folders:create', (_, params: CreateFolderParams) => {
    return createFolder(params)
  })

  // 更新文件夹
  ipcMain.handle('db:folders:update', (_, id: string, params: UpdateFolderParams) => {
    return updateFolder(id, params)
  })

  // 删除文件夹
  ipcMain.handle('db:folders:delete', (_, id: string) => {
    return deleteFolder(id)
  })

  // 切换文件夹展开状态
  ipcMain.handle('db:folders:toggleExpanded', (_, id: string) => {
    return toggleFolderExpanded(id)
  })

  // ========== 导出操作 ==========

  // 获取最近导出记录
  ipcMain.handle('db:exports:getAll', (_, limit?: number) => {
    return getAllExports(limit)
  })

  // 导出笔记到 PDF (仅富文本文档)
  ipcMain.handle('db:export:pdf', async (_event, noteId: string) => {
    const note = getNoteById(noteId)
    if (!note) {
      throw new Error('Note not found')
    }

    if (note.type !== 'document') {
      throw new Error('PDF export is only supported for documents')
    }

    // 让用户选择保存路径
    const result = await dialog.showSaveDialog({
      defaultPath: `${note.title}.pdf`,
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    // 生成 HTML
    const html = contentToHTML(note.title, note.content)

    // 创建一个隐藏的窗口来生成 PDF
    const win = new BrowserWindow({
      width: 800,
      height: 1200,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    })

    try {
      // 加载 HTML
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

      // 生成 PDF
      const pdfData = await win.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        landscape: false
      })

      // 保存文件
      await fs.writeFile(result.filePath, pdfData)

      // 创建导出记录
      const exportRecord = createExportRecord({
        noteId: note.id,
        noteTitle: note.title,
        filePath: result.filePath,
        exportType: 'pdf'
      })

      // 清理旧记录（每个笔记只保留最近5条）
      cleanOldExports(noteId, 5)

      return exportRecord
    } finally {
      win.close()
    }
  })

  // 导出笔记到图片 (仅富文本文档)
  ipcMain.handle('db:export:image', async (_event, noteId: string) => {
    const note = getNoteById(noteId)
    if (!note) {
      throw new Error('Note not found')
    }

    if (note.type !== 'document') {
      throw new Error('Image export is only supported for documents')
    }

    // 让用户选择保存路径
    const result = await dialog.showSaveDialog({
      defaultPath: `${note.title}.png`,
      filters: [
        { name: 'PNG Files', extensions: ['png'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    // 生成 HTML
    const html = contentToHTML(note.title, note.content)

    // 创建一个窗口来截图
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    })

    try {
      // 加载 HTML
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

      // 等待页面完全加载
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 截图
      const image = await win.webContents.capturePage()

      // 保存为 PNG
      const buffer = image.toPNG()
      await fs.writeFile(result.filePath, buffer)

      // 创建导出记录
      const exportRecord = createExportRecord({
        noteId: note.id,
        noteTitle: note.title,
        filePath: result.filePath,
        exportType: 'image'
      })

      // 清理旧记录（每个笔记只保留最近5条）
      cleanOldExports(noteId, 5)

      return exportRecord
    } finally {
      win.close()
    }
  })

  // 导出代码片段到 Markdown
  ipcMain.handle('db:export:markdown', async (_event, noteId: string) => {
    const note = getNoteById(noteId)
    if (!note) {
      throw new Error('Note not found')
    }

    // 根据类型生成不同的默认文件名
    const defaultFileName = note.type === 'snippet'
      ? `${note.title}.${note.language || 'md'}`
      : `${note.title}.md`

    // 让用户选择保存路径
    const result = await dialog.showSaveDialog({
      defaultPath: defaultFileName,
      filters: [
        { name: 'Markdown Files', extensions: ['md'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    // 生成 Markdown 内容
    let markdown = `# ${note.title}\n\n`

    if (note.type === 'snippet') {
      // 代码片段导出为代码块格式
      const language = note.language || 'text'
      markdown += `\`\`\`${language}\n${note.content}\n\`\`\`\n`
    } else {
      // 富文本文档直接导出内容
      markdown += `${note.content}\n`
    }

    // 写入文件
    await fs.writeFile(result.filePath, markdown, 'utf8')

    // 创建导出记录
    const exportRecord = createExportRecord({
      noteId: note.id,
      noteTitle: note.title,
      filePath: result.filePath,
      exportType: 'markdown'
    })

    // 清理旧记录（每个笔记只保留最近5条）
    cleanOldExports(noteId, 5)

    return exportRecord
  })

  // 删除导出记录
  ipcMain.handle('db:exports:delete', (_, id: string) => {
    return deleteExport(id)
  })

  console.log('Database IPC handlers registered.')
}

export default { registerDatabaseIPC }
