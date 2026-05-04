# MindDock

本地优先的 AI 笔记与代码片段工作台，基于 Electron、React、TypeScript 和 SQLite。

## 当前定位

MindDock 现在聚焦三个核心场景：

- 本地文档笔记编辑
- 代码片段整理与快速调用
- 基于多模型的 AI 辅助写作与改写

项目当前不以“通用 AI 工作台”作为目标。设置页、信息架构和后续规划会优先围绕上述主线收口。

## 当前已实现

- Electron 桌面端主应用与设置窗口
- SQLite 本地存储与迁移机制
- 笔记/代码片段 CRUD
- 回收站、置顶、收藏、最近查看
- 标签系统
- 欢迎页工作台统计
- 富文本编辑器与代码编辑器双模式
- 多模型 AI 配置与流式生成
- 笔记导出
- macOS 托盘代码片段快捷调用

## 技术栈

- Electron
- React 19
- TypeScript
- Vite / electron-vite
- Tailwind CSS v4
- TipTap
- CodeMirror
- better-sqlite3
- Vercel AI SDK

## 项目结构

```text
src/
  main/        Electron 主进程、数据库、AI、导出、托盘
  preload/     渲染进程桥接 API
  renderer/    React 界面层
docs/          设计与功能文档
```

## 开发

```bash
npm install
npm run dev
```

常用命令：

```bash
npm run typecheck
npm run lint
npm run build
```

## 当前状态判断

项目已经不是纯原型，主干功能可运行；但仍处于“功能已接通，工程尚未完全收口”的阶段。近期重点不是横向继续铺设新概念，而是先把核心闭环和工程质量稳住。

## 近期优化重点

### 1. 工程收口

- 清理 ESLint error 和关键 warning
- 收紧 preload / IPC / AI 的类型边界
- 增加最小回归测试
- 把 CI 从“仅构建”升级为“质量门禁 + 构建”

### 2. 产品收口

- 统一产品表达为“AI 笔记 + 代码片段工作台”
- 移除或收敛超前的占位信息架构
- 保证 README、设置页、实际能力一致

### 3. 核心功能补完

- 恢复并做实文件夹/层级组织
- 提升搜索体验
- 补版本历史 / 回滚能力
- 强化 AI 与当前笔记上下文的协同工作流

## 文档

- [AI 服务架构](./docs/AI_SERVICE.md)
- [数据库设计](./docs/database-design.md)
- [TipTap 指南](./docs/TIPTAP_GUIDE.md)
- [更新日志](./docs/CHANGELOG.md)

## 构建说明

macOS 本地签名示例：

```bash
codesign --force --sign - minddock.app
```
