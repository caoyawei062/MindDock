# MindDock SQLite 数据库设计文档

## 📋 概述

MindDock 是一个 AI 增强笔记应用，支持文档编辑和代码片段管理。本文档详细描述了本地 SQLite 数据库的设计方案。

## 🎯 设计目标

1. **高效存储** - 优化笔记和代码片段的读写性能
2. **灵活分类** - 支持文件夹、标签等多维度组织
3. **全文搜索** - 支持标题和内容的快速搜索
4. **版本追踪** - 支持笔记的历史版本管理
5. **扩展性** - 为未来的 AI 功能预留扩展空间

---

## 📊 数据库表结构

### 1. `notes` - 笔记/文档表

存储所有笔记和代码片段的主表。

```sql
CREATE TABLE notes (
  id            TEXT PRIMARY KEY,          -- UUID 主键
  title         TEXT NOT NULL DEFAULT '',  -- 标题
  content       TEXT DEFAULT '',           -- 内容（Markdown/代码）
  type          TEXT NOT NULL DEFAULT 'document', -- 类型: 'document' | 'snippet'
  language      TEXT DEFAULT NULL,         -- 代码片段的语言（仅 type='snippet' 时有效）
  folder_id     TEXT DEFAULT NULL,         -- 所属文件夹 ID（可为空表示根目录）
  is_pinned     INTEGER DEFAULT 0,         -- 是否置顶: 0=否, 1=是
  is_trashed    INTEGER DEFAULT 0,         -- 是否在回收站: 0=否, 1=是
  is_favorite   INTEGER DEFAULT 0,         -- 是否收藏: 0=否, 1=是
  sort_order    INTEGER DEFAULT 0,         -- 排序权重（用于拖拽排序）
  word_count    INTEGER DEFAULT 0,         -- 字数统计（自动计算）
  created_at    TEXT NOT NULL,             -- 创建时间 (ISO 8601)
  updated_at    TEXT NOT NULL,             -- 更新时间 (ISO 8601)
  trashed_at    TEXT DEFAULT NULL,         -- 移入回收站时间（用于自动清理）
  
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
);

-- 索引优化
CREATE INDEX idx_notes_type ON notes(type);
CREATE INDEX idx_notes_folder ON notes(folder_id);
CREATE INDEX idx_notes_trashed ON notes(is_trashed);
CREATE INDEX idx_notes_updated ON notes(updated_at);
CREATE INDEX idx_notes_pinned ON notes(is_pinned);
```

### 2. `folders` - 文件夹表

支持文件夹层级组织。

```sql
CREATE TABLE folders (
  id            TEXT PRIMARY KEY,          -- UUID 主键
  name          TEXT NOT NULL,             -- 文件夹名称
  parent_id     TEXT DEFAULT NULL,         -- 父文件夹 ID（支持嵌套）
  icon          TEXT DEFAULT NULL,         -- 自定义图标（emoji 或图标名）
  color         TEXT DEFAULT NULL,         -- 自定义颜色
  sort_order    INTEGER DEFAULT 0,         -- 排序权重
  is_expanded   INTEGER DEFAULT 1,         -- 是否展开: 0=折叠, 1=展开
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX idx_folders_parent ON folders(parent_id);
```

### 3. `tags` - 标签表

全局标签定义。

```sql
CREATE TABLE tags (
  id            TEXT PRIMARY KEY,          -- UUID 主键
  name          TEXT NOT NULL UNIQUE,      -- 标签名称（唯一）
  color         TEXT DEFAULT '#6366f1',    -- 标签颜色
  created_at    TEXT NOT NULL
);

CREATE INDEX idx_tags_name ON tags(name);
```

### 4. `note_tags` - 笔记-标签关联表

多对多关系表。

```sql
CREATE TABLE note_tags (
  note_id       TEXT NOT NULL,
  tag_id        TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX idx_note_tags_note ON note_tags(note_id);
CREATE INDEX idx_note_tags_tag ON note_tags(tag_id);
```

### 5. `note_versions` - 笔记版本历史表

支持撤销和版本回滚。

```sql
CREATE TABLE note_versions (
  id            TEXT PRIMARY KEY,
  note_id       TEXT NOT NULL,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  version       INTEGER NOT NULL,          -- 版本号（递增）
  created_at    TEXT NOT NULL,
  
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX idx_versions_note ON note_versions(note_id);
CREATE INDEX idx_versions_created ON note_versions(created_at);
```

### 6. `settings` - 应用设置表

键值对存储用户设置。

```sql
CREATE TABLE settings (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
```

### 7. `ai_summaries` - AI 摘要缓存表（预留）

缓存 AI 生成的摘要，避免重复调用 API。

```sql
CREATE TABLE ai_summaries (
  id            TEXT PRIMARY KEY,
  note_id       TEXT NOT NULL UNIQUE,      -- 一个笔记只有一个摘要
  summary       TEXT NOT NULL,             -- AI 生成的摘要
  model         TEXT NOT NULL,             -- 使用的 AI 模型
  created_at    TEXT NOT NULL,
  
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX idx_summaries_note ON ai_summaries(note_id);
```

---

## 🔍 全文搜索（FTS5）

使用 SQLite FTS5 扩展实现高效全文搜索。

```sql
-- 创建全文搜索虚拟表
CREATE VIRTUAL TABLE notes_fts USING fts5(
  title,
  content,
  content='notes',
  content_rowid='rowid'
);

-- 自动同步触发器
CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, content) 
  VALUES (NEW.rowid, NEW.title, NEW.content);
END;

CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content) 
  VALUES('delete', OLD.rowid, OLD.title, OLD.content);
END;

CREATE TRIGGER notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content) 
  VALUES('delete', OLD.rowid, OLD.title, OLD.content);
  INSERT INTO notes_fts(rowid, title, content) 
  VALUES (NEW.rowid, NEW.title, NEW.content);
END;
```

### 搜索查询示例

```sql
-- 基础搜索
SELECT n.* FROM notes n
JOIN notes_fts fts ON n.rowid = fts.rowid
WHERE notes_fts MATCH '关键词'
ORDER BY rank;

-- 高亮搜索结果
SELECT 
  n.*,
  highlight(notes_fts, 0, '<mark>', '</mark>') AS title_highlighted,
  snippet(notes_fts, 1, '<mark>', '</mark>', '...', 32) AS content_snippet
FROM notes n
JOIN notes_fts fts ON n.rowid = fts.rowid
WHERE notes_fts MATCH '关键词';
```

---

## 📁 数据库文件位置

```javascript
// Electron 中的数据库路径
import { app } from 'electron'
import path from 'path'

const dbPath = path.join(app.getPath('userData'), 'minddock.db')
// macOS: ~/Library/Application Support/MindDock/minddock.db
// Windows: %APPDATA%/MindDock/minddock.db
// Linux: ~/.config/MindDock/minddock.db
```

---

## 📦 推荐技术栈

| 组件 | 推荐方案 | 说明 |
|------|----------|------|
| SQLite 驱动 | `better-sqlite3` | 同步 API，性能优秀 |
| ORM（可选） | `drizzle-orm` 或 `kysely` | 类型安全的查询构建器 |
| 迁移工具 | `better-sqlite3-migrate` | 数据库迁移管理 |

### 安装依赖

```bash
pnpm add better-sqlite3
pnpm add -D @types/better-sqlite3
```

---

## 🔄 数据迁移策略

### 版本管理表

```sql
CREATE TABLE migrations (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  executed_at   TEXT NOT NULL
);
```

### 迁移文件结构

```
src/
  main/
    database/
      index.ts           # 数据库初始化
      migrations/
        001_initial.sql  # 初始表结构
        002_add_fts.sql  # 添加全文搜索
        ...
      queries/
        notes.ts         # 笔记相关查询
        folders.ts       # 文件夹相关查询
        tags.ts          # 标签相关查询
```

---

## 📐 ER 图

```
┌─────────────┐       ┌─────────────┐
│   folders   │       │    tags     │
├─────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)     │
│ name        │       │ name        │
│ parent_id   │◄──┐   │ color       │
│ ...         │   │   └──────┬──────┘
└──────┬──────┘   │          │
       │          │          │
       │ 1:N      │          │ N:M
       ▼          │          ▼
┌─────────────┐   │   ┌─────────────┐
│    notes    │   │   │  note_tags  │
├─────────────┤   │   ├─────────────┤
│ id (PK)     │◄──┼───│ note_id     │
│ title       │   │   │ tag_id      │
│ content     │   │   └─────────────┘
│ type        │   │
│ folder_id   │───┘
│ ...         │
└──────┬──────┘
       │
       │ 1:N
       ▼
┌─────────────────┐
│  note_versions  │
├─────────────────┤
│ id (PK)         │
│ note_id (FK)    │
│ version         │
│ ...             │
└─────────────────┘
```

---

## 🚀 下一步实施计划

1. **安装依赖** - `better-sqlite3`
2. **创建数据库模块** - `src/main/database/index.ts`
3. **编写迁移脚本** - 初始表结构
4. **实现 CRUD 操作** - 笔记、文件夹、标签
5. **集成 IPC 通信** - 渲染进程与主进程数据交互
6. **替换模拟数据** - 将 `tray.ts` 中的模拟数据替换为数据库查询

---

## 📝 更新日志

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| 1.0 | 2026-01-11 | 初始设计文档 |
