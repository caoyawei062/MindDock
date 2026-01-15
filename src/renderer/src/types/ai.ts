/**
 * AI 模型提供商类型
 */
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'deepseek'

/**
 * AI 模型配置
 */
export interface AIModelConfig {
  id: string
  name: string
  provider: AIProvider
  model: string
  enabled: boolean
  apiKey?: string
  baseURL?: string
}

/**
 * AI 聊天消息
 */
export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * AI 完成选项
 */
export interface AICompletionOptions {
  temperature?: number
  maxTokens?: number
  topP?: number
}

/**
 * AI 响应结果
 */
export interface AICompletionResult {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}
