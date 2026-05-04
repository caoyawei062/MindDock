// Re-export shared types + main-process-only types
export type {
  AIProvider,
  AIModelConfig,
  AIMessage,
  AICompletionOptions,
  AICompletionResult
} from '../../shared/types/ai'

/**
 * AI 流式响应回调（main 进程专用）
 */
export type AIStreamCallback = (chunk: string) => void
