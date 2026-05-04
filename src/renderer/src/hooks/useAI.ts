import { useState, useCallback, useRef, useEffect, type RefObject } from 'react'
import {
  AIModelConfig,
  AIMessage,
  AICompletionOptions,
  AITask,
  AITaskOutput,
  AITaskOutputAcceptResult,
  AITaskSource,
  CreateAITaskOutputParams,
  CreateAITaskParams,
  CreateAITaskSourceParams,
  UpdateAITaskParams
} from '../types/ai'

export interface UseAIStreamResult {
  isStreaming: boolean
  error: string | null
  startStream: (
    modelId: string,
    messages: AIMessage[],
    options?: AICompletionOptions
  ) => Promise<void>
  stopStream: () => void
  reset: () => void
}

export function useAIStream(
  onChunk: (chunk: string) => void,
  onComplete?: () => void
): UseAIStreamResult {
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionIdRef = useRef<string>('')
  const cleanupRef = useRef<(() => void)[]>([])

  const onChunkRef: RefObject<(chunk: string) => void> = useRef(onChunk)
  const onCompleteRef: RefObject<(() => void) | undefined> = useRef(onComplete)

  useEffect(() => {
    onChunkRef.current = onChunk
    onCompleteRef.current = onComplete
  }, [onChunk, onComplete])

  const stopStream = useCallback(() => {
    if (sessionIdRef.current) {
      void window.api.aiCancelStream(sessionIdRef.current)
      sessionIdRef.current = ''
    }
    cleanupRef.current.forEach((cleanup) => cleanup())
    cleanupRef.current = []
    setIsStreaming(false)
  }, [])

  const reset = useCallback(() => {
    setError(null)
  }, [])

  const startStream = useCallback(
    async (modelId: string, messages: AIMessage[], options: Partial<AICompletionOptions> = {}) => {
      try {
        setIsStreaming(true)
        setError(null)

        const sessionId = `stream-${Date.now()}-${Math.random()}`
        sessionIdRef.current = sessionId

        const unsubscribeChunk = window.api.aiOnStreamChunk(sessionId, (chunk) => {
          onChunkRef.current(chunk)
        })
        const unsubscribeComplete = window.api.aiOnStreamComplete(sessionId, () => {
          onCompleteRef.current?.()
          sessionIdRef.current = ''
          setIsStreaming(false)
        })
        const unsubscribeError = window.api.aiOnStreamError(sessionId, (errorMessage) => {
          setError(errorMessage)
          sessionIdRef.current = ''
          setIsStreaming(false)
        })

        cleanupRef.current = [unsubscribeChunk, unsubscribeComplete, unsubscribeError]

        const result = await window.api.aiStreamCompletion(modelId, messages, options, sessionId)

        if (!result.success) {
          setError(result.error || 'Stream failed')
          sessionIdRef.current = ''
          setIsStreaming(false)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        sessionIdRef.current = ''
        setIsStreaming(false)
      }
    },
    []
  )

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopStream()
    }
  }, [stopStream])

  return {
    isStreaming,
    error,
    startStream,
    stopStream,
    reset
  }
}

export function useAIConfig(): {
  models: AIModelConfig[]
  loading: boolean
  error: string | null
  loadAllModels: () => Promise<void>
  loadEnabledModels: () => Promise<void>
  updateModel: (id: string, updates: Partial<AIModelConfig>) => Promise<AIModelConfig | null>
  toggleModel: (id: string, enabled: boolean) => Promise<AIModelConfig | null>
  testModel: (modelId: string) => Promise<{ success: boolean; error?: string }>
} {
  const [models, setModels] = useState<AIModelConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAllModels = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await window.api.aiGetAllModels()
      setModels(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load models'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadEnabledModels = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await window.api.aiGetEnabledModels()
      setModels(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load models'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateModel = useCallback(async (id: string, updates: Partial<AIModelConfig>) => {
    try {
      setError(null)
      const result = await window.api.aiUpdateModel(id, updates)
      if (result) {
        setModels((prev) => prev.map((m) => (m.id === id ? result : m)))
      }
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update model'
      setError(errorMessage)
      return null
    }
  }, [])

  const toggleModel = useCallback(async (id: string, enabled: boolean) => {
    try {
      setError(null)
      const result = await window.api.aiToggleModel(id, enabled)
      if (result) {
        setModels((prev) => prev.map((m) => (m.id === id ? result : m)))
      }
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle model'
      setError(errorMessage)
      return null
    }
  }, [])

  const testModel = useCallback(async (modelId: string) => {
    try {
      setError(null)
      const result = await window.api.aiTestModel(modelId)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to test model'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [])

  return {
    models,
    loading,
    error,
    loadAllModels,
    loadEnabledModels,
    updateModel,
    toggleModel,
    testModel
  }
}

export function useAITasks(): {
  tasks: AITask[]
  loading: boolean
  error: string | null
  loadTasks: (sourceId?: string) => Promise<void>
  createTask: (params: CreateAITaskParams) => Promise<AITask | null>
  updateTask: (id: string, params: UpdateAITaskParams) => Promise<AITask | null>
  deleteTask: (id: string) => Promise<boolean>
  getTaskSources: (taskId: string) => Promise<AITaskSource[]>
  replaceTaskSources: (
    taskId: string,
    sources: CreateAITaskSourceParams[]
  ) => Promise<AITaskSource[]>
  getTaskOutputs: (taskId: string) => Promise<AITaskOutput[]>
  replaceTaskOutputs: (
    taskId: string,
    outputs: CreateAITaskOutputParams[]
  ) => Promise<AITaskOutput[]>
  acceptTaskOutput: (
    taskId: string,
    outputId: string,
    target: 'new_note' | 'append_current' | 'new_snippet',
    noteId?: string
  ) => Promise<AITaskOutputAcceptResult>
} {
  const [tasks, setTasks] = useState<AITask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTasks = useCallback(async (sourceId?: string) => {
    try {
      setLoading(true)
      setError(null)
      const result = await window.api.aiTasksGetAll(sourceId)
      setTasks(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  const createTask = useCallback(async (params: CreateAITaskParams) => {
    try {
      setError(null)
      const result = await window.api.aiTasksCreate(params)
      setTasks((prev) => [result, ...prev])
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create AI task')
      return null
    }
  }, [])

  const updateTask = useCallback(async (id: string, params: UpdateAITaskParams) => {
    try {
      setError(null)
      const result = await window.api.aiTasksUpdate(id, params)
      if (result) {
        setTasks((prev) => prev.map((task) => (task.id === id ? result : task)))
      }
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update AI task')
      return null
    }
  }, [])

  const deleteTask = useCallback(async (id: string) => {
    try {
      setError(null)
      const success = await window.api.aiTasksDelete(id)
      if (success) {
        setTasks((prev) => prev.filter((task) => task.id !== id))
      }
      return success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete AI task')
      return false
    }
  }, [])

  const getTaskSources = useCallback(async (taskId: string) => {
    try {
      setError(null)
      return await window.api.aiTaskSourcesGet(taskId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task sources')
      return []
    }
  }, [])

  const replaceTaskSources = useCallback(
    async (taskId: string, sources: CreateAITaskSourceParams[]) => {
      try {
        setError(null)
        return await window.api.aiTaskSourcesReplace(taskId, sources)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save task sources')
        return []
      }
    },
    []
  )

  const getTaskOutputs = useCallback(async (taskId: string) => {
    try {
      setError(null)
      return await window.api.aiTaskOutputsGet(taskId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task outputs')
      return []
    }
  }, [])

  const replaceTaskOutputs = useCallback(
    async (taskId: string, outputs: CreateAITaskOutputParams[]) => {
      try {
        setError(null)
        return await window.api.aiTaskOutputsReplace(taskId, outputs)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save task outputs')
        return []
      }
    },
    []
  )

  const acceptTaskOutput = useCallback(
    async (
      taskId: string,
      outputId: string,
      target: 'new_note' | 'append_current' | 'new_snippet',
      noteId?: string
    ) => {
      try {
        setError(null)
        return await window.api.aiTaskOutputAccept(taskId, outputId, target, noteId)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to accept task output'
        setError(message)
        return { success: false, error: message }
      }
    },
    []
  )

  return {
    tasks,
    loading,
    error,
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
    getTaskSources,
    replaceTaskSources,
    getTaskOutputs,
    replaceTaskOutputs,
    acceptTaskOutput
  }
}
