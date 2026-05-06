/**
 * Shared AI types — single source of truth for main, renderer, and preload.
 */

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'deepseek'

export interface AIModelConfig {
  id: string
  name: string
  provider: AIProvider
  model: string
  enabled: boolean
  apiKey?: string
  baseURL?: string
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AICompletionOptions {
  temperature?: number
  maxTokens?: number
  topP?: number
}

export interface AICompletionResult {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}
