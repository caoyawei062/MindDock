import { useState, useCallback, useRef, useEffect } from 'react'
import { AIModelConfig, AIMessage, AICompletionOptions } from '../types/ai'

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

  const stopStream = useCallback(() => {
    // 执行所有清理函数
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

        // 生成会话 ID
        const sessionId = `stream-${Date.now()}-${Math.random()}`
        sessionIdRef.current = sessionId

        // 设置监听器
        const unsubscribeChunk = window.api.aiOnStreamChunk(sessionId, (chunk) => {
          onChunk(chunk)
        })
        const unsubscribeComplete = window.api.aiOnStreamComplete(sessionId, () => {
          onComplete?.()
          setIsStreaming(false)
        })
        const unsubscribeError = window.api.aiOnStreamError(sessionId, (errorMessage) => {
          setError(errorMessage)
          setIsStreaming(false)
        })

        cleanupRef.current = [unsubscribeChunk, unsubscribeComplete, unsubscribeError]

        // 调用流式生成
        const result = await window.api.aiStreamCompletion(
          modelId,
          messages,
          options,
          sessionId
        )

        if (!result.success) {
          setError(result.error || 'Stream failed')
          setIsStreaming(false)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        setIsStreaming(false)
      }
    },
    [onChunk, onComplete]
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

export function useAIConfig() {
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
