/**
 * Shared AI types — single source of truth for main, renderer, and preload.
 */

// ============ Model & Provider ============

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

// ============ Messages & Completion ============

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

// ============ AI Tasks ============

export type AITaskStatus = 'idle' | 'running' | 'ready' | 'failed'
export type AITaskMode = 'one_shot' | 'persistent'
export type AITaskSourceType = 'note' | 'snippet' | 'selection'
export type AITaskSourceRole = 'primary' | 'reference' | 'context'
export type AITaskOutputType = 'findings' | 'next_steps' | 'draft_note' | 'draft_snippet'
export type AITaskOutputStatus = 'draft' | 'accepted' | 'dismissed'

export interface AITask {
  id: string
  title: string
  goal: string
  status: AITaskStatus
  mode: AITaskMode
  summary: string | null
  model_id: string | null
  note_id: string | null
  error_message: string | null
  last_run_at: string | null
  created_at: string
  updated_at: string
}

export interface AITaskSource {
  id: string
  task_id: string
  source_type: AITaskSourceType
  source_id: string | null
  role: AITaskSourceRole
  label: string | null
  content_snapshot: string | null
  created_at: string
}

export interface AITaskOutput {
  id: string
  task_id: string
  output_type: AITaskOutputType
  title: string | null
  content: string
  meta_json: string | null
  status: AITaskOutputStatus
  created_at: string
  updated_at: string
}

export interface CreateAITaskParams {
  title?: string
  goal: string
  mode?: AITaskMode
  model_id?: string | null
  note_id?: string | null
}

export interface UpdateAITaskParams {
  title?: string
  goal?: string
  status?: AITaskStatus
  mode?: AITaskMode
  summary?: string | null
  model_id?: string | null
  error_message?: string | null
  last_run_at?: string | null
}

export interface CreateAITaskSourceParams {
  source_type: AITaskSourceType
  source_id?: string | null
  role: AITaskSourceRole
  label?: string | null
  content_snapshot?: string | null
}

export interface CreateAITaskOutputParams {
  output_type: AITaskOutputType
  title?: string | null
  content: string
  meta_json?: string | null
  status?: AITaskOutputStatus
}

export type AITaskOutputAcceptTarget = 'new_note' | 'append_current' | 'new_snippet'

export interface AITaskOutputAcceptResult {
  success: boolean
  noteId?: string
  error?: string
}
