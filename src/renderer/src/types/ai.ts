// Re-export all shared AI types — renderer consumers import from here
export type {
  AIProvider,
  AIModelConfig,
  AIMessage,
  AICompletionOptions,
  AICompletionResult,
  AITaskStatus,
  AITaskMode,
  AITaskSourceType,
  AITaskSourceRole,
  AITaskOutputType,
  AITaskOutputStatus,
  AITask,
  AITaskSource,
  AITaskOutput,
  CreateAITaskParams,
  UpdateAITaskParams,
  CreateAITaskSourceParams,
  CreateAITaskOutputParams,
  AITaskOutputAcceptTarget,
  AITaskOutputAcceptResult
} from '../../../shared/types/ai'
