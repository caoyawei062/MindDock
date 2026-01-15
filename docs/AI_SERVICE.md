# MindDock AI 服务架构文档

## 概述

MindDock 集成了多厂商 AI 服务，基于 Vercel AI SDK 实现，支持 OpenAI、Anthropic、Google、DeepSeek 等主流 AI 提供商。

## 技术栈

- **核心 SDK**: `ai` v6.x (Vercel AI SDK)
- **厂商适配器**:
  - `@ai-sdk/openai` - OpenAI / OpenAI 兼容 API
  - `@ai-sdk/anthropic` - Anthropic Claude 系列
  - `@ai-sdk/google` - Google Gemini 系列
  - `@ai-sdk/deepseek` - DeepSeek 系列

## 目录结构

```
src/main/ai/
├── index.ts      # AI 服务核心类，处理文本生成
├── config.ts     # AI 配置管理器，带缓存层
├── types.ts      # TypeScript 类型定义
└── ipc.ts        # IPC 通道注册，渲染进程通信
```

---

## 类型定义 (`types.ts`)

### AIProvider

支持的 AI 提供商类型：

```typescript
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'deepseek'
```

### AIModelConfig

模型配置接口：

```typescript
export interface AIModelConfig {
  id: string           // 唯一标识符
  name: string         // 显示名称
  provider: AIProvider // 提供商
  model: string        // 模型名称
  enabled: boolean     // 是否启用
  apiKey?: string      // API 密钥
  baseURL?: string     // 自定义 API 端点 (可选)
}
```

### AIMessage

聊天消息格式：

```typescript
export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}
```

### AICompletionOptions

生成选项：

```typescript
export interface AICompletionOptions {
  model: string
  temperature?: number  // 温度参数，默认 0.7
  maxTokens?: number    // 最大 token 数
  topP?: number         // Top-P 采样
  stream?: boolean      // 是否流式输出
}
```

---

## AI 服务类 (`index.ts`)

### 单例模式

```typescript
const aiService = AIService.getInstance()
```

### 核心方法

#### `streamCompletion()` - 流式生成

```typescript
async streamCompletion(
  modelId: string,
  messages: AIMessage[],
  options: Partial<AICompletionOptions> = {},
  onChunk: AIStreamCallback
): Promise<void>
```

- 逐块返回生成内容
- 通过 `onChunk` 回调接收每个文本块

#### `generateCompletion()` - 一次性生成

```typescript
async generateCompletion(
  modelId: string,
  messages: AIMessage[],
  options: Partial<AICompletionOptions> = {}
): Promise<{
  content: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}>
```

- 等待完整响应后返回
- 包含 token 使用量统计

#### `testModel()` - 测试连接

```typescript
async testModel(modelId: string): Promise<{ success: boolean; error?: string }>
```

- 发送简单请求验证 API 配置是否有效

### 多厂商适配

`createModel()` 方法根据 provider 自动选择对应的 SDK：

| Provider | SDK 函数 | 备注 |
|----------|----------|------|
| `openai` | `createOpenAI()` | 支持自定义 baseURL |
| `anthropic` | `createAnthropic()` | Claude 系列 |
| `google` | `createGoogleGenerativeAI()` | Gemini 系列 |
| `deepseek` | `createDeepSeek()` | 默认 baseURL: `https://api.deepseek.com` |

---

## 配置管理 (`config.ts`)

### AIConfigManager

带缓存的配置管理器，避免频繁数据库读取：

```typescript
const aiConfigManager = AIConfigManager.getInstance()

// 获取所有模型
aiConfigManager.getAllModels()

// 获取启用的模型
aiConfigManager.getEnabledModels()

// 根据 ID 获取
aiConfigManager.getModelById('gpt-4o')

// 更新配置
aiConfigManager.updateModel('gpt-4o', { apiKey: 'sk-xxx' })

// 启用/禁用
aiConfigManager.toggleModel('gpt-4o', true)

// 刷新缓存
aiConfigManager.reload()
```

---

## IPC 通信 (`ipc.ts`)

### 通道定义

```typescript
AI_IPC_CHANNELS = {
  // 配置管理
  GET_ALL_MODELS: 'ai:models:getAll',
  GET_ENABLED_MODELS: 'ai:models:getEnabled',
  GET_MODEL_BY_ID: 'ai:models:getById',
  UPDATE_MODEL: 'ai:models:update',
  TOGGLE_MODEL: 'ai:models:toggle',
  GET_MODELS_BY_PROVIDER: 'ai:models:getByProvider',

  // AI 功能
  STREAM_COMPLETION: 'ai:completion:stream',
  GENERATE_COMPLETION: 'ai:completion:generate',
  TEST_MODEL: 'ai:model:test'
}
```

### 流式响应机制

流式生成使用 session 机制：

1. 渲染进程调用 `ai:completion:stream`，传入 `sessionId`
2. 主进程通过 `ai:stream:chunk:${sessionId}` 发送每个数据块
3. 完成时发送 `ai:stream:complete:${sessionId}`
4. 错误时发送 `ai:stream:error:${sessionId}`

---

## 数据库存储 (`database/ai-configs.ts`)

### 表结构

```sql
CREATE TABLE ai_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  enabled INTEGER DEFAULT 0,
  api_key TEXT,
  base_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

### 预置模型

首次启动时自动初始化以下模型配置：

| Provider | 模型 ID | 名称 |
|----------|---------|------|
| OpenAI | `gpt-4o` | GPT-4o |
| OpenAI | `gpt-4o-mini` | GPT-4o Mini |
| OpenAI | `gpt-3.5-turbo` | GPT-3.5 Turbo |
| Anthropic | `claude-sonnet-4-20250514` | Claude Sonnet 4 |
| Anthropic | `claude-opus-4-20250514` | Claude Opus 4 |
| Anthropic | `claude-haiku-4-20250514` | Claude Haiku 4 |
| Google | `gemini-2.5-pro` | Gemini 2.5 Pro |
| Google | `gemini-2.5-flash` | Gemini 2.5 Flash |
| DeepSeek | `deepseek-chat` | DeepSeek Chat |
| DeepSeek | `deepseek-coder` | DeepSeek Coder |

---

## 渲染进程使用示例

```typescript
// 获取所有模型
const models = await window.api.invoke('ai:models:getAll')

// 更新 API Key
await window.api.invoke('ai:models:update', 'gpt-4o', { 
  apiKey: 'sk-xxx',
  enabled: true 
})

// 流式生成
const sessionId = crypto.randomUUID()

// 注册监听器
window.api.on(`ai:stream:chunk:${sessionId}`, (chunk) => {
  console.log('Received chunk:', chunk)
})

window.api.on(`ai:stream:complete:${sessionId}`, () => {
  console.log('Stream completed')
})

// 开始流式请求
await window.api.invoke('ai:completion:stream', 'gpt-4o', [
  { role: 'user', content: 'Hello!' }
], {}, sessionId)
```

---

## 注意事项

### AI SDK v6.x 变更

从 v6.0 开始，`LanguageModelUsage` 类型的属性名发生变化：

| 旧版本 | v6.x |
|--------|------|
| `promptTokens` | `inputTokens` |
| `completionTokens` | `outputTokens` |

代码中已做适配，返回对象仍使用 `promptTokens` / `completionTokens` 以保持 API 兼容性。

### 错误处理

- 未启用的模型调用会抛出 `Model is not enabled` 错误
- 缺少 API Key 会抛出 `API key is missing` 错误
- 模型不存在会抛出 `Model not found: ${modelId}` 错误

---

## 扩展指南

### 添加新的 AI 提供商

1. 安装对应的 SDK 适配器
2. 在 `types.ts` 中添加新的 provider 类型
3. 在 `AIService.createModel()` 中添加 switch case
4. 在 `database/ai-configs.ts` 的默认配置中添加模型
