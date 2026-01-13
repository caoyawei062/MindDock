import { getDatabase } from './index'

export interface ExportRecord {
  id: string
  note_id: string
  note_title: string
  file_path: string
  export_type: 'markdown' | 'html' | 'pdf' | 'image'
  created_at: string
}

/**
 * 创建导出记录表
 */
export function createExportsTable(): void {
  const db = getDatabase()
  db.exec(`
    CREATE TABLE IF NOT EXISTS exports (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      note_title TEXT NOT NULL,
      file_path TEXT NOT NULL,
      export_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    )
  `)

  // 创建索引以提高查询性能
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_exports_created_at ON exports(created_at DESC)
  `)
}

/**
 * 创建导出记录
 */
export function createExportRecord(params: {
  noteId: string
  noteTitle: string
  filePath: string
  exportType: ExportRecord['export_type']
}): ExportRecord {
  const db = getDatabase()
  const id = `export_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

  const stmt = db.prepare(`
    INSERT INTO exports (id, note_id, note_title, file_path, export_type)
    VALUES (?, ?, ?, ?, ?)
  `)

  stmt.run(id, params.noteId, params.noteTitle, params.filePath, params.exportType)

  return getExportById(id)!
}

/**
 * 获取所有导出记录（按时间倒序）
 */
export function getAllExports(limit: number = 10): ExportRecord[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM exports
    ORDER BY created_at DESC
    LIMIT ?
  `)

  return stmt.all(limit) as ExportRecord[]
}

/**
 * 根据 ID 获取导出记录
 */
export function getExportById(id: string): ExportRecord | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM exports WHERE id = ?')
  const result = stmt.get(id) as ExportRecord | undefined
  return result || null
}

/**
 * 获取某个笔记的所有导出记录
 */
export function getExportsByNoteId(noteId: string): ExportRecord[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM exports
    WHERE note_id = ?
    ORDER BY created_at DESC
  `)

  return stmt.all(noteId) as ExportRecord[]
}

/**
 * 删除导出记录
 */
export function deleteExport(id: string): boolean {
  const db = getDatabase()
  const stmt = db.prepare('DELETE FROM exports WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}

/**
 * 清理旧记录（保留最近 N 条）
 */
export function cleanOldExports(noteId: string, keepCount: number = 5): void {
  const db = getDatabase()

  // 获取要保留的记录 ID
  const stmt = db.prepare(`
    SELECT id FROM exports
    WHERE note_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `)

  const keepIds = stmt.all(noteId, keepCount) as { id: string }[]
  const keepIdList = keepIds.map((item) => item.id)
  const placeholders = keepIdList.map(() => '?').join(',')

  if (keepIdList.length > 0) {
    // 删除不在保留列表中的记录
    const deleteStmt = db.prepare(`
      DELETE FROM exports
      WHERE note_id = ? AND id NOT IN (${placeholders})
    `)
    deleteStmt.run(noteId, ...keepIdList)
  }
}
