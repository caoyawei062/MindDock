import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { streamText, generateText } from 'ai'
import { AIModelConfig, AIMessage, AICompletionOptions, AIStreamCallback } from './types'
import { aiConfigManager } from './config'

/**
 * AI 服务类
 */
export class AIService {
  private static instance: AIService

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService()
    }
    return AIService.instance
  }

  /**
   * 创建模型实例
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createModel(config: AIModelConfig): any {
    const { provider, apiKey, baseURL, model } = config

    switch (provider) {
      case 'openai': {
        const openai = createOpenAI({
          apiKey: apiKey || '',
          baseURL: baseURL || undefined
        })
        return openai(model)
      }

      case 'anthropic': {
        const anthropic = createAnthropic({
          apiKey: apiKey || ''
        })
        return anthropic(model)
      }

      case 'google': {
        const google = createGoogleGenerativeAI({
          apiKey: apiKey || ''
        })
        return google(model)
      }

      case 'deepseek': {
        const deepseek = createDeepSeek({
          apiKey: apiKey || '',
          baseURL: baseURL || 'https://api.deepseek.com'
        })
        return deepseek(model)
      }

      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }

  /**
   * 验证模型配置是否有效
   */
  validateModel(config: AIModelConfig): { valid: boolean; error?: string } {
    if (!config.enabled) {
      return { valid: false, error: 'Model is not enabled' }
    }

    if (!config.apiKey) {
      return { valid: false, error: 'API key is missing' }
    }

    return { valid: true }
  }

  /**
   * 转换消息格式
   */
  private convertMessages(messages: AIMessage[]): Array<{ role: string; content: string }> {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content
    }))
  }

  /**
   * 流式生成文本
   */
  async streamCompletion(
    modelId: string,
    messages: AIMessage[],
    options: Partial<AICompletionOptions> = {},
    onChunk: AIStreamCallback
  ): Promise<void> {
    const config = aiConfigManager.getModelById(modelId)

    if (!config) {
      throw new Error(`Model not found: ${modelId}`)
    }

    const validation = this.validateModel(config)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const model = this.createModel(config)
    const convertedMessages = this.convertMessages(messages)

    try {
      const result = await streamText({
        model,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: convertedMessages as any,
        temperature: options.temperature ?? 0.7,
        topP: options.topP
      })

      for await (const chunk of result.textStream) {
        onChunk(chunk)
      }

      // 等待流完成
      await result.usage
      const usage = result.usage
      console.log('Token usage:', usage)
    } catch (error) {
      console.error('AI streaming error:', error)
      throw error
    }
  }

  /**
   * 一次性生成文本
   */
  async generateCompletion(
    modelId: string,
    messages: AIMessage[],
    options: Partial<AICompletionOptions> = {}
  ): Promise<{
    content: string
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  }> {
    const config = aiConfigManager.getModelById(modelId)

    if (!config) {
      throw new Error(`Model not found: ${modelId}`)
    }

    const validation = this.validateModel(config)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const model = this.createModel(config)
    const convertedMessages = this.convertMessages(messages)

    try {
      const result = await generateText({
        model,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: convertedMessages as any,
        temperature: options.temperature ?? 0.7,
        topP: options.topP
      })

      return {
        content: result.text,
        usage: {
          promptTokens: result.usage?.promptTokens ?? 0,
          completionTokens: result.usage?.completionTokens ?? 0,
          totalTokens: result.usage?.totalTokens ?? 0
        }
      }
    } catch (error) {
      console.error('AI generation error:', error)
      throw error
    }
  }

  /**
   * 测试模型连接
   */
  async testModel(modelId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.generateCompletion(modelId, [{ role: 'user', content: 'Hello' }], {
        maxTokens: 10
      })
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// 导出单例
export const aiService = AIService.getInstance()
