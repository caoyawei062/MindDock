import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { pathToFileURL } from 'url'
import {
  getAllNotes,
  getAllNotesWithTags,
  getNoteById,
  createNote,
  updateNote,
  trashNote,
  restoreNote,
  deleteNote,
  emptyTrash,
  getTrashedNotes,
  getTrashedNotesWithTags,
  searchNotesWithTags,
  togglePinNote,
  getSnippetsForTray,
  CreateNoteParams,
  UpdateNoteParams
} from './notes'
import { getAllExports, createExportRecord, deleteExport, cleanOldExports } from './exports'
import {
  getAllTags,
  getTagById,
  createTag,
  updateTag,
  deleteTag,
  getTagsByNoteId,
  addTagToNote,
  removeTagFromNote,
  setNoteTags,
  getNoteIdsByTagId
} from './tags'
import {
  getAllAIConfigs,
  getEnabledAIConfigs,
  getAIConfigsByProvider,
  getAIConfigById,
  upsertAIConfig,
  updateAIConfig,
  toggleAIConfig,
  deleteAIConfig
} from './ai-configs'
import { getSetting, setSetting } from './settings'
import { contentToHTML } from '../export/pdf'
import { createDocxFromHtml, normalizeHtmlToMarkdown } from '../export/document'
import { AIModelConfig, AIProvider } from '../ai/types'

const LANGUAGE_FILE_EXTENSIONS: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  java: 'java',
  csharp: 'cs',
  cpp: 'cpp',
  c: 'c',
  go: 'go',
  rust: 'rs',
  ruby: 'rb',
  php: 'php',
  html: 'html',
  css: 'css',
  json: 'json',
  markdown: 'md',
  shell: 'sh',
  bash: 'sh',
  zsh: 'zsh',
  sql: 'sql',
  yaml: 'yml',
  yml: 'yml',
  xml: 'xml',
  text: 'txt',
  plaintext: 'txt'
}

function getSnippetFileExtension(language: string | null): string {
  if (!language) return 'txt'
  return LANGUAGE_FILE_EXTENSIONS[language.toLowerCase()] || language.toLowerCase()
}

function sanitizeFileName(name: string): string {
  const safeName = Array.from((name || 'untitled').trim())
    .map((char) => (char.charCodeAt(0) < 32 ? '_' : char))
    .join('')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')

  return safeName || 'untitled'
}

async function createTemporaryExportHtml(html: string): Promise<{
  htmlPath: string
  cleanup: () => Promise<void>
}> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'minddock-export-'))
  const htmlPath = path.join(tempDir, 'export.html')
  await fs.writeFile(htmlPath, html, 'utf8')

  return {
    htmlPath,
    cleanup: async () => {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  }
}

/**
 * 注册数据库相关的 IPC 处理器
 */
export function registerDatabaseIPC(): void {
  // 获取所有笔记
  ipcMain.handle('db:notes:getAll', (_, type?: 'document' | 'snippet', folderId?: string) => {
    return getAllNotes(type, folderId)
  })

  // 获取所有笔记（带标签，单次查询）
  ipcMain.handle(
    'db:notes:getAllWithTags',
    (_, type?: 'document' | 'snippet', folderId?: string) => {
      return getAllNotesWithTags(type, folderId)
    }
  )

  // 获取回收站笔记（带标签）
  ipcMain.handle('db:notes:getTrashedWithTags', () => {
    return getTrashedNotesWithTags()
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

  ipcMain.handle('db:notes:emptyTrash', () => {
    return emptyTrash()
  })

  // 获取回收站笔记
  ipcMain.handle('db:notes:getTrashed', () => {
    return getTrashedNotes()
  })

  // 搜索笔记
  ipcMain.handle('db:notes:search', (_, query: string, type?: 'document' | 'snippet') => {
    return searchNotesWithTags(query, type)
  })

  // 置顶/取消置顶
  ipcMain.handle('db:notes:togglePin', (_, id: string) => {
    return togglePinNote(id)
  })

  // 获取托盘窗口的代码片段
  ipcMain.handle('db:snippets:getForTray', () => {
    return getSnippetsForTray()
  })

  // ========== 通用设置 ==========

  ipcMain.handle('db:settings:get', (_event, key: string) => {
    return getSetting(key)
  })

  ipcMain.handle('db:settings:set', (_event, key: string, value: string) => {
    return setSetting(key, value)
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

    const html = contentToHTML(note.title, note.content)
    const { htmlPath, cleanup } = await createTemporaryExportHtml(html)

    // 创建一个隐藏的窗口来生成 PDF
    const win = new BrowserWindow({
      width: 800,
      height: 1200,
      show: false,
      webPreferences: {
        sandbox: true,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      }
    })

    try {
      await win.loadURL(pathToFileURL(htmlPath).toString())

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
      await cleanup()
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

    const html = contentToHTML(note.title, note.content)
    const { htmlPath, cleanup } = await createTemporaryExportHtml(html)

    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      backgroundColor: '#ffffff',
      webPreferences: {
        sandbox: true,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      }
    })

    try {
      await win.loadURL(pathToFileURL(htmlPath).toString())

      await win.webContents.executeJavaScript(`
        (async () => {
          const images = Array.from(document.images)

          await Promise.all(images.map(async (img) => {
            if (img.complete && img.naturalWidth > 0) return

            if (typeof img.decode === 'function') {
              try {
                await img.decode()
                return
              } catch {}
            }

            await new Promise((resolve) => {
              const cleanup = () => {
                img.removeEventListener('load', onLoad)
                img.removeEventListener('error', onError)
              }

              const onLoad = () => {
                cleanup()
                resolve()
              }

              const onError = () => {
                cleanup()
                resolve()
              }

              img.addEventListener('load', onLoad, { once: true })
              img.addEventListener('error', onError, { once: true })
            })
          }))

          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

          return {
            width: Math.max(
              document.documentElement.scrollWidth,
              document.body.scrollWidth,
              document.documentElement.clientWidth
            ),
            height: Math.max(
              document.documentElement.scrollHeight,
              document.body.scrollHeight,
              document.documentElement.clientHeight
            )
          }
        })()
      `).then(async (size: { width: number; height: number }) => {
        const captureWidth = Math.ceil(size.width)
        const captureHeight = Math.ceil(size.height)

        win.setContentSize(captureWidth, captureHeight)

        await win.webContents.executeJavaScript(
          'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
        )

        const image = await win.webContents.capturePage({
          x: 0,
          y: 0,
          width: captureWidth,
          height: captureHeight
        })

        await fs.writeFile(result.filePath!, image.toPNG())
      })

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
      await cleanup()
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
    const defaultFileName =
      note.type === 'snippet' ? `${note.title}.${note.language || 'md'}` : `${note.title}.md`

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
      markdown += `${normalizeHtmlToMarkdown(note.content)}\n`
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

  // 导出文档到 Word
  ipcMain.handle('db:export:docx', async (_event, noteId: string) => {
    const note = getNoteById(noteId)
    if (!note) {
      throw new Error('Note not found')
    }

    if (note.type !== 'document') {
      throw new Error('Word export is only supported for documents')
    }

    const result = await dialog.showSaveDialog({
      defaultPath: `${sanitizeFileName(note.title)}.docx`,
      filters: [
        { name: 'Word Documents', extensions: ['docx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    const html = contentToHTML(note.title, note.content)
    await createDocxFromHtml(html, result.filePath)

    const exportRecord = createExportRecord({
      noteId: note.id,
      noteTitle: note.title,
      filePath: result.filePath,
      exportType: 'docx'
    })

    cleanOldExports(noteId, 5)

    return exportRecord
  })

  // 导出代码片段到源代码文件
  ipcMain.handle('db:export:code', async (_event, noteId: string) => {
    const note = getNoteById(noteId)
    if (!note) {
      throw new Error('Note not found')
    }

    if (note.type !== 'snippet') {
      throw new Error('Code file export is only supported for snippets')
    }

    const extension = getSnippetFileExtension(note.language)
    const safeTitle = sanitizeFileName(note.title)

    const result = await dialog.showSaveDialog({
      defaultPath: `${safeTitle}.${extension}`,
      filters: [
        { name: `${(note.language || 'Code').toUpperCase()} Files`, extensions: [extension] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    await fs.writeFile(result.filePath, note.content, 'utf8')

    const exportRecord = createExportRecord({
      noteId: note.id,
      noteTitle: note.title,
      filePath: result.filePath,
      exportType: 'code'
    })

    cleanOldExports(noteId, 5)

    return exportRecord
  })

  // 删除导出记录
  ipcMain.handle('db:exports:delete', (_, id: string) => {
    return deleteExport(id)
  })

  // ========== 标签操作 ==========

  // 获取所有标签
  ipcMain.handle('db:tags:getAll', () => {
    return getAllTags()
  })

  // 根据 ID 获取标签
  ipcMain.handle('db:tags:getById', (_, id: string) => {
    return getTagById(id)
  })

  // 创建标签
  ipcMain.handle('db:tags:create', (_, params: { name: string; color?: string }) => {
    return createTag(params)
  })

  // 更新标签
  ipcMain.handle('db:tags:update', (_, id: string, params: { name?: string; color?: string }) => {
    return updateTag(id, params)
  })

  // 删除标签
  ipcMain.handle('db:tags:delete', (_, id: string) => {
    return deleteTag(id)
  })

  // 获取笔记的所有标签
  ipcMain.handle('db:tags:getByNoteId', (_, noteId: string) => {
    return getTagsByNoteId(noteId)
  })

  // 为笔记添加标签
  ipcMain.handle('db:tags:addToNote', (_, noteId: string, tagId: string) => {
    return addTagToNote(noteId, tagId)
  })

  // 从笔记移除标签
  ipcMain.handle('db:tags:removeFromNote', (_, noteId: string, tagId: string) => {
    return removeTagFromNote(noteId, tagId)
  })

  // 设置笔记的标签(替换所有标签)
  ipcMain.handle('db:tags:setNoteTags', (_, noteId: string, tagIds: string[]) => {
    return setNoteTags(noteId, tagIds)
  })

  // 获取使用该标签的所有笔记 ID
  ipcMain.handle('db:tags:getNoteIds', (_, tagId: string) => {
    return getNoteIdsByTagId(tagId)
  })

  // ========== AI 配置操作 ==========

  // 获取所有 AI 配置
  ipcMain.handle('db:ai:getAll', () => {
    return getAllAIConfigs()
  })

  // 获取启用的 AI 配置
  ipcMain.handle('db:ai:getEnabled', () => {
    return getEnabledAIConfigs()
  })

  // 根据提供商获取 AI 配置
  ipcMain.handle('db:ai:getByProvider', (_, provider: AIProvider) => {
    return getAIConfigsByProvider(provider)
  })

  // 根据 ID 获取 AI 配置
  ipcMain.handle('db:ai:getById', (_, id: string) => {
    return getAIConfigById(id)
  })

  // 创建或更新 AI 配置
  ipcMain.handle('db:ai:upsert', (_, config: AIModelConfig) => {
    return upsertAIConfig(config)
  })

  // 更新 AI 配置的部分字段
  ipcMain.handle('db:ai:update', (_, id: string, updates: Partial<AIModelConfig>) => {
    return updateAIConfig(id, updates)
  })

  // 启用/禁用 AI 模型
  ipcMain.handle('db:ai:toggle', (_, id: string, enabled: boolean) => {
    return toggleAIConfig(id, enabled)
  })

  // 删除 AI 配置
  ipcMain.handle('db:ai:delete', (_, id: string) => {
    return deleteAIConfig(id)
  })

  console.log('Database IPC handlers registered.')
}

export default { registerDatabaseIPC }
