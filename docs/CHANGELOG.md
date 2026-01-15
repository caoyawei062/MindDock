# MindDock v1.0.5 更新日志与功能文档

## 📋 版本概述

MindDock 是一个 AI 增强笔记应用，支持文档编辑和代码片段管理。本文档记录了最近添加的主要功能。

---

## 🚀 最近更新 (v1.0.0 - v1.0.5)

### v1.0.5 (2026-01-16)
- **修复**: AI SDK v6.x 兼容性问题
  - 更新 `LanguageModelUsage` 属性名适配：`promptTokens` → `inputTokens`，`completionTokens` → `outputTokens`

### v1.0.4
- **修复**: GitHub Actions 构建配置
- **修复**: 使用 `pnpm exec` 运行 `electron-builder`

### v1.0.3 / v1.0.2
- **优化**: Release 发布流程

### v1.0.1
- **优化**: Release 配置

### v1.0.0
- **核心功能完善**
- 状态栏快捷选择和输入
- 编辑器模式切换和代码编辑器集成
- 代码片段支持
- 富文本图片支持
- Tiptap 富文本编辑基础功能

---

## 🤖 新增功能：AI 服务集成

### 功能概述

集成多厂商 AI 服务，支持：
- **流式对话生成** - 实时显示 AI 响应
- **一次性文本生成** - 等待完整响应
- **多提供商切换** - OpenAI / Anthropic / Google / DeepSeek

### 支持的 AI 模型

| 提供商 | 模型 | 说明 |
|--------|------|------|
| **OpenAI** | GPT-4o, GPT-4o Mini, GPT-3.5 Turbo | 支持自定义 API 端点 |
| **Anthropic** | Claude Sonnet 4, Claude Opus 4, Claude Haiku 4 | Claude 最新模型 |
| **Google** | Gemini 2.5 Pro, Gemini 2.5 Flash | Google AI |
| **DeepSeek** | DeepSeek Chat, DeepSeek Coder | 国产大模型 |

### 使用方式

1. **配置 API Key**: 在设置中为对应模型配置 API Key
2. **启用模型**: 开启需要使用的模型
3. **发起对话**: 在编辑器中使用 AI 功能

### 技术实现

- 基于 **Vercel AI SDK v6.x**
- 支持流式响应和 Token 使用量统计
- 配置持久化存储于 SQLite 数据库
- IPC 通道实现主进程与渲染进程通信

> 详细技术文档请参考 [AI_SERVICE.md](./AI_SERVICE.md)

---

## 📝 富文本编辑器 (Tiptap)

### 功能特性

- **Markdown 支持** - 实时渲染
- **代码块高亮** - 基于 Lowlight/Highlight.js
- **图片插入** - 支持 URL 插入
- **格式工具栏** - BubbleMenu 悬浮菜单
- **自动保存** - 内容变更自动持久化

### 扩展列表

| 扩展 | 说明 |
|------|------|
| StarterKit | 基础套件（标题、列表、粗体等） |
| Placeholder | 空文档占位符 |
| CodeBlockLowlight | 语法高亮代码块 |
| Image | 图片支持 |

> 详细开发指南请参考 [TIPTAP_GUIDE.md](./TIPTAP_GUIDE.md)

---

## 💾 数据库设计

### 表结构概览

| 表名 | 说明 |
|------|------|
| `notes` | 笔记/文档主表 |
| `folders` | 文件夹层级 |
| `tags` | 标签定义 |
| `note_tags` | 笔记-标签关联 |
| `note_versions` | 版本历史 |
| `settings` | 应用设置 |
| `ai_configs` | AI 模型配置 |
| `ai_summaries` | AI 摘要缓存（预留） |

### 特性

- **全文搜索**: 基于 SQLite FTS5
- **版本追踪**: 支持历史回滚
- **自动同步**: 触发器实现 FTS 索引更新

> 详细设计文档请参考 [database-design.md](./database-design.md)

---

## 🏗️ 项目结构

```
src/
├── main/                    # Electron 主进程
│   ├── ai/                  # AI 服务模块
│   │   ├── index.ts         # AI 服务核心类
│   │   ├── config.ts        # 配置管理器
│   │   ├── types.ts         # 类型定义
│   │   └── ipc.ts           # IPC 通道注册
│   ├── database/            # 数据库模块
│   │   ├── index.ts         # 数据库初始化
│   │   ├── notes.ts         # 笔记 CRUD
│   │   ├── ai-configs.ts    # AI 配置 CRUD
│   │   └── ...
│   └── ...
├── renderer/                # Electron 渲染进程
│   └── src/
│       ├── components/
│       │   ├── business/    # 业务组件
│       │   │   ├── Edit/    # 编辑器相关
│       │   │   │   └── Tiptap.tsx
│       │   │   ├── List.tsx
│       │   │   ├── SideBar.tsx
│       │   │   └── ...
│       │   └── ui/          # UI 组件 (shadcn/ui)
│       └── ...
└── preload/                 # 预加载脚本
```

---

## 📦 技术栈

| 类别 | 技术 |
|------|------|
| **框架** | Electron + React + TypeScript |
| **构建** | Vite + electron-builder |
| **UI** | Tailwind CSS + shadcn/ui |
| **编辑器** | Tiptap (ProseMirror) |
| **数据库** | SQLite + better-sqlite3 |
| **AI SDK** | Vercel AI SDK v6.x |
| **包管理** | pnpm |

---

## 🔧 开发命令

```bash
# 开发模式
pnpm dev

# 构建
pnpm build

# 打包
pnpm build:mac    # macOS
pnpm build:win    # Windows
pnpm build:linux  # Linux
```

---

## 📝 更新日志

| 日期 | 版本 | 内容 |
|------|------|------|
| 2026-01-16 | v1.0.5 | 修复 AI SDK v6.x 兼容性 |
| 2026-01-15 | v1.0.4 | 优化 GitHub Actions 构建 |
| 2026-01-14 | v1.0.0 | 核心功能完善 |
| 2026-01-13 | - | AI 服务集成 |
| 2026-01-11 | - | 数据库设计与实现 |
| 2026-01-10 | - | 富文本编辑器集成 |
| 2026-01-09 | - | 代码编辑器支持 |
