import { AIModelConfig, AIProvider } from './types'
import {
  getAllAIConfigs,
  getEnabledAIConfigs,
  getAIConfigsByProvider,
  getAIConfigById,
  upsertAIConfig,
  updateAIConfig,
  toggleAIConfig,
  deleteAIConfig,
  initializeDefaultAIConfigs
} from '../database/ai-configs'

/**
 * AI 配置管理类
 */
export class AIConfigManager {
  private static instance: AIConfigManager
  private cache: Map<string, AIModelConfig> = new Map()
  private cacheInitialized = false

  private constructor() {}

  static getInstance(): AIConfigManager {
    if (!AIConfigManager.instance) {
      AIConfigManager.instance = new AIConfigManager()
    }
    return AIConfigManager.instance
  }

  /**
   * 确保缓存已初始化
   */
  private ensureCacheInitialized(): void {
    if (!this.cacheInitialized) {
      // 初始化默认配置（如果需要）
      initializeDefaultAIConfigs()

      // 加载所有配置到缓存
      const configs = getAllAIConfigs()
      this.cache.clear()
      configs.forEach((config) => {
        this.cache.set(config.id, config)
      })
      this.cacheInitialized = true
    }
  }

  /**
   * 获取所有模型配置
   */
  getAllModels(): AIModelConfig[] {
    this.ensureCacheInitialized()
    return Array.from(this.cache.values())
  }

  /**
   * 获取启用的模型
   */
  getEnabledModels(): AIModelConfig[] {
    this.ensureCacheInitialized()
    return this.getAllModels().filter((m) => m.enabled)
  }

  /**
   * 根据提供商获取模型
   */
  getModelsByProvider(provider: AIProvider): AIModelConfig[] {
    this.ensureCacheInitialized()
    return this.getAllModels().filter((m) => m.provider === provider)
  }

  /**
   * 根据 ID 获取模型
   */
  getModelById(id: string): AIModelConfig | undefined {
    this.ensureCacheInitialized()
    return this.cache.get(id)
  }

  /**
   * 更新模型配置
   */
  updateModel(id: string, updates: Partial<AIModelConfig>): AIModelConfig | null {
    const updated = updateAIConfig(id, updates)
    if (updated) {
      this.cache.set(id, updated)
    }
    return updated
  }

  /**
   * 启用/禁用模型
   */
  toggleModel(id: string, enabled: boolean): AIModelConfig | null {
    return this.updateModel(id, { enabled })
  }

  /**
   * 删除模型配置
   */
  deleteModel(id: string): boolean {
    const deleted = deleteAIConfig(id)
    if (deleted) {
      this.cache.delete(id)
    }
    return deleted
  }

  /**
   * 重新加载配置（用于外部更新后刷新）
   */
  reload(): void {
    this.cacheInitialized = false
    this.ensureCacheInitialized()
  }
}

// 导出单例
export const aiConfigManager = AIConfigManager.getInstance()

// 重新导出数据库操作函数供外部使用
export {
  getAllAIConfigs,
  getEnabledAIConfigs,
  getAIConfigsByProvider,
  getAIConfigById,
  upsertAIConfig,
  updateAIConfig,
  toggleAIConfig,
  deleteAIConfig,
  initializeDefaultAIConfigs
}
