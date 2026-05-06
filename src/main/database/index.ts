import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { is } from '@electron-toolkit/utils'
import { createExportsTable } from './exports'

let db: Database.Database | null = null

export function getDbPath(): string {
  if (!app.isReady()) {
    throw new Error('App not ready. Call getDbPath() after app.whenReady()')
  }

  if (is.dev) {
    const projectRoot = app.getAppPath()
    return path.join(projectRoot, '.data', 'minddock.db')
  }
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'minddock.db')
}

export function initDatabase(): Database.Database {
  if (db) return db

  const dbPath = getDbPath()

  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  db = new Database(dbPath)
  db.pragma('foreign_keys = ON')
  createExportsTable()
  runMigrations(db)

  return db
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

function runMigrations(database: Database.Database): void {
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
    { name: '006_drop_ai_tasks', sql: migration006DropAiTasks }
  ]

  const executedMigrations = (
    database.prepare('SELECT name FROM migrations').all() as { name: string }[]
  ).map((row) => row.name)

  for (const migration of migrations) {
    if (!executedMigrations.includes(migration.name)) {
      database.exec(migration.sql)
      database
        .prepare('INSERT INTO migrations (name, executed_at) VALUES (?, ?)')
        .run(migration.name, new Date().toISOString())
    }
  }
}

const migration001Initial = `
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

CREATE TABLE IF NOT EXISTS tags (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  color         TEXT DEFAULT '#6366f1',
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

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

CREATE TABLE IF NOT EXISTS settings (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
`

const migration002AddFts = `
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  title,
  content,
  content='notes',
  content_rowid='rowid'
);

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

const migration006DropAiTasks = `
DROP TABLE IF EXISTS ai_task_outputs;
DROP TABLE IF EXISTS ai_task_sources;
DROP TABLE IF EXISTS ai_tasks;
`

export default {
  initDatabase,
  getDatabase,
  closeDatabase,
  getDbPath
}
