import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { is } from '@electron-toolkit/utils'
import { createExportsTable } from './exports'

let db: Database.Database | null = null

/**
 * 获取数据库文件路径
 * dev模式：项目目录/.data/minddock.db
 * production模式：用户数据目录/minddock.db
 */
export function getDbPath(): string {
  // 确保 app 已准备好
  if (!app.isReady()) {
    throw new Error('App not ready. Call getDbPath() after app.whenReady()')
  }

  if (is.dev) {
    // 开发模式：存放在项目根目录的 .data 文件夹中
    const projectRoot = app.getAppPath()
    return path.join(projectRoot, '.data', 'minddock.db')
  }
  // 生产模式：存放在用户数据目录
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'minddock.db')
}

/**
 * 初始化数据库
 */
export function initDatabase(): Database.Database {
  if (db) return db

  const dbPath = getDbPath()

  // 确保目录存在
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  db = new Database(dbPath)

  // 启用外键约束
  db.pragma('foreign_keys = ON')

  // 创建导出记录表
  createExportsTable()

  // 执行迁移
  runMigrations(db)

  console.log('Database initialized at:', dbPath)
  return db
}

/**
 * 获取数据库实例
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

/**
 * 关闭数据库
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    console.log('Database closed.')
  }
}

/**
 * 执行数据库迁移
 */
function runMigrations(database: Database.Database): void {
  // 创建迁移表
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL
    )
  `)

  const migrations = [
    { name: '001_initial', sql: migration001Initial },
    { name: '002_add_fts', sql: migration002AddFts },
    { name: '003_add_ai_configs', sql: migration003AddAiConfigs },
    { name: '004_add_ai_tasks', sql: migration004AddAiTasks },
    { name: '005_ai_tasks_add_note_id', sql: migration005AiTasksAddNoteId }
  ]

  const executedMigrations = (
    database.prepare('SELECT name FROM migrations').all() as { name: string }[]
  ).map((row) => row.name)

  for (const migration of migrations) {
    if (!executedMigrations.includes(migration.name)) {
      console.log(`Running migration: ${migration.name}`)
      database.exec(migration.sql)
      database
        .prepare('INSERT INTO migrations (name, executed_at) VALUES (?, ?)')
        .run(migration.name, new Date().toISOString())
    }
  }
}

// ============ 迁移脚本 ============

const migration001Initial = `
-- 笔记/文档表
CREATE TABLE IF NOT EXISTS notes (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL DEFAULT '',
  content       TEXT DEFAULT '',
  type          TEXT NOT NULL DEFAULT 'document',
  language      TEXT DEFAULT NULL,
  folder_id     TEXT DEFAULT NULL,
  is_pinned     INTEGER DEFAULT 0,
  is_trashed    INTEGER DEFAULT 0,
  is_favorite   INTEGER DEFAULT 0,
  sort_order    INTEGER DEFAULT 0,
  word_count    INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  trashed_at    TEXT DEFAULT NULL,
  
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(type);
CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_trashed ON notes(is_trashed);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned);

-- 文件夹表
CREATE TABLE IF NOT EXISTS folders (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  parent_id     TEXT DEFAULT NULL,
  icon          TEXT DEFAULT NULL,
  color         TEXT DEFAULT NULL,
  sort_order    INTEGER DEFAULT 0,
  is_expanded   INTEGER DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  color         TEXT DEFAULT '#6366f1',
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- 笔记-标签关联表
CREATE TABLE IF NOT EXISTS note_tags (
  note_id       TEXT NOT NULL,
  tag_id        TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_note_tags_note ON note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag_id);

-- 设置表
CREATE TABLE IF NOT EXISTS settings (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
`

const migration002AddFts = `
-- 全文搜索虚拟表
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  title,
  content,
  content='notes',
  content_rowid='rowid'
);

-- 自动同步触发器
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, content) 
  VALUES (NEW.rowid, NEW.title, NEW.content);
END;

CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content) 
  VALUES('delete', OLD.rowid, OLD.title, OLD.content);
END;

CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content)
  VALUES('delete', OLD.rowid, OLD.title, OLD.content);
  INSERT INTO notes_fts(rowid, title, content)
  VALUES (NEW.rowid, NEW.title, NEW.content);
END;
`

const migration003AddAiConfigs = `
-- AI 配置表
CREATE TABLE IF NOT EXISTS ai_configs (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  provider      TEXT NOT NULL,
  model         TEXT NOT NULL,
  enabled       INTEGER NOT NULL DEFAULT 0,
  api_key       TEXT,
  base_url      TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_configs_provider ON ai_configs(provider);
CREATE INDEX IF NOT EXISTS idx_ai_configs_enabled ON ai_configs(enabled);
`

const migration004AddAiTasks = `
CREATE TABLE IF NOT EXISTS ai_tasks (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  goal          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'idle',
  mode          TEXT NOT NULL DEFAULT 'one_shot',
  summary       TEXT DEFAULT NULL,
  model_id      TEXT DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  last_run_at   TEXT DEFAULT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_updated ON ai_tasks(updated_at);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status);

CREATE TABLE IF NOT EXISTS ai_task_sources (
  id               TEXT PRIMARY KEY,
  task_id          TEXT NOT NULL,
  source_type      TEXT NOT NULL,
  source_id        TEXT DEFAULT NULL,
  role             TEXT NOT NULL,
  label            TEXT DEFAULT NULL,
  content_snapshot TEXT DEFAULT NULL,
  created_at       TEXT NOT NULL,

  FOREIGN KEY (task_id) REFERENCES ai_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_task_sources_task ON ai_task_sources(task_id);
CREATE INDEX IF NOT EXISTS idx_ai_task_sources_source ON ai_task_sources(source_id);

CREATE TABLE IF NOT EXISTS ai_task_outputs (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL,
  output_type TEXT NOT NULL,
  title       TEXT DEFAULT NULL,
  content     TEXT NOT NULL,
  meta_json   TEXT DEFAULT NULL,
  status      TEXT NOT NULL DEFAULT 'draft',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,

  FOREIGN KEY (task_id) REFERENCES ai_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_task_outputs_task ON ai_task_outputs(task_id);
CREATE INDEX IF NOT EXISTS idx_ai_task_outputs_status ON ai_task_outputs(status);
`

const migration005AiTasksAddNoteId = `
-- 添加 note_id 列用于直接关联笔记
ALTER TABLE ai_tasks ADD COLUMN note_id TEXT DEFAULT NULL REFERENCES notes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ai_tasks_note_id ON ai_tasks(note_id);

-- 从现有 sources 回填 note_id（取 primary 角色的 source_id）
UPDATE ai_tasks SET note_id = (
  SELECT s.source_id FROM ai_task_sources s
  WHERE s.task_id = ai_tasks.id AND s.role = 'primary' AND s.source_id IS NOT NULL
  LIMIT 1
);
`

export default {
  initDatabase,
  getDatabase,
  closeDatabase,
  getDbPath
}
