import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from './index'

export interface Folder {
  id: string
  name: string
  parent_id: string | null
  icon: string | null
  color: string | null
  sort_order: number
  is_expanded: number
  created_at: string
  updated_at: string
}

export interface CreateFolderParams {
  name: string
  parent_id?: string | null
  icon?: string | null
  color?: string | null
  sort_order?: number
}

export interface UpdateFolderParams {
  name?: string
  parent_id?: string | null
  icon?: string | null
  color?: string | null
  sort_order?: number
  is_expanded?: number
}

/**
 * 获取所有文件夹
 */
export function getAllFolders(): Folder[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM folders
    ORDER BY sort_order ASC, created_at ASC
  `)
  return stmt.all() as Folder[]
}

/**
 * 获取文件夹树形结构
 */
export function getFolderTree(): Folder[] {
  const db = getDatabase()
  const folders = db.prepare(`
    SELECT * FROM folders
    ORDER BY sort_order ASC, created_at ASC
  `).all() as Folder[]

  // 构建树形结构
  const folderMap = new Map<string, Folder & { children: Folder[] }>()
  const rootFolders: (Folder & { children: Folder[] })[] = []

  // 初始化 map
  folders.forEach(folder => {
    folderMap.set(folder.id, { ...folder, children: [] })
  })

  // 构建树
  folders.forEach(folder => {
    const folderWithChildren = folderMap.get(folder.id)!
    if (folder.parent_id && folderMap.has(folder.parent_id)) {
      folderMap.get(folder.parent_id)!.children.push(folderWithChildren)
    } else {
      rootFolders.push(folderWithChildren)
    }
  })

  return rootFolders
}

/**
 * 根据 ID 获取文件夹
 */
export function getFolderById(id: string): Folder | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM folders WHERE id = ?')
  const result = stmt.get(id) as any
  return result || null
}

/**
 * 创建文件夹
 */
export function createFolder(params: CreateFolderParams): Folder {
  const db = getDatabase()
  const now = new Date().toISOString()
  const id = uuidv4()

  const folder: Folder = {
    id,
    name: params.name,
    parent_id: params.parent_id || null,
    icon: params.icon || null,
    color: params.color || null,
    sort_order: params.sort_order ?? 0,
    is_expanded: 1,
    created_at: now,
    updated_at: now
  }

  const stmt = db.prepare(`
    INSERT INTO folders (id, name, parent_id, icon, color, sort_order, is_expanded, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    folder.id,
    folder.name,
    folder.parent_id,
    folder.icon,
    folder.color,
    folder.sort_order,
    folder.is_expanded,
    folder.created_at,
    folder.updated_at
  )

  return folder
}

/**
 * 更新文件夹
 */
export function updateFolder(id: string, params: UpdateFolderParams): Folder | null {
  const db = getDatabase()
  const existing = getFolderById(id)

  if (!existing) {
    return null
  }

  const updates: string[] = []
  const values: any[] = []

  if (params.name !== undefined) {
    updates.push('name = ?')
    values.push(params.name)
  }
  if (params.parent_id !== undefined) {
    updates.push('parent_id = ?')
    values.push(params.parent_id)
  }
  if (params.icon !== undefined) {
    updates.push('icon = ?')
    values.push(params.icon)
  }
  if (params.color !== undefined) {
    updates.push('color = ?')
    values.push(params.color)
  }
  if (params.sort_order !== undefined) {
    updates.push('sort_order = ?')
    values.push(params.sort_order)
  }
  if (params.is_expanded !== undefined) {
    updates.push('is_expanded = ?')
    values.push(params.is_expanded)
  }

  updates.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  const stmt = db.prepare(`
    UPDATE folders
    SET ${updates.join(', ')}
    WHERE id = ?
  `)

  stmt.run(...values)

  return getFolderById(id)
}

/**
 * 删除文件夹
 */
export function deleteFolder(id: string): boolean {
  const db = getDatabase()
  const stmt = db.prepare('DELETE FROM folders WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}

/**
 * 切换文件夹展开状态
 */
export function toggleFolderExpanded(id: string): Folder | null {
  const db = getDatabase()
  const existing = getFolderById(id)

  if (!existing) {
    return null
  }

  const newExpanded = existing.is_expanded ? 0 : 1
  const stmt = db.prepare(`
    UPDATE folders
    SET is_expanded = ?, updated_at = ?
    WHERE id = ?
  `)

  stmt.run(newExpanded, new Date().toISOString(), id)

  return getFolderById(id)
}

export default {
  getAllFolders,
  getFolderTree,
  getFolderById,
  createFolder,
  updateFolder,
  deleteFolder,
  toggleFolderExpanded
}
