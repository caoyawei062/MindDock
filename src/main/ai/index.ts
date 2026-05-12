import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { streamText, generateText, jsonSchema, tool, stepCountIs } from 'ai'
import { AIModelConfig, AIMessage, AICompletionOptions, AIStreamCallback } from './types'
import { aiConfigManager } from './config'

type SupportedLanguageModel =
  | ReturnType<ReturnType<typeof createOpenAI>>
  | ReturnType<ReturnType<typeof createAnthropic>>
  | ReturnType<ReturnType<typeof createGoogleGenerativeAI>>
  | ReturnType<ReturnType<typeof createDeepSeek>>

type SDKMessage = NonNullable<Parameters<typeof streamText>[0]['messages']>[number]

const codeEditTools = {
  modify_current_file: tool({
    description:
      'Use this only when the user explicitly wants the current code content changed. Return either a unified diff for local edits or full replacement content for larger rewrites.',
    inputSchema: jsonSchema<{
      summary: string
      mode: 'unified_diff' | 'replace_file'
      diff?: string
      content?: string
      changes?: Array<{ title: string; diff: string }>
    }>({
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: {
          type: 'string',
          description: 'One sentence summary of the proposed code change.'
        },
        mode: {
          type: 'string',
          enum: ['unified_diff', 'replace_file'],
          description: 'Use unified_diff for focused edits, replace_file for larger rewrites.'
        },
        diff: {
          type: 'string',
          description: 'Unified diff applicable to the current code content. Required for unified_diff.'
        },
        content: {
          type: 'string',
          description: 'Full replacement code content. Required for replace_file.'
        },
        changes: {
          type: 'array',
          description: 'Optional preview list of important changes.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              diff: { type: 'string' }
            },
            required: ['title', 'diff']
          }
        }
      },
      required: ['summary', 'mode']
    }),
    execute: async (input) => input
  })
}

/**
 * AI 服务类
 */
export class AIService {
  private static instance: AIService
  private activeStreams = new Map<string, AbortController>()

  private constructor() {
    // Singleton
  }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService()
    }
    return AIService.instance
  }

  /**
   * 创建模型实例
   */
  private createModel(config: AIModelConfig): SupportedLanguageModel {
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
  private convertMessages(messages: AIMessage[]): SDKMessage[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content
    }))
  }

  /**
   * 流式生成文本
   */
  async streamCompletion(
    sessionId: string,
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
    const abortController = new AbortController()
    this.activeStreams.set(sessionId, abortController)

    try {
      const useCodeEditTools = options.toolMode === 'code-edit'
      const result = await streamText({
        model,
        messages: convertedMessages,
        tools: useCodeEditTools ? codeEditTools : undefined,
        toolChoice: useCodeEditTools ? 'auto' : undefined,
        stopWhen: useCodeEditTools ? stepCountIs(2) : undefined,
        temperature: options.temperature ?? 0.7,
        topP: options.topP,
        maxOutputTokens: options.maxTokens,
        abortSignal: abortController.signal
      })

      if (useCodeEditTools) {
        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            onChunk(part.text)
            continue
          }

          if (part.type === 'tool-call' && part.toolName === 'modify_current_file') {
            onChunk(
              `\n\`\`\`tool_call\n${JSON.stringify({
                name: part.toolName,
                arguments: part.input
              })}\n\`\`\`\n`
            )
          }
        }
      } else {
        for await (const chunk of result.textStream) {
          onChunk(chunk)
        }
      }

      // 等待流完成
      await result.usage
      const usage = result.usage
      console.log('Token usage:', usage)
    } catch (error) {
      console.error('AI streaming error:', error)
      throw error
    } finally {
      this.activeStreams.delete(sessionId)
    }
  }

  cancelStream(sessionId: string): boolean {
    const controller = this.activeStreams.get(sessionId)
    if (!controller) {
      return false
    }
    controller.abort()
    this.activeStreams.delete(sessionId)
    return true
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
        messages: convertedMessages,
        temperature: options.temperature ?? 0.7,
        topP: options.topP,
        maxOutputTokens: options.maxTokens
      })

      return {
        content: result.text,
        usage: {
          promptTokens: result.usage?.inputTokens ?? 0,
          completionTokens: result.usage?.outputTokens ?? 0,
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
