import { getDatabase } from './index'
import { v4 as uuidv4 } from 'uuid'

// 笔记类型
export interface Note {
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
}

// 创建笔记的参数
export interface CreateNoteParams {
  title?: string
  content?: string
  type?: 'document' | 'snippet'
  language?: string | null
  folder_id?: string | null
}

// 更新笔记的参数
export interface UpdateNoteParams {
  title?: string
  content?: string
  language?: string | null
  folder_id?: string | null
  is_pinned?: number
  is_favorite?: number
  sort_order?: number
}

/**
 * 获取所有笔记（不包括回收站）
 */
export function getAllNotes(type?: 'document' | 'snippet', folderId?: string): Note[] {
  const db = getDatabase()

  let sql = `
    SELECT * FROM notes
    WHERE is_trashed = 0
  `
  const params: (string | number)[] = []

  if (type) {
    sql += ' AND type = ?'
    params.push(type)
  }

  if (folderId) {
    sql += ' AND folder_id = ?'
    params.push(folderId)
  }

  sql += ' ORDER BY is_pinned DESC, updated_at DESC'

  return db.prepare(sql).all(...params) as Note[]
}

/**
 * 根据 ID 获取笔记
 */
export function getNoteById(id: string): Note | null {
  const db = getDatabase()
  const result = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note | undefined
  return result || null
}

/**
 * 创建笔记
 */
export function createNote(params: CreateNoteParams = {}): Note {
  const db = getDatabase()
  const now = new Date().toISOString()

  const note: Note = {
    id: uuidv4(),
    title: params.title || '',
    content: params.content || '',
    type: params.type || 'document',
    language: params.language || null,
    folder_id: params.folder_id || null,
    is_pinned: 0,
    is_trashed: 0,
    is_favorite: 0,
    sort_order: 0,
    word_count: (params.content || '').length,
    created_at: now,
    updated_at: now,
    trashed_at: null
  }

  db.prepare(`
    INSERT INTO notes (
      id, title, content, type, language, folder_id,
      is_pinned, is_trashed, is_favorite, sort_order, word_count,
      created_at, updated_at, trashed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    note.id,
    note.title,
    note.content,
    note.type,
    note.language,
    note.folder_id,
    note.is_pinned,
    note.is_trashed,
    note.is_favorite,
    note.sort_order,
    note.word_count,
    note.created_at,
    note.updated_at,
    note.trashed_at
  )

  return note
}

/**
 * 更新笔记
 */
export function updateNote(id: string, params: UpdateNoteParams): Note | null {
  const db = getDatabase()
  const existing = getNoteById(id)

  if (!existing) return null

  const updated = {
    ...existing,
    ...params,
    word_count: params.content !== undefined ? params.content.length : existing.word_count,
    updated_at: new Date().toISOString()
  }

  db.prepare(`
    UPDATE notes SET
      title = ?,
      content = ?,
      language = ?,
      folder_id = ?,
      is_pinned = ?,
      is_favorite = ?,
      sort_order = ?,
      word_count = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    updated.title,
    updated.content,
    updated.language,
    updated.folder_id,
    updated.is_pinned,
    updated.is_favorite,
    updated.sort_order,
    updated.word_count,
    updated.updated_at,
    id
  )

  return updated
}

/**
 * 移动到回收站
 */
export function trashNote(id: string): boolean {
  const db = getDatabase()
  const now = new Date().toISOString()

  const result = db
    .prepare('UPDATE notes SET is_trashed = 1, trashed_at = ?, updated_at = ? WHERE id = ?')
    .run(now, now, id)

  return result.changes > 0
}

/**
 * 从回收站恢复
 */
export function restoreNote(id: string): boolean {
  const db = getDatabase()
  const now = new Date().toISOString()

  const result = db
    .prepare('UPDATE notes SET is_trashed = 0, trashed_at = NULL, updated_at = ? WHERE id = ?')
    .run(now, id)

  return result.changes > 0
}

/**
 * 永久删除笔记
 */
export function deleteNote(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM notes WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 获取回收站中的笔记
 */
export function getTrashedNotes(): Note[] {
  const db = getDatabase()
  return db
    .prepare('SELECT * FROM notes WHERE is_trashed = 1 ORDER BY trashed_at DESC')
    .all() as Note[]
}

/**
 * 搜索笔记（全文搜索）
 */
export function searchNotes(query: string, type?: 'document' | 'snippet'): Note[] {
  const db = getDatabase()

  if (!query.trim()) {
    return getAllNotes(type)
  }

  // 使用 FTS5 搜索
  let sql = `
    SELECT n.* FROM notes n
    JOIN notes_fts fts ON n.rowid = fts.rowid
    WHERE notes_fts MATCH ? AND n.is_trashed = 0
  `
  const params: (string | number)[] = [`${query}*`]

  if (type) {
    sql += ' AND n.type = ?'
    params.push(type)
  }

  sql += ' ORDER BY rank'

  try {
    return db.prepare(sql).all(...params) as Note[]
  } catch {
    // FTS 搜索失败，回退到 LIKE 搜索
    let fallbackSql = `
      SELECT * FROM notes 
      WHERE is_trashed = 0 AND (title LIKE ? OR content LIKE ?)
    `
    const likeTerm = `%${query}%`
    const fallbackParams: (string | number)[] = [likeTerm, likeTerm]

    if (type) {
      fallbackSql += ' AND type = ?'
      fallbackParams.push(type)
    }

    fallbackSql += ' ORDER BY updated_at DESC'

    return db.prepare(fallbackSql).all(...fallbackParams) as Note[]
  }
}

/**
 * 置顶/取消置顶笔记
 */
export function togglePinNote(id: string): Note | null {
  const note = getNoteById(id)
  if (!note) return null

  return updateNote(id, { is_pinned: note.is_pinned ? 0 : 1 })
}

/**
 * 获取代码片段（用于托盘窗口）
 */
export function getSnippetsForTray(): {
  id: string
  title: string
  code: string
  language: string
  updatedAt: string
}[] {
  const snippets = getAllNotes('snippet')

  return snippets.map((s) => ({
    id: s.id,
    title: s.title,
    code: s.content,
    language: s.language || 'plaintext',
    updatedAt: new Date(s.updated_at).toLocaleDateString('zh-CN')
  }))
}

export default {
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
  getSnippetsForTray
}
