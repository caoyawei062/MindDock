import { ipcMain } from 'electron'
import { aiConfigManager } from './config'
import { aiService } from './index'
import { AIMessage, AIModelConfig } from './types'

/**
 * AI 相关的 IPC 通道名称
 */
export const AI_IPC_CHANNELS = {
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
} as const

/**
 * 注册 AI 相关的 IPC 处理器
 */
export function registerAIIPC(): void {
  // ========== 配置管理 ==========

  // 获取所有模型
  ipcMain.handle(AI_IPC_CHANNELS.GET_ALL_MODELS, () => {
    return aiConfigManager.getAllModels()
  })

  // 获取启用的模型
  ipcMain.handle(AI_IPC_CHANNELS.GET_ENABLED_MODELS, () => {
    return aiConfigManager.getEnabledModels()
  })

  // 根据 ID 获取模型
  ipcMain.handle(AI_IPC_CHANNELS.GET_MODEL_BY_ID, (_, id: string) => {
    return aiConfigManager.getModelById(id)
  })

  // 更新模型配置
  ipcMain.handle(AI_IPC_CHANNELS.UPDATE_MODEL, (_, id: string, updates: Partial<AIModelConfig>) => {
    return aiConfigManager.updateModel(id, updates)
  })

  // 启用/禁用模型
  ipcMain.handle(AI_IPC_CHANNELS.TOGGLE_MODEL, (_, id: string, enabled: boolean) => {
    return aiConfigManager.toggleModel(id, enabled)
  })

  // 根据提供商获取模型
  ipcMain.handle(AI_IPC_CHANNELS.GET_MODELS_BY_PROVIDER, (_, provider: string) => {
    return aiConfigManager.getModelsByProvider(provider as any)
  })

  // ========== AI 功能 ==========

  // 流式生成文本
  ipcMain.handle(
    AI_IPC_CHANNELS.STREAM_COMPLETION,
    async (
      _event,
      modelId: string,
      messages: AIMessage[],
      options: any,
      sessionId: string
    ) => {
      try {
        await aiService.streamCompletion(
          modelId,
          messages,
          options,
          (chunk: string) => {
            // 发送流式数据到渲染进程
            _event.sender.send(`ai:stream:chunk:${sessionId}`, chunk)
          }
        )
        // 发送完成信号
        _event.sender.send(`ai:stream:complete:${sessionId}`)
        return { success: true }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        _event.sender.send(`ai:stream:error:${sessionId}`, errorMessage)
        return { success: false, error: errorMessage }
      }
    }
  )

  // 一次性生成文本
  ipcMain.handle(
    AI_IPC_CHANNELS.GENERATE_COMPLETION,
    async (_event, modelId: string, messages: AIMessage[], options: any) => {
      try {
        const result = await aiService.generateCompletion(modelId, messages, options)
        return { success: true, data: result }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, error: errorMessage }
      }
    }
  )

  // 测试模型连接
  ipcMain.handle(AI_IPC_CHANNELS.TEST_MODEL, async (_event, modelId: string) => {
    return await aiService.testModel(modelId)
  })

  console.log('AI IPC handlers registered.')
}

export default { registerAIIPC }
