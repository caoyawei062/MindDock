import { getDatabase } from './index'
import { v4 as uuidv4 } from 'uuid'

// 标签类型定义
export interface Tag {
  id: string
  name: string
  color: string
  created_at: string
}

export interface NoteTag {
  note_id: string
  tag_id: string
  created_at: string
}

/**
 * 获取所有标签
 */
export function getAllTags(): Tag[] {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM tags ORDER BY created_at DESC')
  return stmt.all() as Tag[]
}

/**
 * 根据 ID 获取标签
 */
export function getTagById(id: string): Tag | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM tags WHERE id = ?')
  return stmt.get(id) as Tag | null
}

/**
 * 根据名称获取标签
 */
export function getTagByName(name: string): Tag | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM tags WHERE name = ?')
  return stmt.get(name) as Tag | null
}

/**
 * 创建标签
 */
export function createTag(params: { name: string; color?: string }): Tag {
  const db = getDatabase()

  // 检查标签名是否已存在
  const existing = getTagByName(params.name)
  if (existing) {
    throw new Error(`Tag "${params.name}" already exists`)
  }

  const id = uuidv4()
  const now = new Date().toISOString()

  const tag: Tag = {
    id,
    name: params.name,
    color: params.color || '#6366f1',
    created_at: now
  }

  db.prepare(
    `
    INSERT INTO tags (id, name, color, created_at)
    VALUES (?, ?, ?, ?)
  `
  ).run(tag.id, tag.name, tag.color, tag.created_at)

  return tag
}

/**
 * 更新标签
 */
export function updateTag(id: string, params: { name?: string; color?: string }): Tag | null {
  const db = getDatabase()

  const existing = getTagById(id)
  if (!existing) {
    return null
  }

  // 如果要更新名称,检查是否冲突
  if (params.name && params.name !== existing.name) {
    const nameConflict = getTagByName(params.name)
    if (nameConflict && nameConflict.id !== id) {
      throw new Error(`Tag "${params.name}" already exists`)
    }
  }

  const updates: string[] = []
  const values: Array<string | null> = []

  if (params.name) {
    updates.push('name = ?')
    values.push(params.name)
  }
  if (params.color !== undefined) {
    updates.push('color = ?')
    values.push(params.color)
  }

  if (updates.length === 0) {
    return existing
  }

  values.push(id)

  db.prepare(`UPDATE tags SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  return getTagById(id)
}

/**
 * 删除标签
 */
export function deleteTag(id: string): boolean {
  const db = getDatabase()

  // 先删除关联关系
  db.prepare('DELETE FROM note_tags WHERE tag_id = ?').run(id)

  // 删除标签
  const result = db.prepare('DELETE FROM tags WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 获取笔记的所有标签
 */
export function getTagsByNoteId(noteId: string): Tag[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT t.* FROM tags t
    INNER JOIN note_tags nt ON t.id = nt.tag_id
    WHERE nt.note_id = ?
    ORDER BY t.created_at DESC
  `)
  return stmt.all(noteId) as Tag[]
}

/**
 * 为笔记添加标签
 */
export function addTagToNote(noteId: string, tagId: string): void {
  const db = getDatabase()
  const now = new Date().toISOString()

  // 检查是否已存在
  const existing = db
    .prepare('SELECT * FROM note_tags WHERE note_id = ? AND tag_id = ?')
    .get(noteId, tagId)

  if (existing) {
    return // 已经存在,不重复添加
  }

  db.prepare(
    `
    INSERT INTO note_tags (note_id, tag_id, created_at)
    VALUES (?, ?, ?)
  `
  ).run(noteId, tagId, now)
}

/**
 * 从笔记移除标签
 */
export function removeTagFromNote(noteId: string, tagId: string): boolean {
  const db = getDatabase()
  const result = db
    .prepare('DELETE FROM note_tags WHERE note_id = ? AND tag_id = ?')
    .run(noteId, tagId)
  return result.changes > 0
}

/**
 * 设置笔记的标签(替换所有标签)
 */
export function setNoteTags(noteId: string, tagIds: string[]): void {
  const db = getDatabase()

  // 删除现有标签
  db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId)

  // 添加新标签
  const now = new Date().toISOString()
  const stmt = db.prepare(`
    INSERT INTO note_tags (note_id, tag_id, created_at)
    VALUES (?, ?, ?)
  `)

  for (const tagId of tagIds) {
    stmt.run(noteId, tagId, now)
  }
}

/**
 * 获取使用该标签的所有笔记 ID
 */
export function getNoteIdsByTagId(tagId: string): string[] {
  const db = getDatabase()
  const stmt = db.prepare('SELECT note_id FROM note_tags WHERE tag_id = ?')
  const rows = stmt.all(tagId) as { note_id: string }[]
  return rows.map((row) => row.note_id)
}
