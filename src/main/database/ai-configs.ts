import { getDatabase } from './index'
import { AIModelConfig, AIProvider } from '../ai/types'

interface AIConfigRow {
  id: string
  name: string
  provider: string
  model: string
  enabled: number
  api_key: string | null
  base_url: string | null
}

/**
 * 将数据库行转换为 AIModelConfig
 */
function rowToAIConfig(row: AIConfigRow): AIModelConfig {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider as AIProvider,
    model: row.model,
    enabled: row.enabled === 1,
    apiKey: row.api_key || undefined,
    baseURL: row.base_url || undefined
  }
}

/**
 * 获取所有 AI 配置
 */
export function getAllAIConfigs(): AIModelConfig[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM ai_configs ORDER BY provider, name').all() as AIConfigRow[]
  return rows.map(rowToAIConfig)
}

/**
 * 获取启用的 AI 配置
 */
export function getEnabledAIConfigs(): AIModelConfig[] {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT * FROM ai_configs WHERE enabled = 1 ORDER BY provider, name')
    .all() as AIConfigRow[]
  return rows.map(rowToAIConfig)
}

/**
 * 根据提供商获取 AI 配置
 */
export function getAIConfigsByProvider(provider: AIProvider): AIModelConfig[] {
  const db = getDatabase()
  const rows = db
    .prepare('SELECT * FROM ai_configs WHERE provider = ? ORDER BY name')
    .all(provider) as AIConfigRow[]
  return rows.map(rowToAIConfig)
}

/**
 * 根据 ID 获取 AI 配置
 */
export function getAIConfigById(id: string): AIModelConfig | undefined {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM ai_configs WHERE id = ?').get(id) as
    | AIConfigRow
    | undefined
  return row ? rowToAIConfig(row) : undefined
}

/**
 * 创建或更新 AI 配置
 */
export function upsertAIConfig(config: AIModelConfig): AIModelConfig {
  const db = getDatabase()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO ai_configs (id, name, provider, model, enabled, api_key, base_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      provider = excluded.provider,
      model = excluded.model,
      enabled = excluded.enabled,
      api_key = excluded.api_key,
      base_url = excluded.base_url,
      updated_at = excluded.updated_at
  `)

  stmt.run(
    config.id,
    config.name,
    config.provider,
    config.model,
    config.enabled ? 1 : 0,
    config.apiKey || null,
    config.baseURL || null,
    now,
    now
  )

  return getAIConfigById(config.id)!
}

/**
 * 批量创建或更新 AI 配置
 */
export function upsertAIConfigs(configs: AIModelConfig[]): AIModelConfig[] {
  return configs.map(upsertAIConfig)
}

/**
 * 更新 AI 配置的部分字段
 */
export function updateAIConfig(id: string, updates: Partial<AIModelConfig>): AIModelConfig | null {
  const existing = getAIConfigById(id)
  if (!existing) {
    return null
  }

  const updated = {
    ...existing,
    ...updates
  }

  return upsertAIConfig(updated)
}

/**
 * 启用/禁用 AI 模型
 */
export function toggleAIConfig(id: string, enabled: boolean): AIModelConfig | null {
  return updateAIConfig(id, { enabled })
}

/**
 * 删除 AI 配置
 */
export function deleteAIConfig(id: string): boolean {
  const db = getDatabase()
  const stmt = db.prepare('DELETE FROM ai_configs WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}

/**
 * 初始化默认 AI 配置
 */
export function initializeDefaultAIConfigs(): void {
  const existing = getAllAIConfigs()

  // 如果已经有配置，不再初始化
  if (existing.length > 0) {
    return
  }

  const db = getDatabase()
  const now = new Date().toISOString()

  const defaultConfigs: Omit<AIModelConfig, 'apiKey' | 'enabled'>[] = [
    // OpenAI 模型
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      model: 'gpt-4o'
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      model: 'gpt-4o-mini'
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      model: 'gpt-3.5-turbo'
    },
    // Anthropic 模型
    {
      id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514'
    },
    {
      id: 'claude-opus-4-20250514',
      name: 'Claude Opus 4',
      provider: 'anthropic',
      model: 'claude-opus-4-20250514'
    },
    {
      id: 'claude-haiku-4-20250514',
      name: 'Claude Haiku 4',
      provider: 'anthropic',
      model: 'claude-haiku-4-20250514'
    },
    // Google 模型
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      provider: 'google',
      model: 'gemini-2.5-pro'
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'google',
      model: 'gemini-2.5-flash'
    },
    // DeepSeek 模型
    {
      id: 'deepseek-chat',
      name: 'DeepSeek Chat',
      provider: 'deepseek',
      model: 'deepseek-chat'
    },
    {
      id: 'deepseek-coder',
      name: 'DeepSeek Coder',
      provider: 'deepseek',
      model: 'deepseek-coder'
    }
  ]

  const stmt = db.prepare(`
    INSERT INTO ai_configs (id, name, provider, model, enabled, api_key, base_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertMany = db.transaction((configs: Omit<AIModelConfig, 'apiKey' | 'enabled'>[]) => {
    for (const config of configs) {
      stmt.run(
        config.id,
        config.name,
        config.provider,
        config.model,
        0, // enabled = false
        null, // api_key = null
        null, // base_url = null
        now,
        now
      )
    }
  })

  insertMany(defaultConfigs)
}
